import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadEngine,type EngineName} from '../packages/pdf-adapter/node';
import {structure} from '../packages/compare-core/structure';
import {aviationProfile} from '../profiles/aviation';

const args=process.argv.slice(2);
const value=(key:string,fallback:string)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]??fallback;};
if(args.includes('--help')){
 console.log('pnpm exec tsx scripts/inspect-renewal-structure.ts --inputs tmp/renewal-inputs --engine pdfjs|mupdf|both --out tmp/renewal-structure.json');process.exit(0);
}
const root=path.resolve(value('--inputs','tmp/renewal-inputs'));
const out=path.resolve(value('--out','tmp/renewal-structure.json'));
if(existsSync(out))throw new Error('Choose a new --out file; previous evidence is not overwritten');
const selection=value('--engine','both');
if(!['pdfjs','mupdf','both'].includes(selection))throw new Error('Unknown engine');
const engines:EngineName[]=selection==='both'?['pdfjs','mupdf']:[selection as EngineName];
const records=[];
for(const engine of engines){
 const {extractPdf}=await loadEngine(engine);
 for(const side of ['left','right']){
  const doc=await extractPdf(readFileSync(path.join(root,'testdata/renewal/aviation_2024_vs_2025',side+'.pdf')));
  const page=doc.pages[7],chars=new Map(page.chars.map(c=>[c.id,c]));
  const lines=page.lines.map(l=>({text:l.charIds.map(id=>chars.get(id)!.text).join(''),position:chars.get(l.charIds[0])?.origin}));
  const hpx=lines.find(x=>x.text.includes('HPX 0624'));
  const sameRow=lines.filter(x=>hpx?.position&&x.position&&Math.abs(x.position[1]-hpx.position[1])<2);
  const units=structure(doc,aviationProfile).filter(u=>u.refs.some(r=>r?.page.pageIndex===7)&&(/HPX 0624|HX-AV-|^12\.5%$|^10\.0%$/.test(u.rawText))).map(u=>({text:u.rawText,role:u.role,title:u.title,identity:u.identity,path:u.path,firstPosition:u.refs.find(r=>r!==null)?.char.origin}));
  records.push({engine,side,documentHash:doc.contentHash,sameRow,units});
 }
}
let runnerRevision:string|null=null;
try{runnerRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
mkdirSync(path.dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify({purpose:'Read-only diagnostic of one authored synthetic table; records actual structure, does not change it or score correctness',runnerRevision,records},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:out,records:records.length}));
