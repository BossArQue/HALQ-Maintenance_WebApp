const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC = path.join(__dirname, 'public');

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(PUBLIC, urlPath);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // fallback to index.html for SPA routes
    filePath = path.join(PUBLIC, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const ct = mime[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => console.log('HALQ local server on http://localhost:' + PORT));
