import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=process.cwd(),report=process.env.POLICY_SCROLL_REPORT_DIR||'reports/issue-19/review-followup/scroll-comparison';
mkdirSync(report,{recursive:true});const records:any[]=[];
const paths=['apps','packages','profiles','engines/pdfjs','package.json','pnpm-lock.yaml','tsconfig.json','tsconfig.pdfjs.json','vite.config.ts','scripts/release-config.ts'];
for(const [label,revision]of [['baseline','6a5f1ef7e3f6997e58a1bf303774419c16cb994b'],['reviewed','f49500b41b3f66cad3ec403d9dbcb3cb7e25eb53']]){
 const dir=path.resolve(`tmp/review20-scroll-${label}`);if(existsSync(dir))throw new Error('Choose a fresh checkout for comparison; frozen source directory exists');mkdirSync(dir,{recursive:true});
 const tar=execFileSync('git',['archive',revision,...paths],{maxBuffer:64*1024*1024});const archive=path.join(dir,'source.tar');writeFileSync(archive,tar);execFileSync('tar',['-xf',archive,'-C',dir]);
 symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');symlinkSync(path.join(root,'engines/pdfjs/node_modules'),path.join(dir,'engines/pdfjs/node_modules'),'dir');
 if(label==='reviewed'){
  const diff=execFileSync('git',['diff',revision,'HEAD','--','crates','Cargo.toml','Cargo.lock','rust-toolchain.toml'],{encoding:'utf8'});if(diff.trim())throw new Error('Frozen Rust source differs; do not substitute another core');
  symlinkSync(path.join(root,'packages/rust-core/generated'),path.join(dir,'packages/rust-core/generated'),'dir');
 }
 const env={...process.env,POLICY_ENGINE:'pdfjs',POLICY_RELEASE_ID:'development',POLICY_REVISION:revision};
 execFileSync('pnpm',['exec','tsc','-p','tsconfig.pdfjs.json','--noEmit'],{cwd:dir,env,stdio:'pipe'});
 const built=execFileSync('pnpm',['exec','vite','build'],{cwd:dir,env,encoding:'utf8'});writeFileSync(`${report}/${label}-build.log`,built);
 const target=path.resolve(report,label);mkdirSync(target,{recursive:true});const site=path.join(dir,'dist/pdfjs');writeFileSync(`${target}/build-info.json`,readFileSync(path.join(site,'build-info.json')));
 const run=spawnSync('pnpm',['exec','playwright','test','--config','playwright.scroll-review.config.ts'],{env:{...env,POLICY_REPORT_DIR:target,POLICY_SCROLL_SITE:site,POLICY_BASE_URL:'http://127.0.0.1:4180/'},encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});writeFileSync(`${target}/browser.log`,(run.stdout||'')+(run.stderr||''));
 if(!existsSync(`${target}/browser-tests-pdfjs.json`))throw new Error('Comparison could not collect a test report');
 const data=JSON.parse(readFileSync(`${target}/browser-tests-pdfjs.json`,'utf8'));const cases:any[]=[];const walk=(s:any)=>{for(const spec of s.specs||[])for(const t of spec.tests)cases.push({title:spec.title,status:t.results.map((r:any)=>r.status),errors:t.results.flatMap((r:any)=>r.errors||[])});for(const c of s.suites||[])walk(c);};walk(data);
 records.push({label,revision,exitCode:run.status,stats:data.stats,cases});
}
writeFileSync(`${report}/comparison.json`,JSON.stringify({scope:'Evidence collection on one runner and bundled Chromium; full preceding container-suite sequence retained; individual failures remain failures',node:process.version,os:os.release(),arch:process.arch,records},null,2)+'\n');
console.log(records.map(x=>({label:x.label,exitCode:x.exitCode,stats:x.stats,scroll:x.cases.filter((c:any)=>c.title.startsWith('wheel crosses'))})));
