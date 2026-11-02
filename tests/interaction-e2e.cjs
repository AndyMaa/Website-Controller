const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { validateSite, DEFAULT_SETTINGS } = require('../src/core.cjs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results');
const data = path.join(out, `interaction-${randomUUID()}`); fs.mkdirSync(data, { recursive: true });
let desktop, page;
const checks = [], errors = [], measurements = {};
const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<title>Live fixture</title><h1>Local page</h1><textarea placeholder="Website draft"></textarea>'); });
const api = (action, payload) => page.evaluate(async ([action, payload]) => { const r = await window.workdesk.call(action, payload); if (!r.ok) throw new Error(r.error); return r.value; }, [action, payload]);
async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
async function push(update = {}) {
  const snapshot = await api('state'); snapshot.sites[0].runtime.lastSeen = Date.now(); Object.assign(snapshot.sites[0].runtime, update);
  await desktop.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('file:')).webContents.send('desk:state', value), snapshot);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const site = validateSite({ name: '交互验证', url: `http://127.0.0.1:${server.address().port}` });
  const sites = [site, ...Array.from({length:99}, (_,i) => validateSite({ name: `工作平台 ${i}`, url: `https://fixture-${i}.example`, enabled: false }))];
  fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify({ version: 1, settings: { ...DEFAULT_SETTINGS, notifications: false, sound: false }, sites, events: [] }));
  const env = { ...process.env, RELAY_E2E: '1', RELAY_DATA_DIR: data }; delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath: require('electron'), args: [root], env });
  for(let i=0;i<100;i++){page=desktop.windows().find(w=>w.url().startsWith('file:'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  page.on('pageerror', error => errors.push(error.message)); await page.waitForSelector('.page-heading');
  await check('heartbeat and unread changes preserve buttons, icons and editable text with 100 sites', async () => {
    await page.evaluate(() => { window.savedButton=document.querySelector('[data-action="add"]');window.savedLogo=document.querySelector('.brand-icon'); window.savedQuiet=document.querySelector('.quiet-button'); });
    const input=page.locator('#quick-url');await input.fill('https://draft.example/messages');await input.evaluate(el=>el.setSelectionRange(8,13));
    for(let i=0;i<20;i++)await push({ unread:i%4 });
    const unchanged=await page.evaluate(()=>({button:window.savedButton===document.querySelector('[data-action="add"]'),logo:window.savedLogo===document.querySelector('.brand-icon'),quiet:window.savedQuiet===document.querySelector('.quiet-button'),value:document.activeElement.value,selection:[document.activeElement.selectionStart,document.activeElement.selectionEnd]}));
    assert.deepEqual(unchanged,{button:true,logo:true,quiet:true,value:'https://draft.example/messages',selection:[8,13]});
  });
  await check('a click held across a background update opens the intended dialog',async()=>{
    const box=await page.locator('.heading-actions [data-action="add"]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await push({unread:7});await page.mouse.up();await page.waitForSelector('#site-form',{timeout:1500});
    await page.locator('[data-action="close-modal"]').first().click();
  });
  await check('rapid navigation stays responsive without leaving stacked animations',async()=>{
    for(let i=0;i<8;i++){const began=Date.now();await page.locator('.nav-button[data-page="'+(i%2?'dashboard':'sites')+'"]').click();await page.waitForSelector(i%2?'.summary-strip':'.management-grid');measurements.maxNavigationMs=Math.max(measurements.maxNavigationMs||0,Date.now()-began);}
    assert.ok(await page.evaluate(()=>document.querySelector('#content').getAnimations().length<=1));
  });
  await check('focused address and native website view stay in place during updates',async()=>{
    await page.locator('.site-link[data-id="'+site.id+'"]').click();await page.waitForSelector('#address');await page.locator('#address').fill('https://unsent.example/draft');
    await page.evaluate(()=>{window.savedAddress=document.querySelector('#address');window.savedHost=document.querySelector('#browser-host');});
    await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:'));global.viewChanges={bounds:0,visibility:0};for(const v of w.contentView.children){const b=v.setBounds.bind(v),s=v.setVisible.bind(v);v.setBounds=(...a)=>{global.viewChanges.bounds++;return b(...a);};v.setVisible=(...a)=>{global.viewChanges.visibility++;return s(...a);};}});
    for(let i=0;i<12;i++)await push();
    assert.ok(await page.evaluate(()=>window.savedAddress===document.querySelector('#address')&&window.savedHost===document.querySelector('#browser-host')));
    assert.equal(await page.locator('#address').inputValue(),'https://unsent.example/draft');
    measurements.nativeViewChanges=await desktop.evaluate(()=>global.viewChanges);assert.equal(measurements.nativeViewChanges.bounds,0);assert.equal(measurements.nativeViewChanges.visibility,0);
  });
  await check('notification delivery no longer flashes the taskbar',async()=>{
    await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:'));global.flashCalls=0;w.isFocused=()=>false;w.flashFrame=()=>{global.flashCalls++;};});
    await api('notification-test');assert.equal(await desktop.evaluate(()=>global.flashCalls),0);
    assert.deepEqual(errors,[]);
  });
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'interaction-report.json'),JSON.stringify({passed:!process.exitCode,checks,measurements,errors},null,2));if(desktop)await desktop.close();server.close();});
