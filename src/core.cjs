const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({ notifications: true, sound: true, quiet: false, closeToTray: true, launchAtLogin: false, fastPolling: true, darkMode: false, reducedMotion: false });
const text = (value, length = 240) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, length);
function normalizeUrl(value) {
  let input = text(value, 2048);
  if (!input) throw new Error('请输入网站地址');
  if (!/^[a-z][a-z\d+.-]*:/i.test(input)) input = `https://${input}`;
  let url;
  try { url = new URL(input); } catch { throw new Error('网站地址格式不正确'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('仅支持不含账号密码的 HTTP / HTTPS 网站地址');
  return url.href;
}
function validateSite(input, existing = {}) {
  if (!input || typeof input !== 'object') throw new Error('网站设置格式不正确');
  const name = text(input.name ?? existing.name, 40);
  if (!name) throw new Error('请填写网站名称');
  const refreshSeconds = Number(input.refreshSeconds ?? existing.refreshSeconds ?? 0);
  if (!Number.isInteger(refreshSeconds) || (refreshSeconds !== 0 && (refreshSeconds < 60 || refreshSeconds > 3600))) throw new Error('定时刷新应为 60～3600 秒，或 0（关闭）');
  const colors = ['orange', 'yellow', 'blue', 'purple', 'mint', 'pink'];
  const color = colors.includes(input.color ?? existing.color) ? (input.color ?? existing.color) : 'blue';
  return {
    id: existing.id || randomUUID(), name, url: normalizeUrl(input.url ?? existing.url),
    color, enabled: typeof input.enabled === 'boolean' ? input.enabled : (existing.enabled ?? true),
    unreadSelector: text(input.unreadSelector ?? existing.unreadSelector ?? '', 800),
    messageSelector: text(input.messageSelector ?? existing.messageSelector ?? '', 800),
    refreshSeconds, createdAt: existing.createdAt || Date.now(),
    demo: existing.demo === true
  };
}
function initialData() {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, sites: [
    validateSite({ name: '光厂', url: 'https://www.vjshi.com/', color: 'orange' }),
    validateSite({ name: '站酷', url: 'https://www.zcool.com.cn/', color: 'yellow' })
  ], events: [] };
}
function normalizeSettings(input, current = DEFAULT_SETTINGS) {
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_SETTINGS)) if (typeof input?.[key] === 'boolean') next[key] = input[key];
  return next;
}
class Store {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, 'workspace.json');
    this.warning = '';
    this.data = initialData();
    if (fs.existsSync(this.file)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (raw.version !== 1 || !Array.isArray(raw.sites) || !Array.isArray(raw.events)) throw new Error('不支持的数据格式');
        const used = new Set();
        const sites = raw.sites.slice(0, 500).filter(s => !s.demo).map(s => {
          if (!/^[\w-]{1,80}$/.test(s.id) || used.has(s.id)) throw new Error('网站标识无效');
          used.add(s.id);
          return validateSite(s, s);
        });
        const events = raw.events.slice(0, 1500).filter(e => e && typeof e.id === 'string' && typeof e.siteId === 'string').map(e => ({
          id: text(e.id, 80), siteId: text(e.siteId, 80), siteName: text(e.siteName, 40),
          type: e.type === 'message' ? 'message' : 'system', title: text(e.title, 120), body: text(e.body, 400),
          at: Number.isFinite(e.at) ? e.at : Date.now(), read: e.read === true,
          source: text(e.source, 80), url: (() => { try { return normalizeUrl(e.url); } catch { return ''; } })()
        }));
        this.data = { version: 1, settings: normalizeSettings(raw.settings), sites, events };
      } catch (error) {
        const backup = `${this.file}.recovery-${Date.now()}`;
        fs.copyFileSync(this.file, backup);
        this.warning = `原设置无法读取，已备份为 ${path.basename(backup)}。${error.message}`;
      }
    }
  }
  saveSoon() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 300); this.timer.unref?.(); }
  flush() {
    clearTimeout(this.timer);
    const data = { ...this.data, sites: this.data.sites.filter(s => !s.demo), events: this.data.events.filter(e => !e.demo).slice(0, 1500) };
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
}
function unreadFromTitle(title) {
  const value = text(title, 240);
  const match = value.match(/^[\s\u200b]*(?:[（(【\[]\s*(\d{1,5})\s*[）)】\]])/) || value.match(/(?:有|收到)?\s*(\d{1,5})\s*(?:条|封)\s*(?:新消息|未读|新私信|消息|私信)/);
  if (match) return Math.min(Number(match[1]), 99999);
  if (/^(?:[【\[])?\s*(?:新消息|新私信|您有新消息|你有新消息|未读消息)/.test(value)) return 1;
  return null;
}
function digest(value) { return createHash('sha256').update(String(value)).digest('hex').slice(0, 20); }
// Unknown observations never become a fabricated zero; page reloads keep the previous baseline.
function evaluateObservation(previous, observation) {
  const result = { ...previous };
  const count = Number.isInteger(observation.unread) && observation.unread >= 0 ? Math.min(observation.unread, 99999) : null;
  const preview = text(observation.preview, 400);
  const fingerprint = preview ? digest(preview) : '';
  let alert = false;
  if (count !== null) {
    alert = count > 0 && (previous.lastCount == null || count > previous.lastCount);
    result.lastCount = count;
  }
  if (fingerprint) {
    if (previous.lastFingerprint && fingerprint !== previous.lastFingerprint && (count === null || count > 0)) alert = true;
    result.lastFingerprint = fingerprint;
  }
  const signature = `${count ?? '?'}:${fingerprint}`;
  if (count === 0) result.lastAlert = '';
  if (alert) result.lastAlert = signature;
  return { next: result, alert, count, preview };
}
module.exports = { Store, DEFAULT_SETTINGS, initialData, normalizeSettings, normalizeUrl, validateSite, unreadFromTitle, evaluateObservation, text };
