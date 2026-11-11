import {it,expect} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {CoreSession,loadCore,coreArtifact} from '../packages/rust-core/index';
import {coreOptions as aviationProfile} from '../packages/compare-core/options';
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
 const s=new CoreSession(module);expect(()=>s.compare()).toThrow('complete');const d=textDoc([{text:'Unchanged input'}]);s.document(0,d);expect(()=>s.page(0,d.pages[0])).toThrow('outside');const other={...d,extractor:{...d.extractor,version:'different'}};s.document(1,other);expect(()=>s.compare()).toThrow('same engine');s.dispose();
});

it('WASM work estimates above 2^32 exhaust the budget rather than wrapping to a small product',()=>{
 const doc=(last:string)=>{const raw='x '.repeat(65536)+last;const lines=[];for(let i=0;i<raw.length;i+=80){const row=i/80;lines.push({text:raw.slice(i,i+80),x:40,y:150+(row%50)*12,page:Math.floor(row/50)});}return textDoc(lines)};
 const r=compare(doc('left'),doc('right'));expect(r.status).toBe('partial');expect(r.unresolved.some(x=>x.reason==='budget')).toBe(true);expect(r.stats.tokenProducts).toBe(0);expect(r.stats.candidates).toBe(0);
},120000);
