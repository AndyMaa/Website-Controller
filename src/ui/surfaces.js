// Shared global presentation functions. Loaded before app.js; no remote content executes here.
function renderSidebar() {
  updateHTML(document.querySelector('#sidebar'), `<div class="brand" aria-label="Website Controller"><img class="brand-icon" src="../../assets/icon.svg" alt=""><div class="brand-name">Website<span>Controller</span></div></div><button class="command-launch" data-action="command">${icon('search')}<span>快速查找</span><kbd>${state.platform === 'darwin' ? '⌘ K' : 'Ctrl K'}</kbd></button><nav class="nav" aria-label="主导航">${[['dashboard','grid','工作总览'],['messages','inbox','消息中心'],['sites','globe','所有连接']].map(([id,glyph,label])=>`<button class="nav-button ${page===id?'active':''}" data-action="nav" data-page="${id}">${icon(glyph)}${label}${id==='messages'&&pending().length?`<span class="nav-count">${pending().length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-section-label"><span>工作空间</span><button class="small-add" data-action="add" title="添加网站" aria-label="添加网站">${icon('plus')}</button></div><div class="site-links">${state.sites.map(site=>`<button class="site-link ${page==='browser'&&selectedSite===site.id?'active':''}" data-action="open" data-id="${e(site.id)}">${avatar(site)}<span class="site-link-name">${e(site.name)}${site.demo?'<span class="badge-demo">演示</span>':''}</span>${site.runtime.unread>0?`<span class="nav-count">${site.runtime.unread}</span>`:`<span class="site-dot ${site.enabled?(attention(site)?'attention':site.runtime.status==='ready'?'ready':''):''}"></span>`}</button>`).join('')}</div><button class="sidebar-connect" data-action="add">${icon('plus')}添加连接</button><div class="sidebar-bottom"><div class="local-indicator"><span></span><div>只属于你的工作空间<small>账号与消息保存在本机</small></div>${icon('shield')}</div><div class="sidebar-tools"><button class="nav-button ${page==='settings'?'active':''}" data-action="nav" data-page="settings">${icon('settings')}设置</button><button class="icon-button" data-action="theme" title="切换深浅主题" aria-label="切换深浅主题">${icon(state.settings.darkMode?'spark':'moon')}</button></div><div class="sidebar-footer">本地工作空间 <span style="margin-left:auto">${e(state.version)}</span></div></div>`);
}
function renderTopbar() {
  updateHTML(document.querySelector('#topbar'), `<div class="breadcrumbs"><span>工作空间</span><span>/</span><strong>${e(page==='browser'?(findSite(selectedSite)?.name||'网站'):names[page])}</strong></div><div class="topbar-right"><span class="live-label">${state.sites.filter(s=>s.enabled&&s.runtime.status==='ready').length} 个页面已连接</span><button class="quiet-button ${state.settings.quiet?'enabled':''}" data-action="quiet" title="${state.settings.quiet?'关闭免打扰':'开启免打扰'}">${icon(state.settings.quiet?'moon':'bell')}</button><div class="window-controls">${['minimize','maximize','close'].map((action,index)=>`<button data-action="window" data-command="${action}" title="${['最小化','最大化 / 还原','关闭窗口'][index]}" aria-label="${['最小化','最大化或还原','关闭窗口'][index]}">${icon(action)}</button>`).join('')}</div></div>`);
}
function connectionRow(site) {
  const network=site.runtime.network;
  const channels=network?.endpoints.length||0;
  return `<article class="connection-row"><button class="connection-main" data-action="open" data-id="${e(site.id)}">${avatar(site)}<span class="connection-info"><strong>${e(site.name)}</strong><small>${e(host(site.url))}${site.demo?' · 本地演示':''}</small></span><span class="connection-state">${statusBadge(site)}<small>${channels?`${channels} 个消息来源已发现`:'自动发现消息来源'}</small></span><span class="connection-count ${site.runtime.unread>0?'has-unread':''}">${site.runtime.unread===null?'—':site.runtime.unread}</span>${icon('chevron')}</button>${ibtn('network','连接详情','activity',`data-id="${e(site.id)}"`)}</article>`;
}
function dashboard() {
  const active=state.sites.filter(s=>s.enabled), online=active.filter(s=>s.runtime.status==='ready'), discovered=state.sites.filter(s=>s.runtime.network?.endpoints.length).length;
  const records=state.events.filter(item=>item.type==='message').slice(0,4);
  return `<div class="page-heading overview-heading"><div><div class="eyebrow">${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'})}</div><h1>工作总览</h1></div><div class="heading-actions">${btn('demo','测试提醒','play','text')}${btn('add','添加连接','plus','primary')}</div></div><section class="focus-intro"><div class="orbital-art" aria-hidden="true"><i></i><i></i><i></i><b></b></div><h2>专注此刻<span>，</span>保持连接<span>。</span></h2><p>来自各个平台的新消息，在这里汇合。</p><form id="quick-connect" class="quick-connect">${icon('link')}<input id="quick-url" aria-label="快速添加网站" placeholder="粘贴网站地址，连接下一个工作平台" autocomplete="off"><button type="submit" aria-label="连接网址">${icon('arrow')}</button></form><div class="intro-hint">独立账号 · 自动发现消息来源 · 后台守候</div></section><div class="summary-strip"><button data-action="stat" data-index="1"><span>待处理提醒</span><strong>${pending().length}<small>条</small></strong></button><button data-action="stat" data-index="0"><span>已连接页面</span><strong>${online.length}<small>/ ${active.length}</small></strong></button><button data-action="nav" data-page="sites"><span>已发现消息接口</span><strong>${discovered}<small>个网站</small></strong></button><span class="summary-caption">${icon('activity')}保持从容，消息有迹可循。</span></div><div class="dashboard-grid"><section class="workspace-section"><div class="section-heading"><h2>你的连接 <span class="counter">${state.sites.length}</span></h2>${btn('nav','查看全部','chevron','text small','data-page="sites"')}</div><div class="connections-list">${state.sites.slice(0,6).map(connectionRow).join('')}${!state.sites.length?'<div class="empty-state"><h3>从一个网站开始</h3><p>粘贴网址，登录后自动尝试连接消息来源。</p></div>':''}</div><button class="connection-add" data-action="batch">${icon('plus')}批量连接网站<span>每行一个网址</span></button></section><section class="workspace-section"><div class="section-heading"><h2>消息动态</h2>${btn('nav','打开收件箱','chevron','text small','data-page="messages"')}</div><div class="activity-panel">${records.length?records.map(event=>`<button class="recent-message" data-action="open-event" data-id="${e(event.siteId)}" data-event-id="${e(event.id)}"><span class="recent-dot ${event.read?'read':''}"></span><div><div class="activity-line"><span>${e(event.siteName)}</span><time>${formatTime(event.at)}</time></div><h3>${e(event.title)}</h3><p>${e(event.body)}</p></div></button>`).join(''):`<div class="quiet-empty"><div class="quiet-glyph">${icon('inbox')}</div><h3>暂无新消息</h3><p>有新的联系时，会出现在这里。<br>你可以继续手上的创作。</p></div>`}</div></section></div><div class="page-footnote">${icon('shield')}本机工作空间<span>·</span>打开网站的消息页，帮助软件发现更新来源</div>`;
}
function networkDialog(id) {
  const site=findSite(id);if(!site)return;
  const network=site.runtime.network, endpoints=network?.endpoints||[];
  showModal(`${modalHead(`${e(site.name)} · 连接详情`,'每个状态都来自当前网站实际返回的数据。')}<div class="modal-body"><div class="connection-health">${icon(endpoints.length?'activity':'search')}<div><strong>${endpoints.length?'已发现消息来源':'正在寻找消息来源'}</strong><p>${endpoints.length?'接口监听与页面监测同时运行。':'进入网站消息页后，软件会自动识别它使用的接口与推送。'}</p></div></div><div class="source-summary"><span>已分析响应<strong>${network?.analyzed||0}</strong></span><span>已发现来源<strong>${endpoints.length}</strong></span><span>最近处理耗时<strong>${network?.processingMs==null?'—':`${network.processingMs} ms`}</strong></span></div><div class="endpoint-list">${endpoints.map(endpoint=>`<article><div><span class="endpoint-type">${endpoint.transport==='http'?'HTTP':endpoint.transport==='sse'?'SSE':'WebSocket'}</span><span>${endpoint.polling?'自动检查 · '+endpoint.interval/1000+' 秒':'跟随网站更新'}</span></div><code>${e(endpoint.address)}</code><small>识别字段：${e(endpoint.field)} · ${formatTime(endpoint.lastSeen)}</small>${endpoint.note?`<p>${e(endpoint.note)}</p>`:''}</article>`).join('')||'<div class="source-empty">页面监测已作为备用方式运行。可以先打开消息页，让自动识别继续；也可以直接选取消息角标。</div>'}</div><div class="info-line">${icon('info')}处理耗时指软件解析已收到数据的时间，不包含网站服务器与网络等待。这里只展示接口路径，不展示密钥或请求参数。</div><div class="settings-actions">${btn('rules','调整页面识别','target','small',`data-id="${e(id)}"`)}</div></div><div class="modal-footer">${btn('close-modal','完成','','primary')}</div>`,{type:'network',id,wide:true});
}
function batchDialog() {
  showModal(`${modalHead('一次连接，更多平台。','粘贴网站地址，每行一个。相同地址会自动去重。')}<form id="batch-form"><div class="modal-body"><div class="field"><label for="batch-urls">网站地址</label><textarea id="batch-urls" name="urls" rows="8" placeholder="https://www.vjshi.com/\nhttps://www.zcool.com.cn/\nhttps://你的工作平台" required></textarea></div><label class="batch-enable"><input type="checkbox" name="enabled"> 添加后立即打开所有页面</label><p class="field-note">默认先保存连接，再按需开启。每批可添加 100 个，工作空间可保存 500 个；同时打开的页面会占用内存。</p><div id="form-error" class="error-text"></div></div>${modalFoot('添加连接','submit-batch')}</form>`,{type:'batch'});
}
function commandDialog() {
  showModal(`<div class="palette-search">${icon('search')}<input id="command-search" placeholder="查找网站、页面与操作…" aria-label="查找网站、页面与操作"><kbd>Esc</kbd></div><div id="command-results" class="command-results"></div><div class="palette-footer">↑ ↓ 选择 <span>Enter 打开</span></div>`,{type:'command'});
  updateCommands('');setTimeout(()=>document.querySelector('#command-search')?.focus(),50);
}
function updateCommands(query) {
  const options=[{label:'工作总览',glyph:'grid',route:'dashboard'},{label:'消息中心',glyph:'inbox',route:'messages'},{label:'所有连接',glyph:'globe',route:'sites'},{label:'偏好设置',glyph:'settings',route:'settings'},...state.sites.map(s=>({label:s.name,detail:host(s.url),id:s.id,glyph:'globe'}))].filter(x=>`${x.label} ${x.detail||''}`.toLowerCase().includes(query.toLowerCase())).slice(0,30);
  document.querySelector('#command-results').innerHTML=options.map((option,index)=>`<button class="command-option ${index===0?'selected':''}" data-action="command-open" ${option.id?`data-id="${e(option.id)}"`:`data-page="${option.route}"`}>${icon(option.glyph)}<span>${e(option.label)}<small>${e(option.detail||'工作空间')}</small></span>${icon('arrow')}</button>`).join('')||'<div class="empty-state">没有找到匹配项，换个关键词试试。</div>';
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const {action,id}=button.dataset;
  try{
    if(action==='network')networkDialog(id);
    else if(action==='batch')batchDialog();
    else if(action==='command')commandDialog();
    else if(action==='theme')await call('settings',{darkMode:!state.settings.darkMode});
    else if(action==='command-open'){const route=button.dataset.page;await closeModal();if(id)await openSite(id);else await navigate(route);}
    else if(action==='submit-batch'){event.preventDefault();await submitBatch();}
  }catch(error){toast(error.message);}
});
async function submitBatch(){
  const form=document.querySelector('#batch-form');if(!form||!form.reportValidity())return;
  const data=new FormData(form);
  try{const result=await call('batch-add',{urls:String(data.get('urls')).split(/\r?\n/),enabled:data.has('enabled')});await closeModal();await navigate('sites');toast(`已添加 ${result.added} 个连接`);}catch(error){document.querySelector('#form-error').textContent=error.message;}
}
document.addEventListener('submit',event=>{
  if(event.target.id==='quick-connect'){event.preventDefault();const url=document.querySelector('#quick-url').value.trim();if(!url)return;siteForm();document.querySelector('#site-url').value=url;try{document.querySelector('#site-name').value=new URL(url.includes('://')?url:'https://'+url).hostname.replace(/^www\./,'');}catch{}document.querySelector('#site-name').focus();}
  else if(event.target.id==='batch-form'){event.preventDefault();submitBatch();}
});
document.addEventListener('input',event=>{if(event.target.id==='command-search')updateCommands(event.target.value);});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();commandDialog();return;}
  if(modal?.type==='command'){
    const rows=[...document.querySelectorAll('.command-option')],index=rows.findIndex(row=>row.classList.contains('selected'));
    if(['ArrowDown','ArrowUp'].includes(event.key)&&rows.length){event.preventDefault();rows[index]?.classList.remove('selected');const next=rows[(index+(event.key==='ArrowDown'?1:rows.length-1))%rows.length];next.classList.add('selected');next.scrollIntoView({block:'nearest'});}
    else if(event.key==='Enter'){event.preventDefault();rows[index]?.click();}
  }
});
