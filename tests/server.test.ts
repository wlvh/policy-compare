import {it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
it('F7 only fingerprinted assets are immutable; fixed engine URLs revalidate',async()=>{
 const root=mkdtempSync(join(tmpdir(),'policy-cache-'));mkdirSync(join(root,'assets'));mkdirSync(join(root,'pdfjs/wasm'),{recursive:true});writeFileSync(join(root,'index.html'),'test');writeFileSync(join(root,'assets/index-Abc12345.js'),'version one');writeFileSync(join(root,'pdfjs/wasm/openjpeg.wasm'),'decoder one');
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as {port:number}).port;await new Promise<void>(r=>probe.close(()=>r()));
 const child=spawn(process.execPath,[resolve('deploy/server.mjs')],{env:{...process.env,STATIC_ROOT:root,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'}),origin=`http://127.0.0.1:${port}`;
 try{
  let ready=false;for(let n=0;n<50;n++){try{if((await fetch(origin+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,20));}expect(ready).toBe(true);
  expect((await fetch(origin+'/assets/index-Abc12345.js')).headers.get('cache-control')).toContain('immutable');
  for(const url of ['/', '/pdfjs/wasm/openjpeg.wasm'])expect((await fetch(origin+url)).headers.get('cache-control')).toBe('no-cache');
  writeFileSync(join(root,'pdfjs/wasm/openjpeg.wasm'),'decoder two');expect(await(await fetch(origin+'/pdfjs/wasm/openjpeg.wasm')).text()).toBe('decoder two');
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}rmSync(root,{recursive:true,force:true});}
});
