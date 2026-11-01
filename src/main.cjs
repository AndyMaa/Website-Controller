const { app, BrowserWindow, WebContentsView, ipcMain, Menu, Tray, Notification, nativeImage, shell, dialog, powerMonitor, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Store, normalizeSettings, normalizeUrl, validateSite, unreadFromTitle, evaluateObservation, text } = require('./core.cjs');
const { startDemo } = require('./demo.cjs');
const { NetworkMonitor } = require('./network-monitor.cjs');

const testMode = process.env.RELAY_E2E === '1' && !app.isPackaged;
// Keep the established profile and session partitions when changing the display name.
app.setPath('userData', testMode && process.env.RELAY_DATA_DIR ? process.env.RELAY_DATA_DIR : path.join(app.getPath('appData'), process.platform === 'win32' ? '接单台' : 'Website Controller'));
app.setName('Website Controller');
if (process.platform === 'win32') app.setAppUserModelId('com.relay.workdesk');
const iconPath = path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const localUI = pathToFileURL(path.join(__dirname, 'ui', 'index.html')).href;
let store, win, tray, activeSite = null, overlay = false, quitting = false, demo, pendingPicker;
let viewBounds = null, stateTimer, heartbeatTimer, trayWasExplained = false;
const runtimes = new Map();
const popups = new Set();
const liveNotifications = new Set();
const configuredSessions = new WeakSet();
let lastSaveError = '';
function save() { try { store.flush(); lastSaveError = ''; } catch (error) { lastSaveError = `设置保存失败：${error.message}`; toast(lastSaveError); } }
function delayedSave() { clearTimeout(store.timer); store.timer = setTimeout(save, 350); store.timer.unref?.(); }
const siteById = id => store.data.sites.find(s => s.id === id);
function isWebUrl(value) { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }
function runtimeSnapshot(site) {
  const runtime = runtimes.get(site.id);
  if (!runtime) return { status: site.enabled ? 'idle' : 'paused', unread: null, title: '', url: site.url, lastSeen: null, source: '', loginRequired: false, blocked: false, ruleError: '', matched: false, hasDraft: false };
  return { status: runtime.status, unread: runtime.unread, title: runtime.title, url: runtime.url, lastSeen: runtime.lastSeen, source: runtime.source, network: runtime.network?.snapshot(), loginRequired: runtime.loginRequired, blocked: runtime.blocked, ruleError: runtime.ruleError, matched: runtime.matched, error: runtime.error, hasDraft: runtime.hasDraft, canGoBack: !runtime.view.webContents.isDestroyed() && runtime.view.webContents.navigationHistory.canGoBack(), canGoForward: !runtime.view.webContents.isDestroyed() && runtime.view.webContents.navigationHistory.canGoForward() };
}
function snapshot() {
  return { version: app.getVersion(), platform: process.platform, settings: store.data.settings, sites: store.data.sites.map(s => ({ ...s, runtime: runtimeSnapshot(s) })), events: store.data.events, warning: lastSaveError || store.warning, notificationSupported: Notification.isSupported(), dataPath: app.getPath('userData'), activeSite };
}
function broadcast(immediate = false) {
  const send = () => { if (win && !win.isDestroyed()) win.webContents.send('desk:state', snapshot()); updateTray(); };
  if (immediate) { clearTimeout(stateTimer); stateTimer=null; send(); }
  else if (!stateTimer) stateTimer=setTimeout(()=>{stateTimer=null;send();},80);
}
function toast(value) { if (win && !win.isDestroyed()) win.webContents.send('desk:toast', String(value)); }
function addEvent(site, type, title, body = '', source = '') {
  const event = { id: randomUUID(), siteId: site.id, siteName: site.name, type, title: text(title, 120), body: text(body, 400), source: text(source, 80), url: runtimes.get(site.id)?.url || site.url, at: Date.now(), read: type !== 'message', demo: !!site.demo };
  store.data.events.unshift(event);
  store.data.events = store.data.events.slice(0, 1500);
  delayedSave(); broadcast(); return event;
}
function showApp(siteId) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (siteId && siteById(siteId)) { selectSite(siteId); win.webContents.send('desk:navigate', { page: 'browser', siteId }); }
}
function notify(site, event) {
  const settings = store.data.settings;
  if (settings.quiet) return;
  if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true);
  if (!testMode && settings.notifications && Notification.isSupported()) {
    const notification = new Notification({ title: `${site.name} · ${event.title}`, body: event.body || '点击查看网站并处理消息', icon: iconPath, silent: !settings.sound, timeoutType: 'default' });
    liveNotifications.add(notification);
    notification.on('click', () => showApp(site.id));
    notification.on('close', () => liveNotifications.delete(notification));
    notification.on('failed', () => { liveNotifications.delete(notification); toast('Windows 通知未能显示，请检查系统通知设置'); });
    notification.show();
  }
  if (settings.sound && (testMode || !settings.notifications || !Notification.isSupported())) win?.webContents.send('desk:navigate', { sound: true });
}
function recordObservation(site, runtime, observation) {
  const result=evaluateObservation(runtime.baseline,observation);
  runtime.baseline=result.next;
  const now=Date.now();
  const explicitPush=observation.incoming===true;
  let alert=result.alert||explicitPush||observation.counterIncreased===true;
  if(!explicitPush&&!result.preview&&now-(runtime.lastPushAt||0)<1800)alert=false;
  if(explicitPush)runtime.lastPushAt=now;
  if(!alert)return;
  const item=addEvent(site,'message',explicitPush?'收到一条新消息':result.count===null?'消息有更新':`有 ${result.count} 条未读消息`,result.preview||'点击打开网站，查看最新消息。',observation.source||'页面监测');
  runtime.queuedNotification=item;
  const deliver=()=>{runtime.notificationTimer=null;runtime.lastNotificationAt=Date.now();if(runtime.queuedNotification){notify(site,runtime.queuedNotification);runtime.queuedNotification=null;}};
  if(now-runtime.lastNotificationAt>=1200){clearTimeout(runtime.notificationTimer);deliver();}
  else if(!runtime.notificationTimer)runtime.notificationTimer=setTimeout(deliver,1200-(now-runtime.lastNotificationAt));
}
function layout() {
  for (const [id, runtime] of runtimes) {
    const visible = id === activeSite && !overlay && viewBounds && win && !win.isDestroyed() && runtime.status !== 'error';
    runtime.view.setVisible(!!visible);
    if (visible) {
      const [width, height] = win.getContentSize();
      const x = Math.max(0, Math.min(Math.round(viewBounds.x), width - 1));
      const y = Math.max(0, Math.min(Math.round(viewBounds.y), height - 1));
      runtime.view.setBounds({ x, y, width: Math.max(1, Math.min(Math.round(viewBounds.width), width - x)), height: Math.max(1, Math.min(Math.round(viewBounds.height), height - y)) });
    }
  }
}
function sendRules(site, runtime) { if (!runtime.view.webContents.isDestroyed()) runtime.view.webContents.send('monitor:rules', { unreadSelector: site.unreadSelector, messageSelector: site.messageSelector }); }
function secureContents(contents) {
  contents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.control&&input.key.toLowerCase()==='k'){event.preventDefault();win?.webContents.send('desk:navigate',{commandPalette:true});}});
  contents.on('will-navigate', (event, url) => { if (!isWebUrl(url)) event.preventDefault(); });
  contents.on('will-redirect', (event, url) => { if (!isWebUrl(url)) event.preventDefault(); });
  contents.on('will-frame-navigate', (details) => { if (!isWebUrl(details.url) && details.url !== 'about:blank') details.preventDefault(); });
  contents.on('will-attach-webview', event => event.preventDefault());
}
function makeRuntime(site) {
  if (runtimes.has(site.id)) return runtimes.get(site.id);
  const view = new WebContentsView({ webPreferences: { partition: `persist:relay-${site.id}`, preload: path.join(__dirname, 'guest-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: false, spellcheck: true } });
  view.setBackgroundColor('#ffffff'); view.setBorderRadius(8); view.setVisible(false);
  win.contentView.addChildView(view);
  const runtime = { view, status: 'connecting', unread: null, title: '', url: site.url, source: '', matched: false, ruleError: '', lastSeen: null, baseline: {}, lastNotificationAt: 0, error: '', loginRequired: false, blocked: false, hasDraft: false, nextRefresh: Date.now() + site.refreshSeconds * 1000, failures: 0, nextRetry: 0 };
  runtimes.set(site.id, runtime);
  const contents = view.webContents;
  const networkOptions={
    pollEnabled:()=>store.data.settings.fastPolling,
    canPoll:()=>!runtime.blocked&&!runtime.loginRequired&&runtime.status==='ready',
    changed:()=>broadcast(),
    signal:signal=>{
      if(!siteById(site.id)?.enabled||runtime.blocked)return;
      runtime.networkSignal=signal;
      if(signal.unread!==null){runtime.unread=signal.unread;runtime.networkCountSignal=signal;}
      runtime.source=signal.source;runtime.matched=true;
      recordObservation(siteById(site.id),runtime,signal);broadcast();
    }
  };
  // Keep persistent sessions separate, but use Chromium's normal UA for website compatibility.
  contents.setUserAgent(contents.getUserAgent().replace(/\sElectron\/[\d.]+/g, '').replace(/\s(?:relay-workdesk|website-controller)\/[\d.]+/gi, ''));
  if (!configuredSessions.has(contents.session)) {
    configuredSessions.add(contents.session);
    contents.session.setPermissionCheckHandler(() => false);
    contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    contents.session.on('will-download', (_event, item) => {
      item.once('done', (_e, downloadState) => { toast(downloadState === 'completed' ? `下载完成：${item.getFilename()}` : `下载${downloadState === 'cancelled' ? '已取消' : '失败'}：${item.getFilename()}`); });
    });
  }
  secureContents(contents);
  contents.setWindowOpenHandler(({ url }) => isWebUrl(url) || url === 'about:blank' ? { action: 'allow', overrideBrowserWindowOptions: { width: 1040, height: 780, autoHideMenuBar: true, icon: iconPath, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, preload: path.join(__dirname, 'popup-preload.cjs') } } } : { action: 'deny' });
  contents.on('did-create-window', child => {
    popups.add(child); secureContents(child.webContents); child.setMenu(null);
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const title = () => { try { child.setTitle(`${site.name} · ${new URL(child.webContents.getURL()).host}`); } catch { child.setTitle(`${site.name} · 页面窗口`); } };
    child.webContents.on('page-title-updated', e => { e.preventDefault(); title(); });
    child.webContents.on('did-navigate', title);
    child.on('closed', () => { popups.delete(child); if (!contents.isDestroyed()) contents.send('monitor:sample-now'); });
  });
  contents.on('dom-ready', () => { sendRules(siteById(site.id) || site, runtime); });
  contents.on('did-start-loading', () => { runtime.status = 'connecting'; runtime.error = ''; broadcast(); });
  contents.on('did-finish-load', () => {
    if (contents.getURL() === 'about:blank') return;
    runtime.status = 'ready'; runtime.failures = 0; runtime.error = ''; runtime.url = contents.getURL(); runtime.title = contents.getTitle(); runtime.nextRefresh = Date.now() + (siteById(site.id)?.refreshSeconds || 0) * 1000;
    if (!runtime.connectedEvent) { runtime.connectedEvent = true; addEvent(site, 'system', '网站页面已打开', '请在网站内完成登录，并打开消息页以监测接单消息。'); }
    sendRules(siteById(site.id) || site, runtime); broadcast();
  });
  contents.on('did-navigate', (_e, url) => { runtime.url = url; broadcast(); });
  contents.on('did-navigate-in-page', (_e, url) => { runtime.url = url; contents.send('monitor:sample-now'); broadcast(); });
  contents.on('page-title-updated', (_event, title) => { runtime.title = text(title, 240); broadcast(); });
  contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    runtime.status = 'error'; runtime.error = `${description} (${code})`; runtime.failures++;
    runtime.nextRetry = Date.now() + Math.min(300000, 15000 * (2 ** Math.min(runtime.failures - 1, 5)));
    if (runtime.failures === 1) addEvent(site, 'system', '网站连接失败', runtime.error);
    layout(); broadcast();
  });
  contents.on('render-process-gone', (_event, details) => { runtime.status = 'error'; runtime.error = `页面进程已停止（${details.reason}）`; runtime.nextRetry = Date.now() + 15000; broadcast(); });
  contents.on('unresponsive', () => { runtime.status = 'stale'; runtime.error = '页面暂时未响应'; broadcast(); });
  contents.on('responsive', () => { contents.send('monitor:sample-now'); });
  // Create the renderer first, then enable capture before the first real website request.
  contents.loadURL('about:blank').then(async () => {
    if (contents.isDestroyed() || runtimes.get(site.id) !== runtime) return;
    runtime.network=new NetworkMonitor(contents,networkOptions);
    await runtime.network.ready;
    if (!contents.isDestroyed() && runtimes.get(site.id) === runtime && siteById(site.id)?.enabled) await contents.loadURL(site.url);
  }).catch(() => {});
  broadcast(); return runtime;
}
function closeRuntime(id) {
  const runtime = runtimes.get(id);
  if (!runtime) return;
  runtime.network?.close(); clearTimeout(runtime.notificationTimer);
  win?.contentView.removeChildView(runtime.view);
  if (!runtime.view.webContents.isDestroyed()) runtime.view.webContents.close({ waitForBeforeUnload: false });
  runtimes.delete(id);
  if (pendingPicker?.id === id) pendingPicker = null;
  layout();
}
function selectSite(id) {
  const site = siteById(id);
  if (!site) throw new Error('找不到这个网站');
  if (!site.enabled) { site.enabled = true; delayedSave(); }
  makeRuntime(site); activeSite = id; overlay = false; layout(); broadcast();
}
function fromGuest(event) {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return null;
  if (event.sender.getURL() === 'about:blank') return null;
  for (const [id, runtime] of runtimes) if (runtime.view.webContents === event.sender && !event.sender.isDestroyed()) return { site: siteById(id), runtime };
  return null;
}
ipcMain.on('monitor:ready', event => { const guest = fromGuest(event); if (guest?.site) sendRules(guest.site, guest.runtime); });
ipcMain.on('monitor:sample', (event, raw) => {
  const guest = fromGuest(event);
  if (!guest?.site || !raw || typeof raw !== 'object') return;
  const { site, runtime } = guest;
  const now = Date.now();
  if (now - (runtime.lastSampleAccepted || 0) < 40) return;
  runtime.lastSampleAccepted = now;
  runtime.lastSeen = now; runtime.title = text(raw.title, 240);
  runtime.loginRequired = raw.loginRequired === true; runtime.blocked = raw.blocked === true;
  runtime.hasDraft = raw.hasDraft === true; runtime.ruleError = text(raw.ruleError, 160);
  if (runtime.status !== 'error') runtime.status = raw.online === false ? 'offline' : 'ready';
  if (isWebUrl(raw.url)) runtime.url = text(raw.url, 2048);
  let count = Number.isInteger(raw.unread) && raw.unread >= 0 ? Math.min(raw.unread, 99999) : null;
  let source = count !== null ? text(raw.source, 80) : '';
  if (count === null && !site.unreadSelector) { count = unreadFromTitle(runtime.title); if (count !== null) source = '页面标题'; }
  const freshNetwork=runtime.networkSignal && now-runtime.networkSignal.at<15000;
  if(runtime.networkCountSignal&&now-runtime.networkCountSignal.at<15000){count=runtime.networkCountSignal.unread;source=runtime.networkCountSignal.source;}
  runtime.unread = count; runtime.source = source || (freshNetwork ? runtime.networkSignal.source : ''); runtime.matched = !!freshNetwork || raw.matched === true || count !== null || (!!site.messageSelector && !!raw.preview);
  if (!runtime.loginRequired && !runtime.blocked && runtime.status === 'ready' && !runtime.ruleError) {
    recordObservation(site,runtime,{unread:count,preview:raw.preview,source:source||'页面监测'});
  }
  broadcast();
});
ipcMain.on('monitor:picked', (event, raw) => {
  const guest = fromGuest(event);
  if (!guest?.site || pendingPicker?.id !== guest.site.id || !raw || typeof raw !== 'object') return;
  if (raw.cancelled) { pendingPicker = null; toast('已取消选取'); return; }
  if (raw.kind !== pendingPicker.kind || typeof raw.selector !== 'string' || !raw.selector || raw.selector.length > 800) return;
  guest.site[raw.kind === 'message' ? 'messageSelector' : 'unreadSelector'] = text(raw.selector, 800);
  guest.runtime.baseline = {};
  pendingPicker = null; delayedSave(); sendRules(guest.site, guest.runtime); broadcast();
  toast(`已设置${raw.kind === 'message' ? '消息正文' : '未读角标'}，可在监测规则中检查`);
});
function assertUI(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== localUI) throw new Error('不允许的调用来源');
}
ipcMain.on('desk:bounds', (event, value) => {
  try { assertUI(event); } catch { return; }
  if (!value || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(value[k]) && Math.abs(value[k]) < 30000)) return;
  viewBounds = value; layout();
});
async function action(actionName, payload) {
  switch (actionName) {
    case 'state': return snapshot();
    case 'navigate': activeSite = null; overlay = false; layout(); return null;
    case 'overlay': overlay = payload === true; layout(); return null;
    case 'select': selectSite(payload); return snapshot();
    case 'save-site': {
      const existing = payload?.id ? siteById(payload.id) : null;
      if (payload?.id && !existing) throw new Error('找不到这个网站');
      if (!existing && store.data.sites.length >= 500) throw new Error('当前工作空间已达到 500 个网站，请先整理不再使用的站点');
      const next = validateSite(payload, existing || {});
      if (existing) {
        const restart = next.url !== existing.url || next.enabled !== existing.enabled;
        Object.assign(existing, next);
        if (restart) { closeRuntime(next.id); if (next.enabled) makeRuntime(existing); }
        else { const runtime = runtimes.get(next.id); if (runtime) { runtime.baseline = {}; sendRules(existing, runtime); runtime.nextRefresh = Date.now() + next.refreshSeconds * 1000; } }
      } else { store.data.sites.push(next); if (next.enabled) makeRuntime(next); }
      delayedSave(); broadcast(); return next;
    }
    case 'toggle-site': {
      const site = siteById(payload); if (!site) throw new Error('找不到这个网站');
      site.enabled = !site.enabled;
      if (site.enabled) makeRuntime(site); else closeRuntime(site.id);
      delayedSave(); broadcast(); return null;
    }
    case 'delete-site': {
      const site = siteById(payload); if (!site) throw new Error('找不到这个网站');
      closeRuntime(site.id); if (activeSite === site.id) activeSite = null;
      store.data.sites = store.data.sites.filter(s => s.id !== site.id);
      store.data.events = store.data.events.filter(e => e.siteId !== site.id);
      delayedSave(); broadcast(); return null;
    }
    case 'clear-session': {
      const site = siteById(payload); if (!site) throw new Error('找不到这个网站');
      const runtime = runtimes.get(site.id), siteSession = runtime?.view.webContents.session || session.fromPartition(`persist:relay-${site.id}`);
      await siteSession.clearStorageData(); await siteSession.clearCache();
      if (runtime) { runtime.baseline = {}; runtime.view.webContents.reload(); } toast('已清除这个网站的登录状态'); return null;
    }
    case 'browser': {
      const site = siteById(payload?.id); if (!site) throw new Error('找不到这个网站');
      const runtime = makeRuntime(site), contents = runtime.view.webContents;
      if (payload.command === 'reload') { contents.reload(); }
      else if (payload.command === 'back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
      else if (payload.command === 'forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
      else if (payload.command === 'home') contents.loadURL(site.url).catch(() => {});
      else if (payload.command === 'go') { const url = normalizeUrl(payload.url); await contents.loadURL(url).catch(() => {}); }
      else if (payload.command === 'external') await shell.openExternal(normalizeUrl(runtime.url));
      else if (payload.command === 'use-current') { site.url = normalizeUrl(runtime.url); delayedSave(); toast('已设为监测起始页，下次启动将直接打开'); }
      else if (payload.command === 'sample') contents.send('monitor:sample-now');
      return null;
    }
    case 'pick': {
      if (!['unread', 'message'].includes(payload?.kind)) throw new Error('选取类型不正确');
      selectSite(payload.id); const runtime = runtimes.get(payload.id);
      if (runtime.status !== 'ready') throw new Error('请等待网站加载完成后再选取');
      pendingPicker = { id: payload.id, kind: payload.kind };
      runtime.view.webContents.send('monitor:pick', payload.kind); return null;
    }
    case 'read': for (const item of store.data.events) if (!payload || item.id === payload || item.siteId === payload) item.read = true; delayedSave(); broadcast(); return null;
    case 'clear-events': store.data.events = []; delayedSave(); broadcast(); return null;
    case 'settings': {
      const next = normalizeSettings(payload, store.data.settings);
      if (next.launchAtLogin !== store.data.settings.launchAtLogin) {
        if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) throw new Error('开机启动请使用安装后的应用');
        app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'] });
      }
      store.data.settings = next; delayedSave(); broadcast(); return null;
    }
    case 'notification-test': {
      const site = { id: '', name: 'Website Controller' };
      notify(site, { title: '通知测试', body: '看到这条通知，表示桌面提醒可以正常显示。' });
      toast(store.data.settings.quiet ? '当前处于免打扰，测试提醒已被静音' : '已发送测试提醒，请查看系统通知'); return null;
    }
    case 'demo': {
      if (!demo) demo = await startDemo();
      let site = store.data.sites.find(s => s.demo);
      if (!site) { site = validateSite({ name: '提醒演示', url: demo.url, color: 'mint', unreadSelector: '#unread', messageSelector: '#latest' }); site.demo = true; store.data.sites.push(site); }
      selectSite(site.id); broadcast(); return { id: site.id };
    }
    case 'export': {
      const result = await dialog.showSaveDialog(win, { title: '导出网站设置（不含登录凭据和消息）', defaultPath: 'Website Controller-网站设置.json', filters: [{ name: 'JSON 设置', extensions: ['json'] }] });
      if (!result.canceled && result.filePath) {
        const sites = store.data.sites.filter(s => !s.demo).map(({ name, url, color, unreadSelector, messageSelector, refreshSeconds, enabled }) => ({ name, url, color, unreadSelector, messageSelector, refreshSeconds, enabled }));
        fs.writeFileSync(result.filePath, JSON.stringify({ version: 1, sites }, null, 2), 'utf8'); toast('网站设置已导出');
      } return null;
    }
    case 'import': {
      const result = await dialog.showOpenDialog(win, { title: '导入网站设置', filters: [{ name: 'JSON 设置', extensions: ['json'] }], properties: ['openFile'] });
      if (result.canceled) return null;
      if (fs.statSync(result.filePaths[0]).size > 1024 * 1024) throw new Error('设置文件不能超过 1 MB');
      let raw; try { raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')); } catch { throw new Error('无法读取 JSON 设置文件'); }
      if (raw?.version !== 1 || !Array.isArray(raw.sites)) throw new Error('这不是有效的 Website Controller 设置文件');
      if (raw.sites.length + store.data.sites.length > 500) throw new Error('当前工作空间最多保存 500 个网站，请分批整理后导入');
      const sites = raw.sites.map(s => validateSite(s));
      store.data.sites.push(...sites); delayedSave(); for (const site of sites) if (site.enabled) makeRuntime(site); broadcast(); toast(`已导入 ${sites.length} 个网站`); return null;
    }
    case 'data-folder': await shell.openPath(app.getPath('userData')); return null;
    case 'batch-add': {
      if(!Array.isArray(payload?.urls)||payload.urls.length>100)throw new Error('每批可添加 100 个网站');
      const known=new Set(store.data.sites.map(s=>s.url));
      const urls=[...new Set(payload.urls.filter(u=>typeof u==='string'&&u.trim()).map(normalizeUrl))].filter(url=>!known.has(url));
      if(urls.length+store.data.sites.length>500)throw new Error('当前工作空间最多保存 500 个网站');
      const sites=urls.map((url,index)=>validateSite({name:new URL(url).hostname.replace(/^www\./,''),url,color:['blue','orange','mint','purple'][index%4],enabled:payload.enabled===true}));
      store.data.sites.push(...sites);save();sites.filter(s=>s.enabled).forEach((site,index)=>setTimeout(()=>{if(win&&!quitting&&siteById(site.id)?.enabled)makeRuntime(site);},index*350));broadcast();return {added:sites.length};
    }
    case 'window': if (payload === 'minimize') win.minimize(); else if (payload === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize(); else if (payload === 'close') win.close(); else if (payload === 'quit') { quitting = true; app.quit(); } return null;
    default: throw new Error('不支持的操作');
  }
}
ipcMain.handle('desk:action', async (event, name, payload) => {
  try { assertUI(event); return { ok: true, value: await action(name, payload) }; }
  catch (error) { return { ok: false, error: text(error.message, 240) }; }
});
function updateTray() {
  if (!tray || tray.isDestroyed() || !store) return;
  const unread = store.data.events.filter(e => e.type === 'message' && !e.read).length;
  tray.setToolTip(`Website Controller · ${unread ? `${unread} 条待处理提醒` : `${store.data.sites.filter(s => s.enabled).length} 个网站后台监测中`}`);
}
function createTray() {
  const trayImage = nativeImage.createFromPath(iconPath);
  tray = new Tray(process.platform === 'darwin' ? trayImage.resize({ width: 20, height: 20 }) : trayImage);
  const menu = () => Menu.buildFromTemplate([
    { label: '打开 Website Controller', click: () => showApp() },
    { type: 'separator' },
    ...store.data.sites.slice(0, 15).map(s => ({ label: s.name, click: () => showApp(s.id) })),
    { type: 'separator' },
    { label: '免打扰', type: 'checkbox', checked: store.data.settings.quiet, click: item => { store.data.settings.quiet = item.checked; delayedSave(); broadcast(); } },
    { label: '退出 Website Controller', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.on('click', () => showApp()); tray.on('double-click', () => showApp());
  tray.on('right-click', () => tray.popUpContextMenu(menu())); updateTray();
}
function createWindow() {
  win = new BrowserWindow({ width: 1380, height: 900, minWidth: 1060, minHeight: 700, show: false, frame: false, backgroundColor: store.data.settings.darkMode ? '#18191a' : '#fcfbf9', icon: iconPath, title: 'Website Controller', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  if (process.platform !== 'darwin') win.setMenu(null);
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('focus', () => win.flashFrame(false));
  win.on('resize', () => layout());
  win.on('close', event => {
    if (!quitting && store.data.settings.closeToTray && tray && !tray.isDestroyed()) {
      event.preventDefault(); win.hide();
      if (!trayWasExplained) { trayWasExplained = true; if (!testMode && process.platform === 'win32') tray.displayBalloon({ title: 'Website Controller 仍在后台运行', content: '网站监测继续运行，点击托盘图标可重新打开。右键图标可退出。', icon: iconPath }); }
    } else { quitting = true; }
  });
  win.on('closed', () => { win = null; app.quit(); });
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
}
const locked = testMode || app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', () => showApp());
  app.on('activate', () => { if (win) showApp(); });
  app.whenReady().then(() => {
    store = new Store(app.getPath('userData'));
    // Update an existing startup entry after the executable rename; retain OS-disabled state.
    if (process.platform === 'win32' && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && store.data.settings.launchAtLogin) {
      const legacyStartup = app.getLoginItemSettings({ path: path.join(path.dirname(process.execPath), '接单台.exe'), args: ['--hidden'] });
      const legacyItem = legacyStartup.launchItems.find(item => item.name === 'com.relay.workdesk');
      if (legacyItem) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'], enabled: legacyItem.enabled });
    }
    if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
    createWindow(); createTray();
    store.data.sites.filter(s => s.enabled).forEach((s, index) => setTimeout(() => { if (win && !quitting) makeRuntime(s); }, index * 500));
    heartbeatTimer = setInterval(() => {
      let changed = false;
      const now = Date.now();
      for (const [id, runtime] of runtimes) {
        const site = siteById(id);
        if (!site) continue;
        if (runtime.status === 'ready' && runtime.lastSeen && now - runtime.lastSeen > 30000) { runtime.status = 'stale'; changed = true; }
        if ((runtime.status === 'error' || runtime.status === 'offline') && now >= runtime.nextRetry && runtime.nextRetry) { runtime.nextRetry = now + 60000; runtime.view.webContents.reload(); }
        if (site.refreshSeconds && now >= runtime.nextRefresh && activeSite !== id && !runtime.hasDraft && runtime.status === 'ready' && !runtime.loginRequired && !runtime.blocked) { runtime.nextRefresh = now + site.refreshSeconds * 1000; runtime.view.webContents.reload(); }
      }
      if (changed) broadcast();
    }, 5000);
    powerMonitor.on('resume', () => { for (const runtime of runtimes.values()) runtime.view.webContents.send('monitor:sample-now'); });
  }).catch(error => { dialog.showErrorBox('Website Controller 启动失败', error.message); app.quit(); });
  app.on('before-quit', () => {
    quitting = true; clearInterval(heartbeatTimer); clearTimeout(stateTimer);
    for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
    for (const id of [...runtimes.keys()]) closeRuntime(id);
    demo?.server.close(); if (store) save(); tray?.destroy();
  });
  app.on('window-all-closed', () => app.quit());
}
