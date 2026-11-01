// Render the vector master with Chromium; bundle native Windows DPI sizes in one ICO.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (!process.versions.electron) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = require('node:child_process').spawn(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  child.on('exit', code => { process.exitCode = code || 0; });
} else {
  const { app, BrowserWindow } = require('electron');
  const data = path.join(root, 'test-results', 'icon-render');
  fs.mkdirSync(data, { recursive: true }); app.setPath('userData', data);
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await win.loadURL('data:text/html,<html><body></body></html>');
    const svg = fs.readFileSync(path.join(root, 'assets', 'icon.svg'), 'utf8');
    const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512];
    const encoded = await win.webContents.executeJavaScript(`(async () => {
      const source = new Image(); source.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)});
      await source.decode();
      return ${JSON.stringify(sizes)}.map(size => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(source, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      });
    })()`);
    const images = encoded.map(value => Buffer.from(value, 'base64'));
    fs.writeFileSync(path.join(root, 'assets', 'icon.png'), images.pop()); sizes.pop();
    const header = Buffer.alloc(6 + sizes.length * 16);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    sizes.forEach((size, i) => {
      const p = 6 + i * 16; header[p] = header[p + 1] = size === 256 ? 0 : size;
      header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
      header.writeUInt32LE(images[i].length, p + 8); header.writeUInt32LE(offset, p + 12);
      offset += images[i].length;
    });
    fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), Buffer.concat([header, ...images]));
    console.log('Website Controller icon: SVG, 512px PNG, and 9 Windows DPI sizes.');
    win.destroy(); app.quit();
  }).catch(error => { console.error(error); app.exit(1); });
}
