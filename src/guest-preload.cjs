const { ipcRenderer } = require('electron');
if (process.isMainFrame) {
  let rules = { unreadSelector: '', messageSelector: '' };
  let scheduled = false;
  let pickerCleanup = null;
  let hasDraft = false;
  document.addEventListener('input', event => {
    if (event.isTrusted && event.target.matches('textarea, [contenteditable="true"], input:not([type="password"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"])')) hasDraft = true;
  }, true);
  const visible = (element) => !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none';
  const clean = (value, max = 400) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const countOf = (element, explicit = false) => {
    if (!visible(element)) return null;
    const raw = clean(element.getAttribute('data-unread-count') || element.getAttribute('aria-label') || element.textContent || element.getAttribute('title'), 80);
    const match = raw.match(/^(\d{1,5})\+?$/) || raw.match(/(?:未读|消息|私信|通知|unread|messages?)\D{0,8}(\d{1,5})/i) || raw.match(/(\d{1,5})\s*(?:条|封)\s*(?:未读|消息|私信|通知)/);
    if (match) return Math.min(Number(match[1]), 99999);
    if (explicit && raw === '') return 1;
    return null;
  };
  function sample() {
    scheduled = false;
    if (pickerCleanup) return;
    let unread = null, source = '', preview = '', ruleError = '', matched = false;
    try {
      if (rules.unreadSelector) {
        const nodes = [...document.querySelectorAll(rules.unreadSelector)].slice(0, 100);
        const values = nodes.map(n => countOf(n, true)).filter(n => n !== null);
        matched = nodes.some(visible);
        if (values.length) { unread = Math.max(...values); source = '自定义角标'; }
      } else {
        const links = [...document.querySelectorAll('header a, nav a, [role="navigation"] a, [class*="header"] a, [class*="Header"] a, [aria-label*="未读"], [data-unread-count]')].slice(0, 500);
        const counts = [];
        for (const link of links) {
          const context = [link.getAttribute('href'), link.getAttribute('aria-label'), link.getAttribute('title'), clean(link.textContent, 60)].join(' ');
          if (!/(?:message|notification|\/notice|\/im(?:\/|$)|未读|私信|消息|通知)/i.test(context) && !link.hasAttribute('data-unread-count')) continue;
          for (const badge of [link, ...link.querySelectorAll('[class*="badge"], [class*="Badge"], [class*="unread"], [class*="Unread"], [class*="count"], [class*="Count"], sup')]) {
            const number = countOf(badge);
            if (number !== null) counts.push(number);
          }
        }
        if (counts.length) { unread = Math.max(...counts); source = '消息区域角标'; matched = true; }
      }
    } catch { ruleError = '未读角标选择器无效，请重新选取'; }
    try {
      if (rules.messageSelector) {
        const element = [...document.querySelectorAll(rules.messageSelector)].slice(0, 100).find(visible);
        if (element && !element.matches('input, textarea, [contenteditable="true"]')) preview = clean(element.innerText || element.textContent);
      }
    } catch { ruleError = '消息正文选择器无效，请重新选取'; }
    const pathLogin = /(?:^|\/)(?:login|signin|sign-in)(?:\/|$|\.html)/i.test(location.pathname);
    const passwordVisible = [...document.querySelectorAll('input[type="password"]')].some(visible);
    const headerLogin = [...document.querySelectorAll('header a, header button, nav a, nav button, [class*="header"] button, [class*="Header"] button, [class*="header"] a, [class*="Header"] a')].some(e => visible(e) && /^(?:登录[ /／·]*注册|登录\/注册|登录|立即登录)$/.test(clean(e.textContent, 30)));
    const bodyStart = clean(document.body?.innerText, 600);
    const blocked = /^(?:访问受限|访问验证|安全验证|人机验证|Access Denied|Just a moment|验证您的身份|请完成安全验证)/i.test(document.title) || /(?:请完成下方验证|请先通过安全验证|访问过于频繁|您的访问已被拦截)/.test(bodyStart);
    ipcRenderer.send('monitor:sample', { title: clean(document.title, 240), url: location.href.slice(0, 2048), unread, source, preview, matched, ruleError, loginRequired: pathLogin || passwordVisible || headerLogin, blocked, online: navigator.onLine, hasDraft, at: Date.now() });
  }
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(sample, 100); } }
  ipcRenderer.on('monitor:rules', (_event, value) => { rules = { unreadSelector: String(value?.unreadSelector || ''), messageSelector: String(value?.messageSelector || '') }; sample(); });
  ipcRenderer.on('monitor:sample-now', sample);
  ipcRenderer.on('monitor:pick', (_event, kind) => {
    pickerCleanup?.();
    const overlay = document.createElement('div');
    overlay.setAttribute('data-relay-picker', 'true');
    Object.assign(overlay.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483647', border: '2px solid #16b89b', background: 'rgba(22,184,155,.12)', boxSizing: 'border-box' });
    const note = document.createElement('div');
    Object.assign(note.style, { position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', color: '#fff', background: '#102c33', borderRadius: '8px', font: '14px "Microsoft YaHei",sans-serif', zIndex: '2147483647', pointerEvents: 'none', boxShadow: '0 6px 30px #0004' });
    note.textContent = kind === 'message' ? '点击最新一条消息的正文区域 · Esc 取消' : '点击消息入口旁的未读数字角标 · Esc 取消';
    document.documentElement.append(overlay, note);
    const move = e => { const r = e.target.getBoundingClientRect(); Object.assign(overlay.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }); };
    const cssPath = element => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts = [];
      let target = element;
      for (let i = 0; target && target !== document.documentElement && i < 7; i++, target = target.parentElement) {
        if (target.id) { parts.unshift(`#${CSS.escape(target.id)}`); break; }
        let part = target.localName;
        const classes = [...target.classList].filter(c => c.length < 70 && !/^(?:active|hover|selected|focus)$/.test(c)).slice(0, 2);
        if (classes.length) part += classes.map(c => `.${CSS.escape(c)}`).join('');
        if (target.parentElement) {
          const siblings = [...target.parentElement.children].filter(s => s.localName === target.localName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(target) + 1})`;
        }
        parts.unshift(part);
      }
      return parts.join(' > ');
    };
    const click = e => { e.preventDefault(); e.stopImmediatePropagation(); const element = e.target; if (element.matches('input, textarea, [contenteditable="true"]')) return; const selector = cssPath(element); const value = clean(element.innerText || element.textContent, 100); pickerCleanup(); ipcRenderer.send('monitor:picked', { kind, selector, value }); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); pickerCleanup(); ipcRenderer.send('monitor:picked', { cancelled: true }); } };
    pickerCleanup = () => { overlay.remove(); note.remove(); document.removeEventListener('mousemove', move, true); document.removeEventListener('click', click, true); document.removeEventListener('keydown', key, true); pickerCleanup = null; };
    document.addEventListener('mousemove', move, true); document.addEventListener('click', click, true); document.addEventListener('keydown', key, true);
  });
  const start = () => { new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-label', 'data-unread-count', 'title', 'style'] }); sample(); setInterval(sample, 2000); ipcRenderer.send('monitor:ready'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
