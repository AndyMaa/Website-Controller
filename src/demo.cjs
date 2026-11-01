const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
async function startDemo() {
  const server = http.createServer((request, response) => {
    const isScript = request.url === '/demo.js';
    response.writeHead(200, { 'Content-Type': isScript ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'none'; frame-src 'none'" });
    response.end(fs.readFileSync(path.join(__dirname, 'demo', isScript ? 'demo.js' : 'index.html')));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
module.exports = { startDemo };
