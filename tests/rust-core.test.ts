import {it,expect} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {CoreSession,loadCore,coreArtifact} from '../packages/rust-core/index';
import {aviationProfile} from '../profiles/aviation';
import {textDoc} from './helpers';
import {digest,snapshotDigest,resolveLocation} from '../packages/contracts/index';
const module=await loadCore();
it('Rust validates page order, character ownership and UTF-16 source mapping before comparing',()=>{
 for(const mutation of [
  (d:any)=>d.pages[0].pageIndex=1,
  (d:any)=>d.pages[0].lines[0].charIds.pop(),
  (d:any)=>{d.pages[0].chars[0].sourceRef={itemId:'source',scalarRange:[2**32,2**32+1],utf16Range:[0,2]};d.pages[0].textItems=[{id:'source',text:'😀'}]},
  (d:any)=>{d.pages[0].chars[0].sourceRef={itemId:'source',scalarRange:[0,1],utf16Range:[2**32,2**32+2]};d.pages[0].textItems=[{id:'source',text:'😀'}]},
  (d:any)=>{d.pages[0].chars[0].sourceRef={itemId:'source',scalarRange:[0,1],utf16Range:[0,1]};d.pages[0].textItems=[{id:'source',text:'😀'}]},
 ]){const s=new CoreSession(module);const d=textDoc([{text:'😀 insured'}]);mutation(d);expect(()=>s.document(0,d)).toThrow();s.dispose();}
});
it('Rust search preserves scalar to UTF-16 references for a non-BMP, combining mark and ligature',()=>{
 const d=textDoc([{text:'😀e\u0301ﬁ 😀e\u0301ﬁ'}]);const page=d.pages[0];const source=page.chars.map(c=>c.text).join('');page.textItems=[{id:'source',text:source}];let off=0;
 for(const c of page.chars){c.sourceRef={itemId:'source',scalarRange:[c.rawRange[0],c.rawRange[1]],utf16Range:[off,off+c.text.length]};off+=c.text.length;}
 const s=new CoreSession(module);s.document(0,d);s.document(1,d);const result=s.compare();expect(result.coreVersion).toBe(coreArtifact.coreVersion);expect(result.extractionSnapshotHashes).toEqual([snapshotDigest(d),snapshotDigest(d)]);expect(result.configDigest).toBe(digest({profile:aviationProfile,budget:aviationProfile.budget}));
 const hits=s.search('😀éfi','left');expect(hits).toHaveLength(2);for(const hit of hits){expect(hit.map(l=>l.text).join('')).toBe('😀e\u0301ﬁ');for(const l of hit)expect(resolveLocation(l,[d,d])).toBe(true);expect(hit[0].sourceRanges?.[0].utf16Range[1]! - hit[0].sourceRanges?.[0].utf16Range[0]!).toBe(5);}
 s.dispose();expect(()=>s.search('insured')).toThrow('disposed');
});
it('Rust session rejects incomplete documents, mismatched extractors and pages after done',()=>{
 const s=new CoreSession(module);expect(()=>s.compare()).toThrow('complete');const d=textDoc([{text:'Unchanged input'}]);s.document(0,d);expect(()=>s.page(0,d.pages[0])).toThrow('outside');const other={...d,extractor:{...d.extractor,version:'different'}};s.document(1,other);expect(()=>s.compare()).toThrow('同一引擎');s.dispose();
});

it('a continuation title cannot lend its fact to a recovered row with the same raw text',()=>{
 const base=[{text:'SCHEDULE OF AIRCRAFT',x:40,y:150,page:0},{text:'Unchanged scheduled aircraft wording.',x:40,y:300,page:0}];
 const r=compare(textDoc(base),textDoc([...base,{text:'SCHEDULE OF AIRCRAFT CONTINUED',x:40,y:40,page:1},{text:'SCHEDULE OF',x:40,y:300,page:1},{text:'AIRCRAFT',x:200,y:300,page:1},{text:'CONTINUED',x:360,y:300,page:1}]));
 const row=r.differences.find(d=>d.structurePath?.table==='recovered_rows');expect(row).toBeDefined();expect(row!.facts).toEqual([]);
 expect(r.differences.find(d=>d.structurePath?.table===null&&d.newText==='SCHEDULE OF AIRCRAFT CONTINUED')!.facts).toEqual(['continued_heading']);
});

it('page-number facts preserve ECMAScript word boundaries and whitespace outside ASCII',()=>{
 const line=(text:string)=>textDoc([{text,x:40,y:40},{text:'The insured terms remain as written.',x:40,y:300}]);
 expect(compare(line('中Page 3 of 10'),line('中Page 4 of 10')).differences[0].facts).toEqual(['page_number_only']);
 // NEL is content, while BOM is whitespace in JavaScript's original contract.
 expect(compare(line('Page\u00853'),line('Page\u00854')).differences.flatMap(d=>d.facts)).not.toContain('page_number_only');
 expect(compare(line('Page\ufeff3'),line('Page\ufeff4')).differences[0].facts).toEqual(['page_number_only']);
});

it('WASM work estimates above 2^32 exhaust the budget rather than wrapping to a small product',()=>{
 const doc=(last:string)=>{const raw='x '.repeat(65536)+last;const lines=[];for(let i=0;i<raw.length;i+=80){const row=i/80;lines.push({text:raw.slice(i,i+80),x:40,y:150+(row%50)*12,page:Math.floor(row/50)});}return textDoc(lines)};
 const r=compare(doc('left'),doc('right'));expect(r.status).toBe('partial');expect(r.unresolved.some(x=>x.reason==='budget')).toBe(true);expect(r.stats.tokenProducts).toBe(0);expect(r.stats.candidates).toBe(0);
},120000);
