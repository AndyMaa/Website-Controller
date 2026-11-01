const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { normalizeUrl, validateSite, unreadFromTitle, evaluateObservation, Store, normalizeSettings } = require('../src/core.cjs');

test('URLs accept website addresses and reject executable/local schemes or credentials', () => {
  assert.equal(normalizeUrl('vjshi.com'), 'https://vjshi.com/');
  assert.equal(normalizeUrl('https://www.zcool.com.cn/'), 'https://www.zcool.com.cn/');
  assert.equal(normalizeUrl('http://127.0.0.1:8080/messages'), 'http://127.0.0.1:8080/messages');
  for (const url of ['javascript:alert(1)', 'file:///C:/Windows', 'data:text/html,hello', 'https://user:pass@example.com/', '']) assert.throws(() => normalizeUrl(url));
});
test('website validation preserves independent account IDs and bounds refresh intervals', () => {
  const first = validateSite({ name: '站酷', url: 'https://www.zcool.com.cn/' });
  const second = validateSite({ name: '站酷', url: first.url });
  assert.notEqual(first.id, second.id);
  assert.equal(validateSite({ name: '新名称' }, first).id, first.id);
  for (const interval of [1, 30, -1, 3601, 60.5, 'x']) assert.throws(() => validateSite({ name: '测试', url: 'example.com', refreshSeconds: interval }));
  assert.equal(validateSite({ name: '测试', url: 'example.com', refreshSeconds: 120 }).refreshSeconds, 120);
  assert.equal(validateSite({ name: '测试', url: 'example.com', color: 'evil" onclick=' }).color, 'blue');
});
test('title detection uses message patterns rather than unrelated page numbers', () => {
  for (const title of ['(3) 站酷', '（3）光厂', '【3】 新消息', '[3] inbox', '您有3条新消息']) assert.equal(unreadFromTitle(title), 3);
  assert.equal(unreadFromTitle('【新消息】站酷'), 1);
  for (const title of ['2026 设计作品', '光厂 300万素材', '站酷ZCOOL', '']) assert.equal(unreadFromTitle(title), null);
});
test('first unread count alerts once; reload and unchanged heartbeat do not duplicate it', () => {
  const first = evaluateObservation({}, { unread: 2 }); assert.equal(first.alert, true);
  assert.equal(evaluateObservation(first.next, { unread: 2 }).alert, false);
  const unknown = evaluateObservation(first.next, { unread: null });
  assert.equal(unknown.count, null); assert.equal(unknown.next.lastCount, 2);
  assert.equal(evaluateObservation(unknown.next, { unread: 2 }).alert, false);
  assert.equal(evaluateObservation(first.next, { unread: 3 }).alert, true);
});
test('read resets and subsequent messages trigger again, including counts decreasing above zero', () => {
  const first = evaluateObservation({}, { unread: 2 });
  const lower = evaluateObservation(first.next, { unread: 1 }); assert.equal(lower.alert, false);
  assert.equal(evaluateObservation(lower.next, { unread: 2 }).alert, true);
  const zero = evaluateObservation(first.next, { unread: 0 }); assert.equal(zero.alert, false);
  assert.equal(evaluateObservation(zero.next, { unread: 2 }).alert, true);
});
test('message previews establish baseline and detect changes with stable unread counts', () => {
  const base = evaluateObservation({}, { unread: 0, preview: '你好' }); assert.equal(base.alert, false);
  const next = evaluateObservation(base.next, { unread: 1, preview: '有新的设计需求' }); assert.equal(next.alert, true);
  assert.equal(evaluateObservation(next.next, { unread: 1, preview: '有新的设计需求' }).alert, false);
  assert.equal(evaluateObservation(next.next, { unread: 1, preview: '请问明天方便吗' }).alert, true);
  assert.equal(evaluateObservation(next.next, { unread: 0, preview: '旧消息被展开' }).alert, false);
});
test('preview-only monitoring does not alert for the initial baseline', () => {
  const first = evaluateObservation({}, { unread: null, preview: '旧消息' }); assert.equal(first.alert, false);
  assert.equal(evaluateObservation(first.next, { unread: null, preview: '新消息' }).alert, true);
});
test('settings accept only known boolean keys', () => {
  const settings = normalizeSettings({ sound: false, notifications: 'yes', unknown: true });
  assert.equal(settings.sound, false); assert.equal(settings.notifications, true); assert.equal(settings.unknown, undefined);
});
test('settings, rules and activity persist atomically; demos are not persisted', () => {
  const dir = path.join(__dirname, '..', 'test-results', `unit-${randomUUID()}`);
  const store = new Store(dir);
  store.data.settings.quiet = true;
  store.data.sites[0].unreadSelector = '#count';
  store.data.sites.push({ ...validateSite({ name: '演示', url: 'http://127.0.0.1/' }), demo: true });
  store.data.events.push({ id: randomUUID(), siteId: store.data.sites[0].id, siteName: '光厂', title: '新消息', type: 'message', at: Date.now(), read: false, url: 'https://www.vjshi.com/' });
  store.flush(); const loaded = new Store(dir);
  assert.equal(loaded.data.settings.quiet, true); assert.equal(loaded.data.sites[0].unreadSelector, '#count');
  assert.equal(loaded.data.sites.length, 2); assert.equal(loaded.data.events.length, 1);
  assert.equal(fs.existsSync(`${store.file}.tmp`), false);
});
test('damaged configuration is backed up and reported rather than silently lost', () => {
  const dir = path.join(__dirname, '..', 'test-results', `corrupt-${randomUUID()}`); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'workspace.json'), '{broken json');
  const store = new Store(dir); assert.match(store.warning, /已备份/);
  const backup = fs.readdirSync(dir).find(name => name.includes('.recovery-')); assert.ok(backup);
  assert.equal(fs.readFileSync(path.join(dir, backup), 'utf8'), '{broken json');
});
