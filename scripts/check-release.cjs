// Read-only startup check of the packaged application, using its normal data directory.
const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
let desktop;
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.RELAY_E2E;
  delete env.RELAY_DATA_DIR;
  const executablePath = process.env.RELAY_RELEASE_EXE || path.join(root, pkg.build.directories.output, 'win-unpacked', `${pkg.build.executableName || pkg.build.productName}.exe`);
  desktop = await _electron.launch({ executablePath, env });
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    page = desktop.windows().find(candidate => candidate.url().startsWith('file:'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'packaged desktop window opens');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.page-heading');
  const meta = await desktop.evaluate(({ app }) => ({ version: app.getVersion(), packaged: app.isPackaged }));
  const state = await page.evaluate(async () => {
    const response = await window.workdesk.call('state');
    return { ok: response.ok, version: response.value.version, sites: response.value.sites.length, warning: response.value.warning };
  });
  assert.equal(meta.version, pkg.version);
  assert.equal(meta.packaged, true);
  assert.equal(state.version, pkg.version);
  assert.equal(state.warning, '');
  assert.deepEqual(errors, []);
  const report = { passed: true, at: new Date().toISOString(), ...meta, loadedSiteCount: state.sites, errors };
  fs.writeFileSync(path.join(root, 'test-results', 'release-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (desktop) await desktop.close(); });
