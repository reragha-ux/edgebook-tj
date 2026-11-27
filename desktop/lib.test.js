const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { resolveAppPath, checkActivation, exportPage } = require('./lib');

const dir = path.resolve('app');

test('app:// paths stay inside the app folder', () => {
  assert.equal(resolveAppPath(dir, 'app://edgebook/Edgebook.html'), path.join(dir, 'Edgebook.html'));
  assert.equal(resolveAppPath(dir, 'app://edgebook/'), path.join(dir, 'Edgebook.html'));
  assert.equal(resolveAppPath(dir, 'app://edgebook/..%2Fmain.js'), null);
  // the URL parser collapses encoded dot segments, so this stays inside the folder
  assert.equal(resolveAppPath(dir, 'app://edgebook/%2e%2e/%2e%2e/secret.txt'), path.join(dir, 'secret.txt'));
});

test('license activation checks the Polar response and the organization', () => {
  const ok = { id: 'a1', license_key: { status: 'granted', organization_id: 'org' } };
  assert.deepEqual(checkActivation(200, ok, 'org'), { ok: true, instanceId: 'a1' });
  assert.equal(checkActivation(200, ok, 'other').ok, false);
  assert.equal(checkActivation(200, { id: 'a1', license_key: { status: 'revoked', organization_id: 'org' } }, 'org').ok, false);
  assert.match(checkActivation(404, { error: 'ResourceNotFound' }, 'org').error, /not found/);
  assert.match(checkActivation(403, { error: 'NotPermitted' }, 'org').error, /maximum/);
  assert.equal(checkActivation(500, null, 'org').ok, false);
});

test('export page posts to the one-time address and never creates a database', () => {
  const html = exportPage(5123, 'tok');
  assert.match(html, /http:\/\/127\.0\.0\.1:5123\/tok/);
  assert.match(html, /onupgradeneeded = \(\) => rq\.transaction\.abort\(\)/);
});
