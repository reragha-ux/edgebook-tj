// Edgebook desktop shell: serves the unchanged Edgebook.html from app://edgebook/ so its IndexedDB journal
// lives in this app's own profile, and adds what a browser shortcut can't: license, updates, moving old data.
const { app, BrowserWindow, protocol, net, ipcMain, shell, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { resolveAppPath, checkActivation, exportPage, removeOldAppFiles } = require('./lib');
const config = require('./config.json');

const APP_DIR = path.join(__dirname, 'app');
const ICON = path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const NAG_DAYS = 7;

if (process.env.EDGEBOOK_PROFILE) app.setPath('userData', process.env.EDGEBOOK_PROFILE); // tests use a throwaway profile
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// ---------- small JSON store in the user data folder ----------
const storeFile = () => path.join(app.getPath('userData'), 'desktop.json');
let store = {};
function loadStore() { try { store = JSON.parse(fs.readFileSync(storeFile(), 'utf8')); } catch { store = {}; } }
function saveStore() { fs.writeFileSync(storeFile(), JSON.stringify(store, null, 2)); }

// ---------- windows ----------
let mainWin = null, licenseWin = null;

function lockDown(win) {
  // Links in the journal (trade links, TradingView) open in the user's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600, backgroundColor: '#1b1d16', icon: ICON, show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  lockDown(mainWin);
  mainWin.once('ready-to-show', () => { mainWin.show(); maybeNag(); });
  mainWin.on('closed', () => (mainWin = null));
  mainWin.loadURL(`app://edgebook/${store.migrated ? 'Edgebook.html' : 'migrate.html'}`);
}

function openLicenseWindow() {
  if (licenseWin) return licenseWin.focus();
  licenseWin = new BrowserWindow({
    width: 480, height: 440, resizable: false, minimizable: false, maximizable: false, parent: mainWin || undefined, modal: !!mainWin,
    backgroundColor: '#1b1d16', icon: ICON, autoHideMenuBar: true, title: 'Edgebook license',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  lockDown(licenseWin);
  licenseWin.on('closed', () => (licenseWin = null));
  licenseWin.loadURL('app://edgebook/license.html');
}

function maybeNag() {
  if (store.license || !app.isPackaged) return;
  const last = store.lastNag ? Date.parse(store.lastNag) : 0;
  if (Date.now() - last < NAG_DAYS * 864e5) return;
  store.lastNag = new Date().toISOString(); saveStore();
  openLicenseWindow();
}

// ---------- license (Polar; honour system: the app works without a key) ----------
// EDGEBOOK_POLAR_API / EDGEBOOK_POLAR_ORG point at sandbox-api.polar.sh and a sandbox org for testing.
const POLAR_API = process.env.EDGEBOOK_POLAR_API || 'https://api.polar.sh';
const POLAR_ORG = process.env.EDGEBOOK_POLAR_ORG || config.polarOrganizationId;

async function activateLicense(key) {
  key = String(key || '').trim();
  if (!key) return { ok: false, error: 'Paste your license key. It is on your Polar purchase page, linked from your receipt email.' };
  let res, json;
  try {
    res = await net.fetch(`${POLAR_API}/v1/customer-portal/license-keys/activate`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, organization_id: POLAR_ORG, label: `Edgebook on ${process.platform === 'darwin' ? 'Mac' : 'Windows'}` }),
    });
    json = await res.json().catch(() => null);
  } catch {
    return { ok: false, error: 'Could not reach the license server. Check your internet connection and try again.' };
  }
  const r = checkActivation(res.status, json, POLAR_ORG);
  if (!r.ok) return r;
  store.license = { key, instanceId: r.instanceId, activatedAt: new Date().toISOString() }; saveStore();
  return { ok: true };
}

// ---------- moving the journal from the old Edge/Chrome install ----------
const OLD_PROFILE = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Edgebook', 'Profile') : '';
const OLD_APP_DIR = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Edgebook') : '';

/** After the journal has moved: removes the old app's page and icon (its folder clashes with the old uninstaller), and
 *  points any taskbar pin of the old app at this app. The old journal folder (OLD_PROFILE) is kept as a backup. */
function retireOldApp() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try { removeOldAppFiles(OLD_APP_DIR, path.dirname(process.execPath)); } catch {}
  const q = (s) => s.replace(/'/g, "''");
  const ps = `$sh = New-Object -ComObject WScript.Shell; $d = Join-Path $env:APPDATA 'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar';
if (Test-Path $d) { Get-ChildItem $d -Filter *.lnk | ForEach-Object { $l = $sh.CreateShortcut($_.FullName);
  if ($l.Arguments -like '*${q(OLD_PROFILE)}*') { $l.TargetPath = '${q(process.execPath)}'; $l.Arguments = ''; $l.IconLocation = '${q(process.execPath)},0'; $l.WorkingDirectory = '${q(path.dirname(process.execPath))}'; $l.Save() } } }`;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 20000, windowsHide: true }, () => {});
}

function findBrowser() {
  const e = process.env;
  return [
    `${e['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`, `${e.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${e.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`, `${e.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${e['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`, `${e.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ].find((p) => fs.existsSync(p));
}

const hasOldJournal = () => process.platform === 'win32' && !!OLD_PROFILE && fs.existsSync(path.join(OLD_PROFILE, 'Default', 'IndexedDB'));

/** Closes an open old Edgebook window the way install.ps1 does (like clicking X, so it saves first), then waits up to 10 s.
 *  While it is open, Edge would hand our export page to that window instead of running it headless. */
function closeOldEdgebook() {
  const prof = OLD_PROFILE.replace(/'/g, "''");
  const ps = `$p = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${prof}*' -and $_.CommandLine -notlike '*--type=*' });
foreach ($x in $p) { $g = Get-Process -Id $x.ProcessId -ErrorAction SilentlyContinue; if ($g) { [void]$g.CloseMainWindow() } }
foreach ($i in 1..40) { if (-not ($p | Where-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue })) { break }; Start-Sleep -Milliseconds 250 }`;
  return new Promise((res) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 20000, windowsHide: true }, () => res()));
}

/** Opens the old profile in headless Edge/Chrome with a page that posts the journal back to a one-time local address. */
async function exportOldJournal() {
  const browser = findBrowser();
  if (!browser) throw new Error('Microsoft Edge or Google Chrome was not found.');
  await closeOldEdgebook();
  const token = crypto.randomUUID();
  const page = path.join(os.tmpdir(), `edgebook-export-${token}.html`);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, data) => {
      if (settled) return; settled = true;
      clearTimeout(timer); server.close(); fs.rm(page, { force: true }, () => {});
      err ? reject(err) : resolve(data);
    };
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*'); // the page's origin is file:// ("null"); the random token is the guard
      if (req.method !== 'POST' || req.url !== `/${token}`) { res.statusCode = 404; return res.end(); }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.end('ok');
        try {
          const msg = JSON.parse(body);
          if (msg.error || !msg.data) return finish(new Error('No journal was found in the old Edgebook.'));
          finish(null, msg.data);
        } catch { finish(new Error('The old journal could not be read.')); }
      });
    });
    const timer = setTimeout(() => finish(new Error('The old Edgebook did not answer. Close its window and try again.')), 60000);
    server.listen(0, '127.0.0.1', () => {
      fs.writeFileSync(page, exportPage(server.address().port, token));
      const child = spawn(browser, ['--headless=new', `--user-data-dir=${OLD_PROFILE}`, '--no-first-run', '--no-default-browser-check', pathToFileURL(page).href], { stdio: 'ignore', detached: false });
      child.on('error', (e) => finish(e));
      server.on('close', () => { try { child.kill(); } catch {} });
    });
  });
}

// ---------- IPC for migrate.html and license.html ----------
ipcMain.handle('migrate:status', () => ({ oldJournal: hasOldJournal() }));
ipcMain.handle('migrate:run', async () => {
  try { const data = await exportOldJournal(); retireOldApp(); return { ok: true, data }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('migrate:done', () => { store.migrated = true; saveStore(); });
ipcMain.handle('license:get', () => ({ licensed: !!store.license, key: store.license ? store.license.key.replace(/.(?=.{4})/g, '•') : '' }));
ipcMain.handle('license:activate', (_e, key) => activateLicense(key));
ipcMain.handle('license:buy', () => shell.openExternal(config.checkoutUrl));
ipcMain.handle('license:close', () => licenseWin?.close());

// ---------- updates (GitHub Releases, see package.json "publish") ----------
function checkForUpdates(manual) {
  if (!app.isPackaged) return manual && dialog.showMessageBox({ message: 'Updates are only checked in the installed app.' });
  autoUpdater.checkForUpdatesAndNotify().then((r) => {
    if (manual && !r?.isUpdateAvailable) dialog.showMessageBox({ message: `Edgebook ${app.getVersion()} is up to date.` });
  }).catch((e) => manual && dialog.showMessageBox({ type: 'warning', message: 'Could not check for updates.', detail: e.message }));
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: isMac ? app.name : 'Edgebook',
      submenu: [
        { label: 'License key…', click: openLicenseWindow },
        { label: 'Buy Edgebook…', click: () => shell.openExternal(config.checkoutUrl) },
        { label: 'Check for updates…', click: () => checkForUpdates(true) },
        { label: 'Website', click: () => shell.openExternal(config.websiteUrl) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }])] },
  ]));
}

// ---------- start ----------
if (!app.requestSingleInstanceLock()) app.quit(); // two windows writing one journal would overwrite each other
else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(() => {
    loadStore();
    protocol.handle('app', (req) => {
      const file = resolveAppPath(APP_DIR, req.url);
      return file ? net.fetch(pathToFileURL(file).href) : new Response('Not found', { status: 404 });
    });
    buildMenu();
    createMainWindow();
    checkForUpdates(false);
    app.on('activate', () => { if (!mainWin) createMainWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
