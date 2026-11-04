import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, request } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const exec=promisify(execFile), images=process.argv.slice(2);
if(images.length!==2)throw new Error('Usage: tsx scripts/release-rehearsal.ts <previous-image> <candidate-image>');
const dir=process.env.POLICY_REPORT_DIR;
if(!dir)throw new Error('Set POLICY_REPORT_DIR for this rehearsal');
mkdirSync(dir,{recursive:true});
const containers:{id:string;origin:string;info:any;image:string}[]=[];
let gateway:ReturnType<typeof createServer>|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
let report:Record<string,unknown>={status:'NOT_EVALUATED',scope:'Two actual Linux images behind a local HTTP path router; does not prove OpenShift Route or organization environment'};
try {
 for(const image of images){
  const id=(await exec('docker',['run','-d','--rm','--read-only','--user','12345:12345','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','256m','--cpus','1','-p','127.0.0.1::8080',image])).stdout.trim();
  containers.push({id,image,origin:'http://'+(await exec('docker',['port',id,'8080/tcp'])).stdout.trim(),info:null});
  const c=containers.at(-1)!;
  c.info=JSON.parse((await exec('docker',['exec',id,'node','-e',"process.stdout.write(require('node:fs').readFileSync('/app/dist/build-info.json','utf8'))"])).stdout);
 }
 const [old,candidate]=containers;
 if(old.info.base===candidate.info.base)throw new Error('Use two different release paths');
 let current=old;
 gateway=createServer((req,res)=>{
  const destination=containers.find(c=>req.url?.startsWith(c.info.base)) || (req.url==='/'?current:null);
  if(!destination){res.writeHead(404);res.end();return;}
  const upstream=request(destination.origin+req.url,{method:req.method,headers:req.headers},response=>{
   res.writeHead(response.statusCode!,response.headers);response.pipe(res);
  });upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
 });
 await new Promise<void>(r=>gateway!.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${(gateway.address() as {port:number}).port}`;
 browser=await chromium.launch({channel:process.env.POLICY_BROWSER_CHANNEL==='bundled'?undefined:'chrome'});
 const context=await browser.newContext({viewport:{width:1500,height:1000}});
 const failures:string[]=[];
 context.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${new URL(r.url()).pathname}`);});
 const retained=await context.newPage();await retained.goto(origin);expect(new URL(retained.url()).pathname).toBe(old.info.base);
 await expect(retained.locator('main')).toHaveAttribute('data-engine-ready','true');
 current=candidate;
 // Start the first PDF task only after switching: worker/font/WASM requests
 // from the old tab must still use its old, retained release service.
 await retained.getByRole('button',{name:'P02 金额变化',exact:true}).click();
 await expect(retained.locator('[data-status]')).toHaveAttribute('data-status',/complete_for_scope|partial/);
 await expect(retained.locator('.cards')).toContainText('USD 2000');
 await expect(retained.locator('polygon').first()).toBeVisible();
 const fresh=await context.newPage();await fresh.goto(origin);expect(new URL(fresh.url()).pathname).toBe(candidate.info.base);
 await fresh.getByRole('button',{name:'E03 扫描图片',exact:true}).click();await expect(fresh.locator('.gaps')).toContainText('只有图片');
 current=old;
 const rollback=await context.newPage();await rollback.goto(origin);expect(new URL(rollback.url()).pathname).toBe(old.info.base);
 await rollback.getByRole('button',{name:'P01 相同文件',exact:true}).click();await expect(rollback.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(rollback.locator('.card')).toHaveCount(0);
 await fresh.getByRole('button',{name:'P02 金额变化',exact:true}).click();await expect(fresh.locator('.cards')).toContainText('USD 2000');
 expect(failures).toEqual([]);
 await retained.screenshot({path:`${dir}/retained-tab.png`,fullPage:true});
 report={...report,status:'PASS',origin,previous:{image:old.image,releaseId:old.info.releaseId,revision:old.info.revision},candidate:{image:candidate.image,releaseId:candidate.info.releaseId,revision:candidate.info.revision},checks:['old tab first comparison after promotion','new root resolves candidate','root rollback resolves previous','candidate tab works after rollback'],resourceFailures:failures};
}catch(error){report={...report,status:'FAIL',error:String(error)};}finally{
 await browser?.close();if(gateway)await new Promise<void>(r=>gateway!.close(()=>r()));
 for(const c of containers)await exec('docker',['stop',c.id]);
}
writeFileSync(`${dir}/rehearsal.json`,JSON.stringify(report,null,2)+'\n');console.log(report);process.exitCode=report.status==='PASS'?0:1;
