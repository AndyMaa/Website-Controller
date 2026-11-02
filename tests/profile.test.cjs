const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { prepareProfile } = require('../src/profile.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'website-profile-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const legacy = path.join(root, '\u63a5\u5355\u53f0'); fs.mkdirSync(legacy);
  const config = JSON.stringify({ version: 1, sites: [{ id: 'same-account' }], events: [{ id: 'same-message' }] });
  fs.writeFileSync(path.join(legacy, 'workspace.json'), config);
  fs.mkdirSync(path.join(legacy, 'Partitions', 'relay-same-account', 'Network'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'Partitions', 'relay-same-account', 'Network', 'Cookies'), 'session-fixture');
  fs.writeFileSync(path.join(legacy, 'Local State'), 'encryption-key-fixture');
  fs.writeFileSync(path.join(legacy, 'lockfile'), 'stale-lock');
  return { root, legacy, config };
}
test('profile migration preserves account IDs, records, cookies and local encryption keys', t => {
  const { root, legacy, config } = fixture(t);
  const target = prepareProfile(root, 'win32');
  assert.equal(path.basename(target), '消息中心');
  assert.equal(fs.readFileSync(path.join(target, 'workspace.json'), 'utf8'), config);
  assert.equal(fs.readFileSync(path.join(target, 'Partitions', 'relay-same-account', 'Network', 'Cookies'), 'utf8'), 'session-fixture');
  assert.equal(fs.readFileSync(path.join(target, 'Local State'), 'utf8'), 'encryption-key-fixture');
  assert.equal(fs.existsSync(path.join(target, 'lockfile')), false);
  assert.equal(fs.readFileSync(path.join(legacy, 'workspace.json'), 'utf8'), config);
});
test('existing new profiles are never overwritten by the rollback copy', t => {
  const { root } = fixture(t); const target = prepareProfile(root, 'win32');
  fs.writeFileSync(path.join(target, 'workspace.json'), 'new-version-data');
  assert.equal(prepareProfile(root, 'win32'), target);
  assert.equal(fs.readFileSync(path.join(target, 'workspace.json'), 'utf8'), 'new-version-data');
});
test('invalid source config cannot publish a partially migrated profile', t => {
  const { root, legacy } = fixture(t); fs.writeFileSync(path.join(legacy, 'workspace.json'), '{invalid');
  assert.throws(() => prepareProfile(root, 'win32'));
  assert.equal(fs.existsSync(path.join(root, '消息中心')), false);
  assert.equal(fs.readFileSync(path.join(legacy, 'workspace.json'), 'utf8'), '{invalid');
});
test('fresh Windows and Mac installs choose the expected directories without legacy data', t => {
  const { root, legacy } = fixture(t); fs.unlinkSync(path.join(legacy, 'workspace.json'));
  assert.equal(prepareProfile(root, 'win32'), path.join(root, '消息中心'));
  assert.equal(prepareProfile(root, 'darwin'), path.join(root, 'Website Controller'));
});
