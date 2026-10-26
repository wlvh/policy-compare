import http from 'node:http';
import { createReadStream,statSync,realpathSync } from 'node:fs';
import { resolve,sep,extname } from 'node:path';
const root=realpathSync(process.env.STATIC_ROOT||'dist'),port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ttf':'font/ttf','.otf':'font/otf'};
http.createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'self'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD','Connection':'close'});res.end('Method not allowed');return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:'{"status":"ok"}');return;}
  if(pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
  let file=resolve(root,'.'+pathname);
  try{if(!statSync(file).isFile())file=resolve(root,'index.html');}catch{if(extname(pathname)){res.writeHead(404);res.end();return;}file=resolve(root,'index.html');}
  try{file=realpathSync(file);if(!file.startsWith(root+sep))throw new Error('outside root');const size=statSync(file).size;
    // Only Vite's content-fingerprinted assets are immutable. Fixed decoder,
    // font and CMap URLs must revalidate after an in-place site upgrade.
    const fingerprinted=/^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|mjs|css|wasm)$/.test(pathname);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':size,'Cache-Control':fingerprinted?'public, max-age=31536000, immutable':'no-cache'});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);}catch{res.writeHead(404);res.end();}
}).listen(port,host,()=>console.log(`Static policy review application on ${host}:${port}; no upload endpoint`));
