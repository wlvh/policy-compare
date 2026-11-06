import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const exec=promisify(execFile);
for(const engine of ['mupdf','pdfjs']){
 const dir=`reports/issue-19/candidate-${engine}`;
 const candidate=JSON.parse(readFileSync(`${dir}/container.json`,'utf8'));
 if(candidate.status!=='PASS')throw new Error('Candidate must have passed image checks');
 const tag=`policy-compare:issue19-cli-${engine}`;
 const args=['build','--target','build','--build-arg',`ENGINE=${engine}`,'--build-arg',`RELEASE_ID=${candidate.releaseId}`,'--build-arg',`REVISION=${candidate.revision}`,'--build-arg','CONTACT=','-f','deploy/Dockerfile','-t',tag,'.'];
 const built=await exec('docker',args,{maxBuffer:16*1024*1024,timeout:600000});writeFileSync(`${dir}/cli-build.log`,built.stdout+built.stderr);
 const cli=(await exec('docker',['image','inspect','--format','{{.Id}}',tag])).stdout.trim();
 const id=(await exec('docker',['run','-d','--rm','--read-only','--user','12345:12345','--cap-drop','ALL','--network','bridge','-p','127.0.0.1::8080',candidate.imageId])).stdout.trim();
 try{
  const origin='http://'+(await exec('docker',['port',id,'8080/tcp'])).stdout.trim();
  for(let n=0;n<100;n++){try{if((await fetch(origin+'/healthz')).ok)break}catch{}await new Promise(r=>setTimeout(r,50));}
  const manifest=JSON.parse(readFileSync(`${dir}/build-info.json`,'utf8'));
  writeFileSync(`${dir}/core-info.json`,JSON.stringify(manifest.coreArtifact,null,2)+'\n');
  const target=`${dir}/cross-entry`;mkdirSync(target,{recursive:true});
  const run=await exec('pnpm',['verify:deployment','tests/browser/rust-core.spec.ts','--grep','frozen inputs'],{timeout:240000,maxBuffer:16*1024*1024,env:{...process.env,POLICY_BROWSER_CHANNEL:'bundled',POLICY_ENGINE:engine,POLICY_BASE_URL:origin+manifest.base,POLICY_REPORT_DIR:target,POLICY_RELEASE_ID:candidate.releaseId,POLICY_MANIFEST_SHA256:candidate.manifestSha256,POLICY_CLI_IMAGE:cli,POLICY_CORE_INFO:path.resolve(`${dir}/core-info.json`)}});
  writeFileSync(`${dir}/cross-entry.log`,run.stdout+run.stderr);
  writeFileSync(`${dir}/cross-entry-candidate.json`,JSON.stringify({status:'PASS',candidateRevision:candidate.revision,imageId:candidate.imageId,cliBuildImageId:cli,coreArtifact:manifest.coreArtifact,evidence:`${target}/cross-entry-${engine}.json`},null,2)+'\n');
  console.log(engine,'PASS',manifest.coreArtifact.sha256);
 }catch(e:any){writeFileSync(`${dir}/cross-entry-failure.log`,(e.stdout||'')+(e.stderr||'')+String(e));throw e;}finally{await exec('docker',['stop',id]);}
}
