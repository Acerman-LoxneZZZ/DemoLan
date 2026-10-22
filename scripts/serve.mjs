import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/config.js';
import { renderDocument } from '../src/page.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' });
      res.end(renderDocument(site));
      return;
    }
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep) || !/^\/(src|assets)\//.test(path) || !(await stat(file)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Страница не найдена');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`ПРОЯВЛЕНО · Local: http://localhost:${port}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
