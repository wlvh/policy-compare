import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.includes('--help')){
  console.log('node scripts/fetch-renewal-samples.mjs [--out tmp/renewal-inputs]\nDownloads the pinned synthetic samples and unchanged author answers; verifies size, Git blob SHA-1 and SHA-256. Existing differing files are never overwritten.');
  process.exit(0);
}
if(args.length && (args.length!==2||args[0]!=='--out'||!args[1]))throw new Error('Expected --out DIRECTORY');
const out=path.resolve(args[1]??path.join(root,'tmp/renewal-inputs'));
const manifest=JSON.parse(readFileSync(path.join(root,'reports/renewal-intake/source-manifest.json'),'utf8'));
function verify(data,entry){
  if(data.length!==entry.size)throw new Error(`Size mismatch: ${entry.path}`);
  if(createHash('sha256').update(data).digest('hex')!==entry.sha256)throw new Error(`SHA-256 mismatch: ${entry.path}`);
  if(createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')!==entry.blobSha)throw new Error(`Git blob mismatch: ${entry.path}`);
}
for(const entry of manifest.files){
  const dest=path.resolve(out,entry.path);
  if(!dest.startsWith(out+path.sep))throw new Error('Unsafe source path');
  if(existsSync(dest)){verify(readFileSync(dest),entry);continue;}
  const expected=`https://raw.githubusercontent.com/${manifest.repository}/${manifest.ref}/${entry.path}`;
  if(entry.url!==expected)throw new Error('Source URL is not pinned to the recorded revision');
  const response=await fetch(expected,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Source download HTTP ${response.status}: ${entry.path}`);
  const data=Buffer.from(await response.arrayBuffer());verify(data,entry);
  mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,data,{flag:'wx'});
}
console.log(JSON.stringify({status:'VERIFIED_INPUTS_ONLY',sourceRevision:manifest.ref,files:manifest.files.length,pdfCount:4,output:out,classification:manifest.classification},null,2));
