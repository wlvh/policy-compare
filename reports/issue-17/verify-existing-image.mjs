// Re-run browser verification on immutable bytes, without rebuilding the image.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [engine,image,manifestFile,dir]=process.argv.slice(2);
const exec=(args)=>execFileSync('docker',args,{encoding:'utf8'}).trim();
const manifestBytes=readFileSync(manifestFile),manifest=JSON.parse(manifestBytes),expectedSha=createHash('sha256').update(manifestBytes).digest('hex');
mkdirSync(dir,{recursive:true});
let id='',report={engine,image,releaseId:manifest.releaseId,revision:manifest.revision,manifestSha256:expectedSha,status:'NOT_EVALUATED',browserChannel:'bundled',scope:'Existing actual Linux image, local HTTP container only'};
try{
 id=exec(['run','-d','--rm','--read-only','--user','12345:12345','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','256m','--cpus','1','-p','127.0.0.1::8080',image]);
 const running=JSON.parse(exec(['inspect',id]))[0];
 if(running.Image!==image || running.Mounts.length)throw new Error('Image or mount mismatch');
 const origin='http://'+exec(['port',id,'8080/tcp']);
 for(let n=0;n<60;n++){try{if((await fetch(origin+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const result=spawnSync('pnpm',['verify:deployment',...(process.env.POLICY_FULL_BROWSER==='1' ? [] : ['tests/browser/deployment.spec.ts','tests/browser/lifecycle.spec.ts','tests/browser/review.spec.ts','tests/browser/review-regressions.spec.ts','tests/browser/scroll.spec.ts','tests/browser/one-sided-navigation.spec.ts','tests/browser/repeat-display.spec.ts'])],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:600000,env:{...process.env,POLICY_BROWSER_CHANNEL:'bundled',POLICY_ENGINE:engine,POLICY_BASE_URL:origin+manifest.base,POLICY_RELEASE_ID:manifest.releaseId,POLICY_MANIFEST_SHA256:expectedSha,POLICY_REPORT_DIR:dir}});
 writeFileSync(`${dir}/browser.log`,(result.stdout||'')+(result.stderr||''));
 report={...report,origin,readOnly:running.HostConfig.ReadonlyRootfs,user:running.Config.User,memory:running.HostConfig.Memory,nanoCpus:running.HostConfig.NanoCpus,mounts:running.Mounts,status:result.status===0?'PASS':'FAIL',exitCode:result.status};
}catch(error){report={...report,status:'FAIL',error:String(error)};}finally{if(id){writeFileSync(`${dir}/container.log`,exec(['logs',id]));exec(['stop',id]);}}
writeFileSync(`${dir}/container.json`,JSON.stringify(report,null,2)+'\n');console.log(report);process.exitCode=report.status==='PASS'?0:1;
