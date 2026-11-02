const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
// Old profiles stay available for rollback. Publish a complete copy atomically.
function prepareProfile(appData, platform = process.platform) {
  const target = path.join(appData, platform === 'win32' ? '消息中心' : 'Website Controller');
  const legacy = path.join(appData, '\u63a5\u5355\u53f0');
  if (platform !== 'win32' || fs.existsSync(target) || !fs.existsSync(path.join(legacy, 'workspace.json'))) return target;
  const staging = path.join(appData, `WebsiteController-migration-${randomUUID()}`);
  const skip = new Set(['Cache', 'Code Cache', 'GPUCache', 'ShaderCache', 'GrShaderCache', 'DawnCache', 'Crashpad', 'BrowserMetrics']);
  fs.cpSync(legacy, staging, { recursive: true, errorOnExist: true, force: false, filter: source => !skip.has(path.basename(source)) && !/^(?:Singleton.*|LOCK|lockfile|DevToolsActivePort)$/.test(path.basename(source)) });
  // Validate before publishing, without rewriting account/session identifiers.
  const config = JSON.parse(fs.readFileSync(path.join(staging, 'workspace.json'), 'utf8'));
  if (config.version !== 1 || !Array.isArray(config.sites) || !Array.isArray(config.events)) throw new Error('原本地配置格式无法识别，已保留原目录');
  fs.renameSync(staging, target);
  return target;
}
module.exports = { prepareProfile };
