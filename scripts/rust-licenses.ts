import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import path from 'node:path';
const cargo=process.env.POLICY_CARGO||'cargo';
const metadata=JSON.parse(execFileSync(cargo,['metadata','--format-version','1','--locked'],{encoding:'utf8',maxBuffer:10*1024*1024}));
const root='packages/rust-core/generated/licenses';mkdirSync(root,{recursive:true});
const packages=metadata.packages.filter((p:any)=>p.source).map((p:any)=>{const dir=path.dirname(p.manifest_path),id=`${p.name}-${p.version}`;mkdirSync(`${root}/${id}`,{recursive:true});for(const file of readdirSync(dir))if(/^(LICENSE|LICENCE|NOTICE|COPYING|UNICODE)/i.test(file))cpSync(`${dir}/${file}`,`${root}/${id}/${file}`,{recursive:true});return {name:p.name,version:p.version,license:p.license,source:p.source};});
writeFileSync(`${root}/dependencies.json`,JSON.stringify(packages,null,2)+'\n');
