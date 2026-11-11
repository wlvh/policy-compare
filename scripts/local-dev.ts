import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
const engine = process.argv[2] || 'mupdf', port = Number(process.argv[3] || 8080);
function fail(message: string): never { console.error(message); process.exit(1); }
if (process.versions.node.split('.')[0] !== '24') fail('Node.js 24 is required. Switch versions and try again.');
if (execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim() !== '10.12.1') fail('pnpm 10.12.1 is required.');
if (!['mupdf','pdfjs'].includes(engine) || !Number.isInteger(port) || port < 1024 || port > 65535) fail('Usage: pnpm start:local [mupdf|pdfjs] [port: 1024–65535]');
if (!existsSync(`engines/${engine}/node_modules`)) fail(`Run pnpm install:${engine} first`);
const probe = createServer();
await new Promise<void>((resolve,reject) => { probe.once('error',reject); probe.listen(port,'127.0.0.1',resolve); }).catch(()=>fail(`Port ${port} is already in use. Choose another port; other services will remain running.`));
await new Promise<void>(resolve=>probe.close(()=>resolve()));
const child = spawn('pnpm',[`dev:${engine}`,'--port',String(port),'--strictPort'],{stdio:'inherit',env:process.env,detached:process.platform!=='win32'});
const stop = (signal:NodeJS.Signals='SIGTERM') => { if (child.exitCode === null && child.pid) { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); } catch {} } };
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>stop(signal));
child.on('error',error=>fail('Startup failed: '+error.message));
child.on('exit',code=>process.exit(code ?? 1));
const url = `http://127.0.0.1:${port}/`;
for (let attempt=0; attempt<100 && child.exitCode === null; attempt++) {
  try { if ((await fetch(url)).ok) {
    console.log(`Local development URL: ${url}; press Ctrl+C to stop this service.`);
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    if (process.env.POLICY_NO_OPEN !== '1') { const opener = spawn(command,[url],{stdio:'ignore'}); opener.on('error',()=>console.log('Could not open a browser automatically. Open the URL above manually.')); }
    break;
  }} catch {}
  await new Promise(resolve=>setTimeout(resolve,200));
  if (attempt === 99) { stop(); fail('The service was not ready within 20 seconds. Check the startup errors above.'); }
}
