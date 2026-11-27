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

test('license activation checks the result and the product', () => {
  assert.deepEqual(checkActivation({ activated: false, error: 'license_key not found.' }, 0), { ok: false, error: 'license_key not found.' });
  assert.equal(checkActivation(null, 0).ok, false);
  assert.deepEqual(checkActivation({ activated: true, instance: { id: 'i1' }, meta: { product_id: 7 } }, 7), { ok: true, instanceId: 'i1' });
  assert.equal(checkActivation({ activated: true, meta: { product_id: 8 } }, 7).ok, false);
  assert.equal(checkActivation({ activated: true, meta: { product_id: 8 } }, 0).ok, true);
});

test('export page posts to the one-time address and never creates a database', () => {
  const html = exportPage(5123, 'tok');
  assert.match(html, /http:\/\/127\.0\.0\.1:5123\/tok/);
  assert.match(html, /onupgradeneeded = \(\) => rq\.transaction\.abort\(\)/);
});
