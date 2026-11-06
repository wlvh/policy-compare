import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectCliCoreArtifact,assertSameCoreArtifact} from '../scripts/cli-core-artifact';
import {CoreSession} from '../packages/rust-core/index';
import {textDoc} from './helpers';

it('rejects a CLI file with a different SHA even when its own manifest and complete comparison output agree',()=>{
 const original=readFileSync('packages/rust-core/generated/core.wasm');
 // A valid empty-name custom section changes bytes, not the executable code.
 const altered=Buffer.concat([original,Buffer.from([0,1,0])]);expect(WebAssembly.validate(altered)).toBe(true);
 const a=new CoreSession(new WebAssembly.Module(original)),b=new CoreSession(new WebAssembly.Module(altered));
 const left=textDoc([{text:'Limit USD 1000'}]),right=textDoc([{text:'Limit USD 2000'}]);
 try{for(const s of [a,b]){s.document(0,left);s.document(1,right);}expect(b.compare()).toEqual(a.compare());}finally{a.dispose();b.dispose();}
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/cli-core-audit-'));
 try{
  const dir=join(root,'packages/rust-core/generated');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'core.wasm'),altered);
  const own=JSON.parse(readFileSync('packages/rust-core/generated/core-info.json','utf8'));own.sha256=createHash('sha256').update(altered).digest('hex');writeFileSync(join(dir,'core-info.json'),JSON.stringify(own));
  const cli=inspectCliCoreArtifact(undefined,root);const browserSha=createHash('sha256').update(original).digest('hex');
  expect(cli.sha256).toBe(own.sha256);expect(()=>assertSameCoreArtifact(browserSha,cli)).toThrow('Browser/CLI WASM hashes differ');
  own.sha256=browserSha;writeFileSync(join(dir,'core-info.json'),JSON.stringify(own));expect(()=>inspectCliCoreArtifact(undefined,root)).toThrow('CLI WASM bytes do not match its own core-info.json');
 }finally{rmSync(root,{recursive:true,force:true})}
});
