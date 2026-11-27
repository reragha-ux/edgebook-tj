// Pure helpers for main.js, kept separate so they can be tested without Electron.
const path = require('path');

/** Maps an app://edgebook/<path> URL to a file inside appDir, or null if it would escape it. */
function resolveAppPath(appDir, url) {
  const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '') || 'Edgebook.html';
  const file = path.resolve(appDir, rel);
  return file.startsWith(path.resolve(appDir) + path.sep) ? file : null;
}

/** Checks a Polar /v1/customer-portal/license-keys/activate response (HTTP status + JSON body). */
function checkActivation(status, json, orgId) {
  if (status === 200 && json?.id && json.license_key?.status === 'granted') {
    if (orgId && json.license_key.organization_id !== orgId) return { ok: false, error: 'That key is for a different product.' };
    return { ok: true, instanceId: json.id };
  }
  if (status === 404) return { ok: false, error: 'That key was not found. Check that you pasted all of it.' };
  if (status === 403) return { ok: false, error: 'This key is already active on its maximum number of computers, or is no longer valid. You can free a computer from your Polar purchase page.' };
  return { ok: false, error: 'That key was not accepted.' };
}

/** The page a headless Edge/Chrome opens inside the old install's profile to send its journal to us. */
function exportPage(port, token) {
  return `<!doctype html><meta charset="utf-8"><title>Moving your Edgebook journal</title>
<p style="font:15px system-ui;padding:24px">Moving your journal to the new Edgebook app. You can close this window.</p>
<script>
const KEYS = ['accounts', 'setups', 'trades', 'journal', 'goals', 'settings'];
const send = (o) => fetch('http://127.0.0.1:${port}/${token}', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(o) });
const rq = indexedDB.open('edgebook');
rq.onupgradeneeded = () => rq.transaction.abort(); // no journal in this profile: don't create an empty one
rq.onerror = () => send({ error: 'no-journal' });
rq.onsuccess = () => {
  const db = rq.result;
  if (!db.objectStoreNames.contains('kv')) return send({ error: 'no-journal' });
  const store = db.transaction('kv').objectStore('kv'), out = {};
  let left = KEYS.length;
  const done = () => { if (!--left) send({ data: out }); };
  for (const k of KEYS) { const g = store.get(k); g.onsuccess = () => { if (g.result !== undefined) out[k] = g.result; done(); }; g.onerror = done; }
};
</script>`;
}

module.exports = { resolveAppPath, checkActivation, exportPage };
