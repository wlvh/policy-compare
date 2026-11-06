import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
export async function recordEnvironment(dir:string) {
  const walk=(root:string):string[]=>existsSync(root)?readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${root}/${e.name}`):e.name.endsWith('.pdf')?[`${root}/${e.name}`]:[]):[];
  const inputs=Object.fromEntries(['tests/fixtures','validation/dataset/cases','apps/web/public/samples'].flatMap(walk).sort().map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
  const browser=await chromium.launch({channel:process.env.POLICY_BROWSER_CHANNEL==='bundled'?undefined:'chrome'});
  const browserVersion=browser.version();await browser.close();
  const probe=(bin:string,args:string[])=>{try{return execFileSync(bin,args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim();}catch{return 'UNAVAILABLE';}};
  writeFileSync(`${dir}/environment.json`,JSON.stringify({recordedAt:new Date().toISOString(),node:process.version,platform:process.platform,osRelease:os.release(),architecture:os.arch(),cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),browser:browserVersion,sourceRevision:probe('git',['rev-parse','HEAD']),oc:probe('oc',['version','--client']),crc:probe('crc',['version']),kubeContext:probe('kubectl',['config','current-context']),purpose:'Local functional evidence; not ordinary office device or performance acceptance'},null,2)+'\n');
  writeFileSync(`${dir}/input-sha256.json`,JSON.stringify(inputs,null,2)+'\n');
}
