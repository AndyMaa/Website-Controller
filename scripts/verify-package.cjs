// Run on the same architecture as the packaged app in an ephemeral CI runner.
const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const pkg = require('../package.json');
const arch = process.argv[2] || process.arch;
const output = path.resolve('dist');
const executablePath = process.platform === 'darwin'
  ? path.join(output, `mac${arch === 'arm64' ? '-arm64' : ''}`, `${pkg.build.productName}.app`, 'Contents', 'MacOS', pkg.build.executableName)
  : path.join(output, 'win-unpacked', `${pkg.build.executableName}.exe`);
let desktop;
(async () => {
  assert.equal(arch, process.arch, 'Package check must run natively');
  assert.ok(process.env.CI, 'Use an ephemeral CI runner for packaged checks');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath, env });
  const meta = await desktop.evaluate(({ app }) => ({ version: app.getVersion(), packaged: app.isPackaged, name: app.getName() }));
  assert.equal(meta.version, pkg.version); assert.equal(meta.packaged, true); assert.equal(meta.name, pkg.build.productName);
  let page;
  for (let i=0; i<100; i++) { page=desktop.windows().find(p=>p.url().startsWith('file:')); if(page)break; await new Promise(r=>setTimeout(r,100)); }
  assert.ok(page, 'Packaged UI opens'); await page.waitForSelector('.page-heading');
  console.log(`Packaged ${process.platform}/${arch} app opens: ${meta.version}`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (desktop) await desktop.close(); });
