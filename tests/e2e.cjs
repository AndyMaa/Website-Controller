const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { validateSite, DEFAULT_SETTINGS } = require('../src/core.cjs');
const root = path.resolve(__dirname, '..');
const resultsDir = path.join(root, 'test-results'); fs.mkdirSync(resultsDir, { recursive: true });
const profileRoot = path.join(resultsDir, `desktop-${randomUUID()}`);
let dataDir = path.join(profileRoot, '\u63a5\u5355\u53f0'); fs.mkdirSync(dataDir, { recursive: true });
const checks = [], pageErrors = [];
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><html lang="zh-CN"><head><title>测试消息工作台</title></head><body style="font:16px sans-serif;padding:30px"><header><a href="/messages">消息 <span id="unread">0</span></a></header><h1>真实浏览器监测测试页面</h1><div id="latest">初始消息</div><textarea id="draft" placeholder="编辑草稿"></textarea><a href="/child" target="_blank" id="popup">弹出页面</a><script>window.setMessage = (count, value) => { document.querySelector('#unread').textContent = String(count); document.querySelector('#latest').textContent = value; };</script></body></html>`);
});
let desktop, window, base, sites;
async function check(name, callback) { await callback(); checks.push(name); console.log(`PASS ${name}`); }
const api = (action, payload) => window.evaluate(async ([name, data]) => { const result = await window.workdesk.call(name, data); if (!result.ok) throw new Error(result.error); return result.value; }, [action, payload]);
const current = () => api('state');
async function waitFor(predicate, message, timeout = 15000) { const until = Date.now() + timeout; while (Date.now() < until) { const state = await current(); if (predicate(state)) return state; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error(message); }
async function guest(id, code) {
  const site = sites.find(s => s.id === id);
  return desktop.evaluate(async ({ webContents }, { url, code }) => {
    const contents = webContents.getAllWebContents().find(wc => wc.getURL() === url);
    if (!contents) throw new Error(`Guest missing: ${url}`);
    return contents.executeJavaScript(code);
  }, { url: site.url, code });
}
async function launch() {
  const env = { ...process.env, RELAY_E2E: '1', RELAY_DATA_DIR: dataDir }; delete env.ELECTRON_RUN_AS_NODE;
  desktop = await electron.launch({ executablePath: require('electron'), args: [root], env, timeout: 30000 });
  desktop.process().stderr.on('data', chunk => { const value = String(chunk); if (/Unable to load preload|SyntaxError|ReferenceError|TypeError|Error occurred in handler/.test(value)) pageErrors.push(value); });
  const deadline = Date.now() + 15000;
  do { window = desktop.windows().find(page => page.url().startsWith('file:') && page.url().endsWith('/src/ui/index.html')); if (!window) await new Promise(resolve => setTimeout(resolve, 100)); } while (!window && Date.now() < deadline);
  if (!window) throw new Error('Desktop shell did not open');
  window.on('pageerror', error => pageErrors.push(error.message));
  try { await window.waitForSelector('.page-heading', { timeout: 12000 }); }
  catch (error) { console.error('Startup page:', await window.locator('body').innerText()); console.error('Page URL:', window.url()); console.error('Errors:', pageErrors); await window.screenshot({ path: path.join(resultsDir, 'startup-failure.png') }); throw error; }
  await waitFor(state => state.sites.length === 2 && state.sites.every(site => site.runtime.status === 'ready' && site.runtime.unread === 0), 'Both guests failed to connect');
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  sites = ['A','B'].map((letter, index) => validateSite({ name: `监测测试 ${letter}`, url: `${base}/site-${letter.toLowerCase()}`, color: index ? 'yellow' : 'orange', unreadSelector: '#unread', messageSelector: '#latest' }));
  fs.writeFileSync(path.join(dataDir, 'workspace.json'), JSON.stringify({ version: 1, settings: { ...DEFAULT_SETTINGS, notifications: false, sound: false }, sites, events: [] }));
  await launch();
  await check('desktop launches with two live background pages', async () => {
    const s = await current(); assert.equal(s.sites.length, 2); assert.ok(s.sites.every(site => site.runtime.lastSeen && site.runtime.unread === 0));
    await window.screenshot({ path: path.join(resultsDir, 'dashboard.png') });
  });
  await check('remote pages have no Node or privileged app bridge', async () => {
    const values = await guest(sites[0].id, '({node: typeof require, bridge: typeof workdesk, process: typeof process})');
    assert.deepEqual(values, { node: 'undefined', bridge: 'undefined', process: 'undefined' });
  });
  await check('messages from two hidden websites are detected independently', async () => {
    await guest(sites[0].id, 'setMessage(3,"客户 A：有新的设计需求")');
    await guest(sites[1].id, 'setMessage(2,"客户 B：请问是否方便沟通")');
    const s = await waitFor(s => s.events.filter(e => e.type === 'message').length === 2, 'Hidden pages did not emit both notifications');
    assert.equal(s.sites[0].runtime.unread, 3); assert.equal(s.sites[1].runtime.unread, 2);
  });
  await check('unchanged heartbeats do not duplicate message records', async () => {
    const count = (await current()).events.filter(e => e.type === 'message').length;
    await api('browser', { id: sites[0].id, command: 'sample' });
    await new Promise(resolve => setTimeout(resolve, 900));
    assert.equal((await current()).events.filter(e => e.type === 'message').length, count);
  });
  await check('a new preview triggers even when unread count stays the same', async () => {
    await guest(sites[0].id, 'setMessage(3,"客户 A：可以明天下午开始吗")');
    await waitFor(s => s.events.filter(e => e.type === 'message').length === 3, 'Same-count message change was missed');
  });
  await check('inbox filtering and mark-as-processed preserve website unread counts', async () => {
    await window.locator('[data-action="nav"][data-page="messages"]').first().click();
    await window.locator('[data-action="message-filter"][data-filter="unread"]').click();
    await window.waitForFunction(() => document.querySelectorAll('.message-row').length === 3);
    assert.equal(await window.locator('.message-row').count(), 3);
    await window.locator('[data-action="read-all"]').click();
    await waitFor(s => s.events.every(e => e.type !== 'message' || e.read), 'Mark all failed');
    assert.equal((await current()).sites[0].runtime.unread, 3);
  });
  await check('website browsing, bounds and modal overlay work', async () => {
    await window.locator(`.site-link[data-id="${sites[0].id}"]`).click();
    await window.waitForSelector('#browser-host');
    await new Promise(resolve => setTimeout(resolve, 350));
    const visible = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.filter(v => v.constructor.name === 'WebContentsView' && v.getVisible()).length);
    assert.equal(visible, 1);
    await window.locator('[data-action="rules"]').click();
    await window.waitForSelector('[role="dialog"]');
    const hidden = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.filter(v => v.constructor.name === 'WebContentsView' && v.getVisible()).length);
    assert.equal(hidden, 0);
    await window.screenshot({ path: path.join(resultsDir, 'rules.png') });
    await window.locator('[data-action="close-modal"]').first().click();
  });
  await check('invalid CSS rules are reported and do not crash monitoring', async () => {
    await api('save-site', { id: sites[0].id, unreadSelector: '[' });
    await waitFor(s => s.sites[0].runtime.ruleError.includes('无效'), 'Invalid rule was not reported');
    await api('save-site', { id: sites[0].id, unreadSelector: '#unread' });
    await waitFor(s => !s.sites[0].runtime.ruleError && s.sites[0].runtime.unread === 3, 'Rule recovery failed');
  });
  await check('persistent website sessions remain isolated', async () => {
    await guest(sites[0].id, 'document.cookie="account=A; max-age=86400; path=/"');
    await guest(sites[1].id, 'document.cookie="account=B; max-age=86400; path=/"');
    assert.match(await guest(sites[0].id, 'document.cookie'), /account=A/);
    assert.match(await guest(sites[1].id, 'document.cookie'), /account=B/);
  });
  await check('pause releases the website and resume reconnects it', async () => {
    await api('toggle-site', sites[1].id); assert.equal((await current()).sites[1].runtime.status, 'paused');
    await api('toggle-site', sites[1].id); await waitFor(s => s.sites[1].runtime.status === 'ready', 'Resume failed');
  });
  await check('unsafe URL inputs are rejected at the privileged boundary', async () => {
    const result = await window.evaluate(() => window.workdesk.call('save-site', { name: 'Unsafe', url: 'javascript:alert(1)' }));
    assert.equal(result.ok, false); assert.match(result.error, /HTTP/);
  });
  await check('closing the main window keeps monitoring alive in the tray', async () => {
    await api('window', 'close');
    const visible = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()); assert.equal(visible, false);
    await guest(sites[0].id, 'setMessage(4,"托盘运行期间收到的新消息")');
    await waitFor(s => s.sites[0].runtime.unread === 4 && s.events.some(e => e.body.includes('托盘运行')), 'Tray monitoring failed');
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  });
  await check('demo uses an actual isolated local web page and detects delayed messages', async () => {
    const result = await api('demo');
    await waitFor(s => s.sites.find(site => site.id === result.id)?.runtime.unread === 0, 'Demo did not initialize');
    await desktop.evaluate(async ({ webContents }) => { const wc = webContents.getAllWebContents().find(w => w.getURL().startsWith('http://127.0.0.1:') && !w.getURL().includes('/site-')); await wc.executeJavaScript('document.querySelector("#send").click()'); });
    await waitFor(s => s.events.some(e => e.demo && e.type === 'message'), 'Demo notification failed');
  });
  await api('navigate');
  await desktop.close(); desktop = null;
  dataDir = require('../src/profile.cjs').prepareProfile(profileRoot, 'win32');
  await check('settings and independent login sessions survive migrating the profile and restarting', async () => {
    await launch();
    assert.match(await guest(sites[0].id, 'document.cookie'), /account=A/);
    assert.match(await guest(sites[1].id, 'document.cookie'), /account=B/);
    const s = await current(); assert.equal(s.sites.length, 2); assert.ok(s.events.some(e => e.body.includes('托盘运行'))); assert.ok(!s.sites.some(site => site.demo));
  });
  await check('renderer and preload scripts complete without runtime errors', async () => { assert.deepEqual(pageErrors, []); });
  console.log(`\n${checks.length} desktop end-to-end checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(resultsDir, 'e2e-report.json'), JSON.stringify({ checks, pageErrors, passed: !process.exitCode, at: new Date().toISOString() }, null, 2));
  if (desktop) await desktop.close().catch(() => {}); server.close();
});
