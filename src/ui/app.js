/* All website-supplied strings are escaped before reaching HTML. Remote pages never receive this bridge. */
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  inbox: '<path d="M4 4h16l2 12v4H2v-4L4 4Z"/><path d="M2 15h6l2 3h4l2-3h6"/><path d="M8 8h8M8 11h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  settings: '<path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.5 1.7 1.7v2.4l-1.7 1.7 2 3.5 2.3-.7 2 .9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.5-1.7-1.7v-2.4l1.7-1.7-2-3.5-2.3.7-2-.9L13 3H9Z"/><circle cx="11" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  moon: '<path d="M20 14a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>', checks: '<path d="m2 12 4 4L16 6m-5 9 2 2L23 7"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 9-8 9s-8-4-8-9V6l8-4Z"/><path d="m8 11 3 3 5-5"/>',
  link: '<path d="m10 7 2-2a5 5 0 0 1 7 7l-3 3a5 5 0 0 1-7 0m5 2-2 2a5 5 0 0 1-7-7l3-3a5 5 0 0 1 7 0"/>',
  message: '<path d="M21 4H3v13h5l4 4 4-4h5V4Z"/><path d="M7 9h10M7 12h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  reload: '<path d="M20 8a8.5 8.5 0 1 0 1 8M20 3v6h-6"/>',
  pause: '<path d="M8 4v16M16 4v16"/>', play: '<path d="m7 4 14 8-14 8V4Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>', minimize: '<path d="M4 12h16"/>', maximize: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14l-1 7Z"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  folder: '<path d="M3 5h7l2 3h9v12H3V5Z"/>', warning: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  logo: '<rect x="3" y="3" width="13" height="10" rx="3"/><path d="M7 13v4l4-4"/><path d="M16 8h2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-4 2v-2H9a3 3 0 0 1-3-3"/>'
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const e = escape;
let previousRoute = '', state, page = 'dashboard', selectedSite, search = '', messageFilter = 'all', messageSite = '', siteFilter = 'all', modal = null, renderPending = false;
const content = document.querySelector('#content');
const names = { dashboard: '工作总览', messages: '消息中心', sites: '网站管理', settings: '偏好设置', browser: '网站工作台' };
const findSite = id => state?.sites.find(s => s.id === id);
const messages = () => state.events.filter(event => event.type === 'message');
const pending = () => messages().filter(event => !event.read);
const formatTime = at => at ? new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '尚未检查';
const fullTime = at => new Date(at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const host = url => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url || ''; } };
const avatar = site => `<span class="avatar ${e(site?.color || 'blue')}">${e(site?.name === '站酷' ? 'Z' : site?.name === '光厂' ? '光' : (site?.name || '?').slice(0, 1))}</span>`;
const today = at => new Date(at).toDateString() === new Date().toDateString();
const attention = site => ['error', 'offline', 'stale'].includes(site.runtime.status) || site.runtime.loginRequired || site.runtime.blocked || site.runtime.ruleError;
function status(site) {
  const r = site.runtime;
  if (!site.enabled || r.status === 'paused') return { label: '已暂停', cls: 'paused', detail: '恢复监测后，将重新打开网站页面。' };
  if (r.status === 'error') return { label: '连接失败', cls: 'error', detail: r.error || '网站暂时无法访问，正在等待重试。' };
  if (r.status === 'offline') return { label: '网络离线', cls: 'error', detail: '请检查网络连接。' };
  if (r.status === 'stale') return { label: '等待页面响应', cls: 'wait', detail: '超过 30 秒未收到页面心跳，请打开检查。' };
  if (r.status === 'idle' || r.status === 'connecting') return { label: '连接中', cls: 'connecting', detail: '正在打开网站，等待页面返回。' };
  if (r.blocked) return { label: '需要验证', cls: 'wait', detail: '网站正在进行安全验证，请在页面内处理。' };
  if (r.loginRequired) return { label: '请检查登录', cls: 'wait', detail: '页面存在登录入口或登录表单，请登录后打开消息页。' };
  if (r.ruleError) return { label: '规则需调整', cls: 'wait', detail: r.ruleError };
  if (r.matched) return { label: r.source?.includes('接口') ? '接口已连接' : r.source?.includes('推送') ? '推送已连接' : '页面识别已就绪', cls: '', detail: r.source ? `正在通过${r.source}识别未读提示。` : '已选取消息区域，内容变化时将提醒。' };
  return { label: '页面守候中', cls: '', detail: '自动发现正在运行。打开网站消息页，可帮助识别更多消息来源。' };
}
const statusBadge = site => { const value = status(site); return `<span class="site-state ${value.cls}">${e(value.label)}</span>`; };
const btn = (action, label, glyph = '', cls = '', attrs = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${glyph ? icon(glyph) : ''}${label}</button>`;
const ibtn = (action, label, glyph, attrs = '') => `<button class="icon-button" data-action="${action}" title="${e(label)}" aria-label="${e(label)}" ${attrs}>${icon(glyph)}</button>`;
function emptyArt() { return '<svg class="illustration" viewBox="0 0 140 92" fill="none" aria-hidden="true"><ellipse cx="70" cy="81" rx="47" ry="6" fill="#f0f5f4"/><rect x="32" y="14" width="61" height="46" rx="7" fill="#f1f7f5" stroke="#c4d9d2"/><path d="M44 28h34M44 36h27M44 44h17" stroke="#cfdfd9" stroke-width="3" stroke-linecap="round"/><path d="M30 43h74l8 29a5 5 0 0 1-5 6H27a5 5 0 0 1-5-6l8-29Z" fill="#fff" stroke="#c8dcd5"/><path d="M24 63h25l7 8h22l7-8h25" stroke="#c8dcd5"/><circle cx="107" cy="23" r="12" fill="#e4f4ec"/><path d="m102 23 3 3 6-7" stroke="#76af99" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="32" r="2" fill="#d4e5df"/><path d="M117 45h7m-3.5-3.5v7" stroke="#d4e5df" stroke-linecap="round"/></svg>'; }
function heading(title, description, actions = '', eyebrow = '') {
  return `<div class="page-heading"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
async function call(action, payload) {
  const result = await window.workdesk.call(action, payload);
  if (!result?.ok) throw new Error(result?.error || '操作未完成');
  return result.value;
}
function toast(message) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; el.setAttribute('role', 'status');
  document.querySelector('#toasts').append(el); setTimeout(() => el.remove(), 4500);
}
function siteCard(site, management = false) {
  const r = site.runtime, value = status(site);
  return `<article class="site-card" data-site="${e(site.id)}"><div class="site-card-head">${avatar(site)}<div class="site-card-title"><h3>${e(site.name)}${site.demo ? '<span class="badge-demo">本地演示</span>' : ''}</h3><p>${e(host(site.url))}</p></div>${ibtn('site-menu','网站设置','more',`data-id="${e(site.id)}"`)}</div><div class="site-card-body">${statusBadge(site)}<div class="unread-row"><span>网站未读提示</span><span class="unread-value ${r.unread > 0 ? 'hot' : r.unread === null ? 'unknown' : ''}">${r.unread === null ? '—' : r.unread}</span></div><div class="signal-note" title="${e(value.detail)}">${e(value.detail)}</div></div><div class="site-card-footer"><span class="last-check">${r.lastSeen ? `检查于 ${formatTime(r.lastSeen)}` : '等待页面检查'}</span><div class="site-actions">${management ? ibtn('toggle-site',site.enabled ? '暂停监测' : '恢复监测',site.enabled ? 'pause' : 'play',`data-id="${e(site.id)}"`) : ''}${btn('open','打开网站','arrow','text small',`data-id="${e(site.id)}"`)}</div></div></article>`;
}
function addCard() { return `<button class="add-card" data-action="add">${icon('plus')}<strong>连接更多网站</strong><span>一个工作台，多个机会</span></button>`; }
function activityList() {
  const events = state.events.slice(0, 5);
  if (!events.length) return `<div class="empty-state">${emptyArt()}<h3>一切就绪，等待新的联系</h3><p>登录网站并打开消息页后，<br>检测到的消息变化会显示在这里。</p></div>`;
  return events.map(event => `<div class="activity-item"><div class="activity-glyph ${event.type}">${icon(event.type === 'message' ? 'message' : 'link')}</div><div class="activity-copy"><div class="activity-line"><span>${e(event.siteName)}</span><time>${formatTime(event.at)}</time></div><h3>${e(event.title)}</h3><p>${e(event.body)}</p></div></div>`).join('');
}
function sitesPage() {
  const sites = state.sites.filter(site => (!search || `${site.name} ${site.url}`.toLowerCase().includes(search.toLowerCase())) && (siteFilter !== 'attention' || attention(site)));
  return `${heading('所有连接','独立保留各站登录状态，随时切换与管理。',btn('batch','批量添加','plus') + btn('import','导入设置','upload') + btn('add','添加连接','plus','primary'),'CONNECTED WEBSITES')}<div class="toolbar"><div class="toolbar-group"><div class="search">${icon('search')}<input id="search" aria-label="搜索网站" placeholder="搜索网站名称或网址" value="${e(search)}"></div><div class="segmented"><button data-action="site-filter" data-filter="all" class="${siteFilter === 'all' ? 'active' : ''}">全部网站</button><button data-action="site-filter" data-filter="attention" class="${siteFilter === 'attention' ? 'active' : ''}">需要关注</button></div></div><span class="section-label">${sites.length} 个网站</span></div>${sites.length ? `<div class="management-grid">${sites.map(site => siteCard(site,true)).join('')}${addCard()}</div>` : `<div class="activity-panel empty-state empty-large">${emptyArt()}<h3>${search || siteFilter === 'attention' ? '没有符合条件的网站' : '连接你的第一个接单网站'}</h3><p>${search || siteFilter === 'attention' ? '可以切换筛选条件或搜索其他关键词。' : '添加网址后，即可在软件中打开、登录和设置消息监测。'}</p>${btn('add','添加网站','plus','primary')}</div>`}<div class="info-line">${icon('info')}同一个网站可以添加多次，分别登录不同账号。暂停监测后，该站点页面会停止运行。</div>`;
}
function messagesPage() {
  const events = state.events.filter(item => (messageFilter !== 'unread' || (item.type === 'message' && !item.read)) && (messageFilter !== 'messages' || item.type === 'message') && (!messageSite || item.siteId === messageSite) && (!search || `${item.title} ${item.body} ${item.siteName}`.toLowerCase().includes(search.toLowerCase())));
  return `${heading('消息中心','汇总页面中检测到的消息提示、内容变化和连接活动。',btn('clear-events','清空记录','trash') + btn('read-all','全部设为已处理','checks','primary'),'ACTIVITY & MESSAGES')}<div class="toolbar"><div class="toolbar-group"><div class="segmented"><button data-action="message-filter" data-filter="all" class="${messageFilter === 'all' ? 'active' : ''}">全部活动</button><button data-action="message-filter" data-filter="messages" class="${messageFilter === 'messages' ? 'active' : ''}">消息提醒</button><button data-action="message-filter" data-filter="unread" class="${messageFilter === 'unread' ? 'active' : ''}">待处理 ${pending().length || ''}</button></div><select id="message-site" class="filter-select" aria-label="筛选消息网站"><option value="">全部网站</option>${state.sites.map(site => `<option value="${e(site.id)}" ${messageSite === site.id ? 'selected' : ''}>${e(site.name)}</option>`).join('')}</select></div><div class="search">${icon('search')}<input id="search" aria-label="搜索活动" value="${e(search)}" placeholder="搜索消息与活动"></div></div><div class="inbox-list">${events.length ? events.slice(0,150).map(item => {
    const site = findSite(item.siteId) || { name: item.siteName, color: 'blue' };
    return `<article class="message-row ${item.type === 'message' && !item.read ? 'unread' : ''}" data-event="${e(item.id)}">${avatar(site)}<div class="message-body"><div class="message-meta"><strong>${e(item.siteName)}</strong><span class="message-tag ${item.type}">${item.type === 'message' ? (item.read ? '已处理' : '消息提醒') : '连接活动'}${item.demo ? ' · 演示' : ''}</span><time>${fullTime(item.at)}</time></div><h3>${e(item.title)}</h3><p>${e(item.body)}</p><div class="message-row-actions">${findSite(item.siteId) ? btn('open-event','打开网站','arrow','text small',`data-id="${e(item.siteId)}" data-event-id="${e(item.id)}"`) : ''}${item.type === 'message' && !item.read ? btn('read','设为已处理','check','text small',`data-id="${e(item.id)}"`) : ''}<span class="source">${e(item.source)}</span></div></div></article>`;
  }).join('') : `<div class="empty-state empty-large">${emptyArt()}<h3>${search || messageFilter !== 'all' || messageSite ? '当前没有符合条件的活动' : '消息抵达时，会出现在这里'}</h3><p>先登录接单网站并打开消息页。<br>也可以使用本地演示体验提醒流程。</p>${btn('demo','体验一次提醒','play','primary')}</div>`}</div>${events.length > 150 ? `<div class="info-line">显示最近 150 条，共 ${events.length} 条。可用网站筛选和搜索缩小范围。</div>` : ''}<div class="info-line">${icon('info')}“设为已处理”只更新Website Controller中的提醒记录。网站中的未读状态仍由网站自身管理。</div>`;
}
function settingRow(key, label, description) { return `<div class="setting-row"><div><div class="setting-label">${label}</div><div class="setting-description">${description}</div></div><button class="toggle ${state.settings[key] ? 'on' : ''}" role="switch" aria-checked="${state.settings[key]}" aria-label="${label}" data-action="setting" data-key="${key}"></button></div>`; }
function settingsPage() {
  return `${heading('偏好设置','设置提醒方式、后台行为与网站配置。','','PREFERENCES')}<div class="settings-grid"><div><section class="settings-card"><h2>消息与提醒</h2><p class="settings-caption">消息先汇总到本地，再按你的偏好提醒。</p>${settingRow('fastPolling','加速消息检查','对已确认的同源未读计数接口，每 3 秒检查一次；网站限流时自动退避。')}${settingRow('notifications','桌面通知','新消息变化出现时，在桌面显示提醒；点击通知可返回网站。')}${settingRow('sound','提醒声音','桌面通知使用系统提示音；关闭桌面通知时使用软件提示音。')}${settingRow('quiet','免打扰','继续监测和记录消息，暂停桌面通知和声音。')}<div class="settings-actions">${btn('notification-test','发送测试提醒','bell','small')}</div><div class="info-line">${icon('info')}${state.notificationSupported ? '通知显示还取决于 系统通知和勿扰设置。' : '当前系统未报告桌面通知支持，消息仍会在软件中记录。'}</div></section><section class="settings-card"><h2>外观与运行方式</h2><p class="settings-caption">保持软件运行，才能继续监测网站。</p>${settingRow('darkMode','深色外观','石墨灰背景，适合夜间或长时间工作。')}${settingRow('reducedMotion','减少动态效果','关闭页面与弹窗的过渡动画。')}${settingRow('closeToTray','关闭窗口后继续运行','点击右上角关闭按钮时收起到系统托盘；从托盘菜单可以完全退出。')}${settingRow('launchAtLogin','开机启动','安装后可用；登录系统后在后台运行。')}</section><section class="settings-card"><h2>网站设置与记录</h2><p class="settings-caption">导出的设置只包含网站地址与监测规则，不包含 Cookie、登录凭据或消息记录。</p><div class="settings-actions">${btn('export','导出网站设置','download','small')}${btn('import','导入网站设置','upload','small')}${btn('clear-events','清空活动记录','trash','small')}</div></section></div><div><section class="settings-card"><div class="about-logo"><img src="../../assets/icon.svg" alt="" width="48" height="48"><div><h2>Website Controller</h2><p>多网站消息中心 · v${e(state.version)}</p></div></div><div class="about-text">为多平台接单准备的桌面工作台。<br>打开真实网站、保留独立登录状态，<br>将分散的消息线索集中到一处。</div><span class="about-badge">${icon('shield')}本地运行 · 无需额外注册</span></section><section class="settings-card"><h2>如何获得可靠的提醒</h2><div class="about-text" style="margin-top:13px">登录后进入网站消息页，软件会自动分析实际响应，识别消息接口、WebSocket 和 SSE 推送，并监听页面变化。<br><br>“连接详情”会显示已发现的消息来源。自动识别尚未找到来源时，页面监测继续运行，也可以手动点选角标或正文。<br><br>睡眠、断网、退出软件或登录失效期间，无法接收实时提醒。依赖刷新的网站可开启定时刷新。</div></section><section class="settings-card"><h2>本地数据</h2><p class="settings-caption" style="margin-top:8px">登录状态由 Chromium 会话保存在本机；消息摘要也保存在此目录。请妥善保管。</p><div class="data-path">${e(state.dataPath)}</div>${btn('data-folder','打开数据文件夹','folder','small')}</section></div></div>`;
}
function browserPage() {
  const site = findSite(selectedSite);
  if (!site) { page = 'sites'; return sitesPage(); }
  const r = site.runtime, value = status(site);
  return `<div class="browser-heading">${avatar(site)}<div><h1>${e(site.name)}${site.demo ? '<span class="badge-demo">本地演示</span>' : ''}</h1><p>在原网站中查看与回复，工作台在后台汇总提醒。</p></div><div class="browser-heading-actions">${btn('network','连接详情','activity','small',`data-id="${e(site.id)}"`)}${btn('use-current','设为起始页','home','small',`data-id="${e(site.id)}"`)}${btn('rules','监测规则','target','small',`data-id="${e(site.id)}"`)}${ibtn('site-menu','网站设置','more',`data-id="${e(site.id)}"`)}</div></div><div class="browser-frame"><div class="browser-toolbar">${ibtn('browser-command','后退','back',`data-command="back" ${!r.canGoBack ? 'disabled' : ''}`)}${ibtn('browser-command','前进','chevron',`data-command="forward" ${!r.canGoForward ? 'disabled' : ''}`)}${ibtn('browser-command','刷新页面','reload','data-command="reload"')}${ibtn('browser-command','监测起始页','home','data-command="home"')}<form id="address-form" class="address-bar">${icon(r.url.startsWith('https:') ? 'shield' : 'globe')}<input id="address" aria-label="网站地址" spellcheck="false" value="${e(r.url || site.url)}"></form>${ibtn('browser-command','在系统浏览器中打开','external','data-command="external"')}</div><div class="browser-note ${attention(site) || !r.matched ? 'warn' : ''}">${icon(attention(site) ? 'info' : 'activity')}<span>${e(value.detail)}${site.demo ? ' 当前为本地演示，数据与真实网站无关。' : ''}</span></div><div id="browser-host" class="browser-host">${r.status === 'error' ? `<div class="empty-state">${emptyArt()}<h3>暂时无法连接到网站</h3><p>${e(r.error)}<br>可点击刷新重试，或在系统浏览器中检查。</p>${btn('browser-command','重新连接','reload','primary small','data-command="reload"')}</div>` : `<div class="empty-state"><span class="spinner"></span><p style="margin-top:15px">正在准备网站页面…</p></div>`}</div><div class="browser-status"><span>${statusBadge(site)}${r.source ? `识别来源：${e(r.source)}` : '未识别到未读数量时显示 —'}${r.hasDraft ? ' · 检测到编辑内容，已跳过自动刷新' : ''}</span><span>${r.lastSeen ? `最近心跳 ${formatTime(r.lastSeen)}` : '等待页面心跳'} · 后台持续监测</span></div></div>`;
}
let lastBounds = '', routeAnimation;
function syncBounds() {
  if (page !== 'browser') return;
  const element = document.querySelector('#browser-host');
  if (!element) return;
  const bounds = element.getBoundingClientRect();
  const next = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
  const key = `${selectedSite}:${JSON.stringify(next)}`;
  if (key !== lastBounds) { lastBounds = key; window.workdesk.bounds(next); }
}
function render() {
  if (!state) return;
  document.documentElement.dataset.theme=state.settings.darkMode?'dark':'light';
  document.documentElement.dataset.motion=state.settings.reducedMotion?'reduce':'full';
  const route=page==='browser'?page+selectedSite:page;
  const animateRoute=previousRoute!==route; previousRoute=route;
  const scrollTop = content.scrollTop;
  renderSidebar(); renderTopbar();
  content.className = page === 'browser' ? 'browser-page' : '';
  updateHTML(content, `${state.warning ? `<div class="warning-banner">${e(state.warning)}</div>` : ''}${page === 'dashboard' ? dashboard() : page === 'sites' ? sitesPage() : page === 'messages' ? messagesPage() : page === 'settings' ? settingsPage() : browserPage()}`);
  content.scrollTop = scrollTop;
  if (animateRoute) {
    routeAnimation?.cancel();
    if(page !== 'browser'&&!state.settings.reducedMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches)routeAnimation=content.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  requestAnimationFrame(syncBounds);
}
function requestRender() { if (!renderPending) { renderPending = true; requestAnimationFrame(() => { renderPending = false; render(); }); } }
async function navigate(next) {
  page = next; search = ''; selectedSite = null; content.scrollTop = 0;
  lastBounds = ''; render(); await call('navigate');
}
async function openSite(id) {
  await call('select', id); selectedSite = id; page = 'browser'; search = ''; render();
}
function showModal(html, config = {}) {
  modal = config; document.querySelector('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${config.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${html}</section></div>`;
  call('overlay', true).catch(error => toast(error.message));
  setTimeout(() => { document.querySelector('#modal-root input, #modal-root textarea, #modal-root button')?.focus(); }, 40);
}
async function closeModal() { modal = null; document.querySelector('#modal-root').innerHTML = ''; await call('overlay', false); }
function modalHead(title, description) { return `<div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${description}</p></div>${ibtn('close-modal','关闭对话框','close')}</div>`; }
function modalFoot(label = '保存设置', action = 'submit-modal', danger = false) { return `<div class="modal-footer">${btn('close-modal','取消')}${btn(action,label,'',danger ? 'danger' : 'primary')}</div>`; }
const refreshSelect = value => `<select name="refreshSeconds"><option value="0" ${!value ? 'selected' : ''}>不自动刷新（推荐）</option>${[60,120,300,600].map(n => `<option value="${n}" ${Number(value) === n ? 'selected' : ''}>每 ${n / 60} 分钟刷新</option>`).join('')}${value && ![60,120,300,600].includes(Number(value)) ? `<option value="${value}" selected>每 ${value} 秒刷新</option>` : ''}</select>`;
function siteForm(site) {
  showModal(`${modalHead(site ? '编辑网站' : '连接一个新网站',site ? '修改网址、名称与后台刷新方式。' : '使用独立会话打开网站，直接在网站内登录。')}<form id="site-form"><div class="modal-body">${!site ? '<div class="preset-row">快速填写 <button type="button" class="preset" data-action="preset" data-preset="guangchang">光厂</button><button type="button" class="preset" data-action="preset" data-preset="zcool">站酷</button></div>' : ''}<div class="field"><label for="site-name">网站名称</label><input id="site-name" name="name" maxlength="40" required placeholder="例如：光厂 · 我的工作账号" value="${e(site?.name || '')}"></div><div class="field"><label for="site-url">网站地址 <small>可直接填写消息页面地址</small></label><input id="site-url" name="url" type="text" required placeholder="https://www.example.com/messages" value="${e(site?.url || '')}"></div><div class="field-row"><div class="field"><label>标识颜色</label><select name="color">${[['blue','雾蓝'],['orange','暖橙'],['yellow','鹅黄'],['mint','薄荷'],['purple','浅紫'],['pink','蔷薇']].map(([value,label]) => `<option value="${value}" ${site?.color === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label>后台定时刷新</label>${refreshSelect(site?.refreshSeconds)}</div></div><div class="field"><div class="hint">仅在站点位于后台、没有检测到编辑内容时刷新。实时更新的消息页面通常不需要刷新。</div></div><details class="advanced"><summary>高级：直接填写监测规则</summary><div class="field"><label>未读角标 CSS 选择器</label><input name="unreadSelector" value="${e(site?.unreadSelector || '')}" placeholder="留空时自动识别标题和消息角标"></div><div class="field"><label>最新消息正文 CSS 选择器</label><input name="messageSelector" value="${e(site?.messageSelector || '')}" placeholder="选填，只记录所选消息区域的摘要"></div></details><div id="form-error" class="error-text" role="alert"></div></div>${modalFoot(site ? '保存修改' : '添加并连接')}</form>`, { type: 'site', id: site?.id });
}
function ruleForm(id) {
  const site = findSite(id); if (!site) return;
  showModal(`${modalHead(`${e(site.name)} · 监测规则`,'先打开并登录消息页，再点选角标或最新一条消息。')}<form id="rule-form"><div class="modal-body"><div class="warning-banner">默认监测页面标题和消息入口附近的数字角标。未识别到数据时，会显示“—”，不会当作没有消息。</div><div class="field"><div class="rule-pick-row"><label for="unread-selector">未读角标 CSS 选择器</label>${btn('pick','在页面上选取','target','small',`data-id="${e(id)}" data-kind="unread"`)}</div><textarea id="unread-selector" name="unreadSelector" placeholder="留空时使用自动识别">${e(site.unreadSelector)}</textarea><div class="hint">选取会持续显示数字的角标。没有数字的红点仅能识别“有提示”。</div></div><div class="field"><div class="rule-pick-row"><label for="message-selector">最新消息正文 CSS 选择器 <small>选填</small></label>${btn('pick','在页面上选取','target','small',`data-id="${e(id)}" data-kind="message"`)}</div><textarea id="message-selector" name="messageSelector" placeholder="选中最新一条消息的正文，可识别数量不变时的新内容">${e(site.messageSelector)}</textarea><div class="hint">只有所选区域的文本摘要会被记录。首次读取建立基准，之后发生变化时提醒。</div></div><div class="field"><label>后台定时刷新</label>${refreshSelect(site.refreshSeconds)}<div class="hint">页面本身不自动更新时可开启。切换到该站点或检测到编辑内容时会跳过刷新。</div></div><div class="rule-status">当前状态：${e(status(site).label)}<br>识别来源：${e(site.runtime.source || '尚未识别')} · 网站未读：${site.runtime.unread === null ? '未知' : site.runtime.unread}<br>请在设置后用真实消息核对效果；当前规则尚未经过账号内的端到端验证。</div><div id="form-error" class="error-text" role="alert"></div></div>${modalFoot()}</form>`, { type: 'rules', id, wide: true });
}
function siteMenu(id) {
  const site = findSite(id); if (!site) return;
  showModal(`${modalHead(e(site.name),'管理这个站点的运行方式与本地登录状态。')}<div class="modal-body"><div class="settings-actions">${btn('edit-site','编辑网站','edit','',`data-id="${e(id)}"`)}${btn('rules','监测规则','target','',`data-id="${e(id)}"`)}${btn('toggle-site',site.enabled ? '暂停监测' : '恢复监测',site.enabled ? 'pause' : 'play','',`data-id="${e(id)}"`)}</div><div class="settings-actions">${btn('reset-session','清除本地登录状态','reload','',`data-id="${e(id)}"`)}${btn('delete-site','移除网站','trash','danger',`data-id="${e(id)}"`)}</div><div class="info-line">${icon('info')}移除网站会删除该站点在工作台中的配置与活动记录。</div></div><div class="modal-footer">${btn('close-modal','完成','','primary')}</div>`, { type: 'menu', id });
}
function confirmDialog(title, description, action, id, label = '确认') {
  showModal(`${modalHead(title,'请确认下面的操作。')}<div class="modal-body"><p class="confirm-body">${description}</p></div><div class="modal-footer">${btn('close-modal','取消')}${btn(action,label,'','danger',`data-id="${e(id || '')}"`)}</div>`, { type: 'confirm' });
}
async function submitModal() {
  const form = document.querySelector('#site-form, #rule-form'); if (!form || !modal) return;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form)); values.refreshSeconds = Number(values.refreshSeconds);
  if (modal.id) values.id = modal.id;
  try { const result = await call('save-site', values); await closeModal(); toast('网站设置已保存'); if (!values.id) await openSite(result.id); }
  catch(error) { document.querySelector('#form-error').textContent = error.message; }
}
document.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'address-form') call('browser', { id: selectedSite, command: 'go', url: document.querySelector('#address').value }).catch(error => toast(error.message));
  else submitModal();
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  if (button.closest('form') && button.type !== 'button') event.preventDefault();
  const { action, id, command } = button.dataset;
  try {
    if (action === 'nav') await navigate(button.dataset.page);
    else if (action === 'window') await call('window', command);
    else if (action === 'quiet') await call('settings', { quiet: !state.settings.quiet });
    else if (action === 'add') siteForm();
    else if (action === 'open') await openSite(id);
    else if (action === 'open-event') { await call('read', button.dataset.eventId); await openSite(id); }
    else if (action === 'read') await call('read', id);
    else if (action === 'read-all') { await call('read'); toast('已将现有提醒全部设为已处理'); }
    else if (action === 'site-menu') siteMenu(id);
    else if (action === 'edit-site') siteForm(findSite(id));
    else if (action === 'rules') ruleForm(id);
    else if (action === 'close-modal') await closeModal();
    else if (action === 'submit-modal') await submitModal();
    else if (action === 'toggle-site') { await call('toggle-site', id); if (modal) await closeModal(); }
    else if (action === 'delete-site') confirmDialog('移除这个网站？',`“${e(findSite(id)?.name)}”的网站配置和本地活动记录将被移除。`, 'confirm-delete', id, '移除网站');
    else if (action === 'confirm-delete') { await call('delete-site', id); await closeModal(); if (selectedSite === id) await navigate('sites'); toast('网站已移除'); }
    else if (action === 'reset-session') confirmDialog('清除网站登录状态？','这个网站的 Cookie 和本地缓存将被清除，需要重新在网站中登录。', 'confirm-reset', id, '清除登录状态');
    else if (action === 'confirm-reset') { await call('clear-session', id); await closeModal(); }
    else if (action === 'clear-events') confirmDialog('清空本地活动记录？','软件中已保存的消息摘要和连接记录将被删除，网站上的消息不受影响。','confirm-clear', '', '清空记录');
    else if (action === 'confirm-clear') { await call('clear-events'); await closeModal(); toast('本地活动记录已清空'); }
    else if (action === 'browser-command') await call('browser', { id: selectedSite, command });
    else if (action === 'use-current') await call('browser', { id, command: 'use-current' });
    else if (action === 'setting') await call('settings', { [button.dataset.key]: !state.settings[button.dataset.key] });
    else if (action === 'pick') { const kind = button.dataset.kind; await closeModal(); await openSite(id); await call('pick', { id, kind }); }
    else if (action === 'demo') { const result = await call('demo'); await openSite(result.id); }
    else if (['notification-test','export','import','data-folder'].includes(action)) await call(action);
    else if (action === 'message-filter') { messageFilter = button.dataset.filter; render(); }
    else if (action === 'site-filter') { siteFilter = button.dataset.filter; render(); }
    else if (action === 'stat') { const index = Number(button.dataset.index); if ([1,2].includes(index)) { messageFilter = index === 1 ? 'unread' : 'messages'; await navigate('messages'); } else { siteFilter = index === 3 ? 'attention' : 'all'; await navigate('sites'); } }
    else if (action === 'preset') { const zcool = button.dataset.preset === 'zcool'; document.querySelector('[name="name"]').value = zcool ? '站酷' : '光厂'; document.querySelector('[name="url"]').value = zcool ? 'https://www.zcool.com.cn/' : 'https://www.vjshi.com/'; document.querySelector('[name="color"]').value = zcool ? 'yellow' : 'orange'; }
  } catch(error) { toast(error.message); }
});
document.addEventListener('input', event => { if (event.target.id === 'search') { search = event.target.value; requestRender(); } });
document.addEventListener('change', event => { if (event.target.id === 'message-site') { messageSite = event.target.value; render(); } });
document.addEventListener('keydown', event => {
  if (modal) {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const focusable = [...document.querySelectorAll('#modal-root button, #modal-root input, #modal-root select, #modal-root textarea, #modal-root summary')].filter(element => element.getClientRects().length && !element.disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
});
function beep() {
  try { const context = new AudioContext(); const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.setValueAtTime(740, context.currentTime); oscillator.frequency.setValueAtTime(980, context.currentTime + .11); gain.gain.setValueAtTime(.07, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .32); oscillator.start(); oscillator.stop(context.currentTime + .33); oscillator.onended = () => context.close(); } catch {}
}
window.workdesk.onState(next => { state = next; requestRender(); });
window.workdesk.onToast(toast);
window.workdesk.onNavigate(next => { if(next.commandPalette){commandDialog();return;} if (next.sound) { beep(); return; } if (next.page === 'browser') { page = 'browser'; selectedSite = next.siteId; render(); } });
window.addEventListener('resize', syncBounds);
call('state').then(next => { state = next; render(); }).catch(error => { content.textContent = `工作台初始化失败：${error.message}`; });
