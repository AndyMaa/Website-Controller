// Opens only public pages in fresh sessions; does not log in or solve site challenges.
const { _electron } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results'); fs.mkdirSync(output, { recursive: true });
const dataDir = path.join(output, `public-sites-${randomUUID()}`);
let desktop;
(async () => {
  const env = { ...process.env, RELAY_E2E: '1', RELAY_DATA_DIR: dataDir }; delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath: require('electron'), args: [root], env });
  let page;
  for (let attempt = 0; attempt < 100; attempt++) { page = desktop.windows().find(p => p.url().startsWith('file:')); if (page) break; await new Promise(r => setTimeout(r, 100)); }
  await page.waitForSelector('.page-heading');
  let state;
  for (let attempt = 0; attempt < 40; attempt++) {
    state = (await page.evaluate(() => window.workdesk.call('state'))).value;
    if (state.sites.every(s => ['ready', 'error'].includes(s.runtime.status) && (s.runtime.lastSeen || s.runtime.status === 'error'))) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  await new Promise(r => setTimeout(r, 1000));
  state = (await page.evaluate(() => window.workdesk.call('state'))).value;
  const report = { at: new Date().toISOString(), sites: state.sites.map(({ name, url, runtime }) => ({ name, url, runtime })) };
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(output, 'public-sites-report.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(output, 'real-dashboard.png') });
  for (const site of state.sites) {
    await page.evaluate(id => window.workdesk.call('select', id), site.id);
    await page.locator(`.site-link[data-id="${site.id}"]`).click();
    await page.waitForSelector('#browser-host');
    await new Promise(r => setTimeout(r, 700));
    const capture = await desktop.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(output, site.name === '光厂' ? 'real-guangchang.png' : 'real-zcool.png'), Buffer.from(capture, 'base64'));
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (desktop) await desktop.close(); });
