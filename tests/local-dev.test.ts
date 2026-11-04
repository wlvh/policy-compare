import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
it('local launcher refuses an occupied port, then starts and stops only its own service',async()=>{
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as {port:number}).port;
 const engine=process.env.POLICY_ENGINE || (existsSync('engines/mupdf/node_modules/mupdf')?'mupdf':'pdfjs');
 const launch=()=>spawn(process.execPath,['--import','tsx',resolve('scripts/local-dev.ts'),engine,String(port)],{env:{...process.env,POLICY_NO_OPEN:'1'},stdio:['ignore','pipe','pipe']});
 const occupied=launch();let message='';occupied.stderr.on('data',b=>message+=b);expect(await new Promise(r=>occupied.once('exit',r))).toBe(1);expect(message).toContain('已被占用');expect(probe.listening).toBe(true);
 await new Promise<void>(r=>probe.close(()=>r()));
 const child=launch();
 try {
   let ready=false;for(let n=0;n<100;n++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}expect(ready).toBe(true);
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}}
 await expect.poll(async()=>{try{await fetch(`http://127.0.0.1:${port}/`);return false;}catch{return true;}}).toBe(true);
},15_000);
