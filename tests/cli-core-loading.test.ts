import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

for(const fault of ['missing','hash-mismatch'] as const)it(`formal CLI reports ${fault} WASM as failed exit 3 without an uncaught stack`,()=>{
 mkdirSync('tmp',{recursive:true});const dir=mkdtempSync(resolve('tmp/cli-core-loading-'));
 try{
  cpSync('packages',join(dir,'packages'),{recursive:true});cpSync('profiles',join(dir,'profiles'),{recursive:true});
  const wasm=join(dir,'packages/rust-core/generated/core.wasm');
  if(fault==='missing')rmSync(wasm);else{const bytes=readFileSync(wasm);bytes[8]^=1;writeFileSync(wasm,bytes);}
  const result=spawnSync(process.execPath,['--import','tsx',join(dir,'packages/cli/main.ts'),'--left',resolve('validation/dataset/cases/R02_amount/before.pdf'),'--right',resolve('validation/dataset/cases/R02_amount/after.pdf'),'--out',join(dir,'out.json')],{cwd:dir,encoding:'utf8',timeout:15000});
  expect(result.error).toBeUndefined();expect(result.status).toBe(3);expect(result.stdout).toBe('');expect(result.stderr).toMatch(/^failed: /);
  expect(result.stderr).toContain(fault==='missing'?'ENOENT':'Rust WASM artifact hash mismatch');expect(result.stderr).not.toMatch(/\n\s+at |triggerUncaughtException|UnhandledPromiseRejection/);
 }finally{rmSync(dir,{recursive:true,force:true})}
},20000);
