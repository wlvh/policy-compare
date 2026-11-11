import {inspectCliCoreArtifact,assertSameCoreArtifact} from '../../scripts/cli-core-artifact';
import {gunzipSync} from 'node:zlib';
import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const coreArtifact=JSON.parse(readFileSync(process.env.POLICY_CORE_INFO||'packages/rust-core/generated/core-info.json','utf8'));
const cliImage=process.env.POLICY_CLI_IMAGE;
const engine=process.env.POLICY_ENGINE??'mupdf';
const reportDir=process.env.POLICY_REPORT_DIR||'reports';
const fixtures=JSON.parse(readFileSync('reports/issue-19/frozen-baseline.json','utf8')).records.filter((x:any)=>x.engine===engine);
test('frozen inputs: shipped Worker and formal CLI have identical complete core outputs',async({page})=>{
 test.setTimeout(120_000);await page.goto('./');
 const records=[];
 const cliImageId=cliImage?execFileSync('docker',['image','inspect','--format','{{.Id}}',cliImage],{encoding:'utf8'}).trim():undefined;
 const cliArtifact=inspectCliCoreArtifact(cliImageId);
 const cliDir=path.resolve('tmp/issue19-cli',engine,(cliImageId||'host').replaceAll(/[:/]/g,'_'));mkdirSync(cliDir,{recursive:true});
 assertSameCoreArtifact(coreArtifact.sha256,cliArtifact);
 for(const meta of fixtures){const {docs,result:legacy}=JSON.parse(gunzipSync(readFileSync(meta.file)).toString('utf8'));
  const files=['left','right'].map((s,i)=>{const file=path.join(cliDir,`${s}.json`);writeFileSync(file,JSON.stringify(docs[i]));return file;});const out=path.join(cliDir,'result.json');
  try{if(cliImageId){execFileSync('docker',['run','--rm','--network','none','-v',`${cliDir}:/inputs`,cliImageId,'node','--import','tsx','packages/cli/doc.ts','/inputs/left.json','/inputs/right.json','/inputs/result.json'],{stdio:'pipe'});}else{execFileSync(process.execPath,['--import','tsx','packages/cli/doc.ts',...files,out],{stdio:'pipe'});}}catch(e:any){if(e.status!==2)throw e;}
  const cli=JSON.parse(readFileSync(out,'utf8'));expect(cli).toEqual({...legacy,coreVersion:cli.coreVersion});
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
  expect(browser.artifact.sha256).toBe(coreArtifact.sha256);assertSameCoreArtifact(browser.artifact.sha256,cliArtifact);expect(browser.result).toEqual(cli);
  records.push({case:meta.case,status:'PASS',coreVersion:cli.coreVersion,browserCoreSha256:browser.artifact.sha256,cliCoreSha256:cliArtifact.sha256});
 }
 writeFileSync(`${reportDir}/cross-entry-${engine}.json`,JSON.stringify({evidenceSchemaVersion:'cross-entry-core/2',status:'PASS',coreArtifact,cliArtifact,cliImageId:cliImageId??null,browserCoreSha256:coreArtifact.sha256,cliCoreSha256:cliArtifact.sha256,records},null,2)+'\n');
});
for (const mode of ['cancel', 'failure', 'timeout'] as const) test(`WASM initialization ${mode} then retry, no stale task or duplicate transfer`, async ({ page }) => {
  test.setTimeout(45_000);
  const requested: string[] = [];
  let releaseDownload!: () => void;
  const held = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.context().route('**/core-*.wasm', async route => {
    requested.push(route.request().url());
    if (mode === 'failure') return route.abort();
    if (mode === 'timeout') await held;
    else await new Promise(resolve => setTimeout(resolve, 2_000));
    try { await route.continue(); } catch { /* The terminated worker has already cancelled this request. */ }
  });
  await page.goto('./');
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true');
  if (mode === 'timeout') await page.clock.install();
  await page.getByLabel('Baseline PDF', { exact: true }).setInputFiles(path.resolve('validation/dataset/cases/R02_amount/before.pdf'));
  await page.getByLabel('Revised PDF', { exact: true }).setInputFiles(path.resolve('validation/dataset/cases/R02_amount/after.pdf'));
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect.poll(() => requested.length).toBe(1);
  if (mode === 'cancel') {
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'cancelled');
  } else {
    if (mode === 'timeout') await page.clock.fastForward(60_001);
    await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'failed');
    if (mode === 'timeout') await expect(page.getByRole('status')).toContainText('exceeded 60 seconds');
  }
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.context().unroute('**/core-*.wasm');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope');
  await expect(page.locator('.card')).toContainText('USD 4,000,000');
  expect((await page.evaluate(() => window.__policyMetrics)).coreArtifact).toEqual(coreArtifact);
  await page.getByRole('button', { name: 'Close task', exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
});
test('network paths, queries, payloads and diagnostics contain no local document or search secrets',async({page})=>{
 const requests:{url:string;method:string;body:string|null}[]=[];page.context().on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
 await page.goto('./');await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true');
 const secret='PRIVATE_19_秘密_1315';for(const side of ['Baseline','Revised'])await page.getByLabel(`${side} PDF`,{exact:true}).setInputFiles({name:secret+'.pdf',mimeType:'application/pdf',buffer:readFileSync('apps/web/public/samples/P02/before.pdf')});
 await page.getByLabel('Baseline PDF password',{exact:true}).fill(secret);await page.getByRole('button',{name:'Compare',exact:true}).click();await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');
 await page.getByLabel('Search source text').fill(secret);await page.getByRole('button',{name:'Search',exact:true}).click();
 for(const req of requests){expect(['GET','HEAD']).toContain(req.method);expect(new URL(req.url).origin).toBe(new URL(page.url()).origin);expect(req.body).toBeNull();expect(decodeURIComponent(req.url)).not.toContain(secret);expect(new URL(req.url).search).toBe('');}
 writeFileSync(`${reportDir}/privacy-rust-${engine}.json`,JSON.stringify({status:'PASS',coreArtifact,requests},null,2)+'\n');
});
