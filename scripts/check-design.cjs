// Visual QA in an isolated profile; never opens the user's authenticated pages.
const { _electron } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results');
const data = path.join(out, `design-${randomUUID()}`);
fs.mkdirSync(data, { recursive: true });
let desktop;
(async () => {
  const env = { ...process.env, RELAY_E2E: '1', RELAY_DATA_DIR: data }; delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath: require('electron'), args: [root], env });
  let page;
  for (let n = 0; n < 100; n++) {
    page = desktop.windows().find(p => p.url().startsWith('file:'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await page.waitForSelector('.page-heading');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const api = (action, payload) => page.evaluate(([action, payload]) => window.workdesk.call(action, payload), [action, payload]);
  await api('settings', { notifications: false, sound: false, reducedMotion: true });
  await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduce');
  const report = { version: await desktop.evaluate(({ app }) => app.getVersion()), views: [], errors };
  for (const darkMode of [false, true]) {
    await api('settings', { darkMode });
    await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, darkMode ? 'dark' : 'light');
    await page.screenshot({ path: path.join(out, `website-controller-${darkMode ? 'dark' : 'light'}.png`) });
    report.views.push(await page.evaluate(() => {
      const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const background = getComputedStyle(document.body).backgroundColor;
      return { theme: document.documentElement.dataset.theme, text: ['.summary-strip>button span', '.connection-info strong', '.connection-info small', '.site-state', '.connection-state>small', '.quiet-empty h3', '.quiet-empty p'].map(selector => {
        const style = getComputedStyle(document.querySelector(selector));
        const levels = [lum(rgb(style.color)), lum(rgb(background))].sort((a, b) => b - a);
        return { selector, size: style.fontSize, family: style.fontFamily, contrast: Number(((levels[0] + .05) / (levels[1] + .05)).toFixed(2)) };
      }) };
    }));
  }
  await page.locator('.dashboard-grid').scrollIntoViewIfNeeded();
  const { strip, grid, viewport } = await page.evaluate(() => ({ strip: document.querySelector('.summary-strip').getBoundingClientRect().toJSON(), grid: document.querySelector('.dashboard-grid').getBoundingClientRect().toJSON(), viewport: { width: innerWidth, height: innerHeight } }));
  await page.screenshot({ path: path.join(out, 'website-controller-reading.png'), clip: { x: strip.x, y: strip.y, width: strip.width, height: Math.min(viewport.height - strip.y - 4, grid.y + grid.height - strip.y) } });
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('file:')).setSize(1060, 760));
  await page.screenshot({ path: path.join(out, 'website-controller-compact.png') });
  report.compactOverflow = await page.evaluate(() => { const el=document.querySelector('#content'); return el.scrollWidth>el.clientWidth; });
  await page.locator('[data-page="settings"]').first().click();
  await page.waitForSelector('.settings-card');
  await page.screenshot({ path: path.join(out, 'website-controller-settings.png') });
  await page.locator('[data-action="add"]').first().click();
  await page.waitForSelector('.modal');
  await page.screenshot({ path: path.join(out, 'website-controller-dialog.png') });
  fs.writeFileSync(path.join(out, 'design-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (desktop) await desktop.close(); });
