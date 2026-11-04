import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
const engine = process.argv[2] || 'mupdf', port = Number(process.argv[3] || 8080);
function fail(message: string): never { console.error(message); process.exit(1); }
if (process.versions.node.split('.')[0] !== '24') fail('需要 Node.js 24。请切换版本后重试。');
if (execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim() !== '10.12.1') fail('需要 pnpm 10.12.1。');
if (!['mupdf','pdfjs'].includes(engine) || !Number.isInteger(port) || port < 1024 || port > 65535) fail('用法：pnpm start:local [mupdf|pdfjs] [1024–65535 端口]');
if (!existsSync(`engines/${engine}/node_modules`)) fail(`请先执行 pnpm install:${engine}`);
const probe = createServer();
await new Promise<void>((resolve,reject) => { probe.once('error',reject); probe.listen(port,'127.0.0.1',resolve); }).catch(()=>fail(`端口 ${port} 已被占用，请选另一个端口。不会停止其他服务。`));
await new Promise<void>(resolve=>probe.close(()=>resolve()));
const child = spawn('pnpm',[`dev:${engine}`,'--port',String(port),'--strictPort'],{stdio:'inherit',env:process.env,detached:process.platform!=='win32'});
const stop = (signal:NodeJS.Signals='SIGTERM') => { if (child.exitCode === null && child.pid) { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); } catch {} } };
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>stop(signal));
child.on('error',error=>fail('启动失败：'+error.message));
child.on('exit',code=>process.exit(code ?? 1));
const url = `http://127.0.0.1:${port}/`;
for (let attempt=0; attempt<100 && child.exitCode === null; attempt++) {
  try { if ((await fetch(url)).ok) {
    console.log(`本地开发入口：${url}；按 Ctrl+C 停止本次服务。`);
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    if (process.env.POLICY_NO_OPEN !== '1') { const opener = spawn(command,[url],{stdio:'ignore'}); opener.on('error',()=>console.log('无法自动打开浏览器，请手动打开上述地址。')); }
    break;
  }} catch {}
  await new Promise(resolve=>setTimeout(resolve,200));
  if (attempt === 99) { stop(); fail('服务未在 20 秒内就绪，请查看上方启动错误。'); }
}
