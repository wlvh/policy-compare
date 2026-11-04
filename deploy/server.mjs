import http from 'node:http';
import { createReadStream, statSync, realpathSync, readFileSync, existsSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';

const root = realpathSync(process.env.STATIC_ROOT || 'dist');
const port = Number(process.env.PORT || 8080), host = process.env.HOST || '127.0.0.1';
const infoPath = resolve(root, 'build-info.json');
const info = existsSync(infoPath) ? JSON.parse(readFileSync(infoPath, 'utf8')) : null;
const base = info?.base || '/';
if (base !== '/' && (!/^[a-z][a-z0-9-]{0,39}$/.test(info?.releaseId) || base !== `/releases/${info.releaseId}/`)) throw new Error('Invalid release base');
if (!statSync(resolve(root, 'index.html')).isFile()) throw new Error('Missing index.html');
// Validate the built bytes before readiness; never repair a release at runtime.
if (info) {
  if (!['pdfjs','mupdf'].includes(info.engine) || !Array.isArray(info.resources) || !info.resources.some(r => r.path === 'index.html')) throw new Error('Invalid resource manifest');
  for (const item of info.resources) {
    if (typeof item.path !== 'string' || item.path.split('/').some(p => !p || p.startsWith('.'))) throw new Error('Invalid resource path');
    const file = realpathSync(resolve(root, item.path));
    if (!file.startsWith(root + sep)) throw new Error('Resource outside static root');
    const bytes = readFileSync(file);
    if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error(`Resource integrity failure: ${item.path}`);
  }
}
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ttf':'font/ttf','.otf':'font/otf','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf'};
http.createServer((req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'self'");
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD','Connection':'close'}); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (pathname === '/healthz') { res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}'); return; }
  if (base !== '/' && pathname === '/') { res.writeHead(302,{'Location':base,'Cache-Control':'no-store'}); res.end(); return; }
  if (!pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
  const relative = pathname.slice(base.length) || 'index.html';
  if (relative.split('/').some(p => p.startsWith('.')) || relative.includes('\0')) { res.writeHead(404); res.end(); return; }
  try {
    const file = realpathSync(resolve(root,relative));
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error('Not a static file');
    const fingerprinted = /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|mjs|css|wasm)$/.test(relative);
    res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Content-Length':statSync(file).size,'Cache-Control':base !== '/' || fingerprinted ? 'public, max-age=31536000, immutable' : 'no-cache'});
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch { res.writeHead(404,{'Cache-Control':'no-store'}); res.end(); }
}).listen(port,host,()=>console.log(`Static policy review application on ${host}:${port}${base}; no upload endpoint`));
