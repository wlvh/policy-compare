import {gunzipSync} from 'node:zlib';
import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const coreArtifact=JSON.parse(readFileSync('packages/rust-core/generated/core-info.json','utf8'));
const engine=process.env.POLICY_ENGINE??'mupdf';
const reportDir=process.env.POLICY_REPORT_DIR||'reports';
const fixtures=JSON.parse(readFileSync('reports/issue-19/frozen-baseline.json','utf8')).records.filter((x:any)=>x.engine===engine);
test('frozen inputs: shipped Worker and formal CLI have identical complete core outputs',async({page})=>{
 test.setTimeout(120_000);await page.goto('./');
 const records=[];mkdirSync('tmp/issue19-cli',{recursive:true});
 for(const meta of fixtures){const {docs}=JSON.parse(gunzipSync(readFileSync(meta.file)).toString('utf8'));
  const files=['left','right'].map((s,i)=>{const file=`tmp/issue19-cli/${s}.json`;writeFileSync(file,JSON.stringify(docs[i]));return file;});const out='tmp/issue19-cli/result.json';
  try{execFileSync(process.execPath,['--import','tsx','packages/cli/doc.ts',...files,out],{stdio:'pipe'});}catch(e:any){if(e.status!==2)throw e;}
  const cli=JSON.parse(readFileSync(out,'utf8'));
  const browser=await page.evaluate(async docs=>{
   const info=await(await fetch(new URL('build-info.json',location.href))).json();
   const asset=info.resources.find((x:any)=>/core.worker.*\.js$/.test(x.path));if(!asset)throw new Error('Core worker absent from manifest');
   return await new Promise<any>((resolve,reject)=>{const worker=new Worker(new URL(asset.path,location.href),{type:'module'});const ch=new MessageChannel();
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('core timeout'))},20000);
    worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(new Error(e.message));};
    worker.onmessage=e=>{const m=e.data;if(m.type==='core-ready'){
     docs.forEach((doc:any,side:number)=>{const{pages,...meta}=doc;ch.port2.postMessage({type:'meta',taskId:1,generation:1,side,meta});for(const page of pages)ch.port2.postMessage({type:'page',taskId:1,generation:1,side,page,sentAt:performance.timeOrigin+performance.now()});ch.port2.postMessage({type:'done',taskId:1,generation:1,side,sentAt:performance.timeOrigin+performance.now()});});
    }if(m.type==='result'||m.type==='error'){clearTimeout(timeout);worker.terminate();ch.port2.close();if(m.type==='error')reject(new Error(m.message));else resolve({result:m.result,artifact:m.timings.coreArtifact});}};
    worker.postMessage({type:'init',taskId:1,generation:1,port:ch.port1},[ch.port1]);
   });
  },docs);
  expect(browser.artifact.sha256).toBe(coreArtifact.sha256);expect(browser.result).toEqual(cli);
  records.push({case:meta.case,status:'PASS',coreVersion:cli.coreVersion,sha256:browser.artifact.sha256});
 }
 writeFileSync(`${reportDir}/cross-entry-${engine}.json`,JSON.stringify({status:'PASS',coreArtifact,records},null,2)+'\n');
});
for(const mode of ['cancel','failure','timeout'] as const)test(`WASM initialization ${mode} then retry, no stale task or duplicate transfer`,async({page})=>{
 test.setTimeout(45000);const requested:string[]=[];
 await page.context().route('**/core-*.wasm',async route=>{requested.push(route.request().url());if(mode==='failure')return route.abort();await new Promise<void>(r=>setTimeout(r,mode==='timeout'?17000:2000));try{await route.continue();}catch{}});
 await page.goto('./');await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true');
 await page.getByLabel('基准 PDF',{exact:true}).setInputFiles(path.resolve('validation/dataset/cases/R02_amount/before.pdf'));
 await page.getByLabel('待审 PDF',{exact:true}).setInputFiles(path.resolve('validation/dataset/cases/R02_amount/after.pdf'));
 await page.getByRole('button',{name:'开始比较',exact:true}).click();
 await expect.poll(()=>requested.length).toBe(1);
 if(mode==='cancel'){await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('[data-status]')).toHaveAttribute('data-status','cancelled');}
 else{await expect(page.locator('[data-status]')).toHaveAttribute('data-status','failed',{timeout:18000});}
 await expect.poll(()=>page.workers().length).toBe(0);
 await page.context().unroute('**/core-*.wasm');
 await page.getByRole('button',{name:'开始比较',exact:true}).click();
 await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');
 await expect(page.locator('.card')).toContainText('USD 4,000,000');
 expect((await page.evaluate(()=>window.__policyMetrics)).coreArtifact).toEqual(coreArtifact);
 await page.getByRole('button',{name:'关闭任务',exact:true}).click();await expect.poll(()=>page.workers().length).toBe(0);
});
test('network paths, queries, payloads and diagnostics contain no local document or search secrets',async({page})=>{
 const requests:{url:string;method:string;body:string|null}[]=[];page.context().on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
 await page.goto('./');await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true');
 const secret='PRIVATE_19_秘密_1315';for(const side of ['基准','待审'])await page.getByLabel(`${side} PDF`,{exact:true}).setInputFiles({name:secret+'.pdf',mimeType:'application/pdf',buffer:readFileSync('apps/web/public/samples/P02/before.pdf')});
 await page.getByLabel('基准 PDF 密码',{exact:true}).fill(secret);await page.getByRole('button',{name:'开始比较',exact:true}).click();await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');
 await page.getByLabel('搜索原文').fill(secret);await page.getByRole('button',{name:'搜索',exact:true}).click();
 for(const req of requests){expect(['GET','HEAD']).toContain(req.method);expect(new URL(req.url).origin).toBe(new URL(page.url()).origin);expect(req.body).toBeNull();expect(decodeURIComponent(req.url)).not.toContain(secret);expect(new URL(req.url).search).toBe('');}
 writeFileSync(`${reportDir}/privacy-rust-${engine}.json`,JSON.stringify({status:'PASS',coreArtifact,requests},null,2)+'\n');
});
