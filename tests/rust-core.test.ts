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

it('WASM rejects an actual scoring pair above 2^32 operations before starting its LCS', () => {
  const make = (marker: string) => {
    // A multi-scalar run avoids constructing 130k test glyph objects per side.
    const doc = textDoc([{ text: marker, y: 100 }, { text: marker, y: 200 }]);
    const [longRun, tail] = doc.pages[0].chars;
    longRun.text = 'x '.repeat(65_536) + marker;
    longRun.precision = 'run';
    longRun.rawRange = [0, longRun.text.length];
    tail.rawRange = [longRun.text.length, longRun.text.length + 1];
    return doc;
  };
  const result = compare(make('A'), make('B'));
  expect(result.status).toBe('partial');
  expect(result.unresolved.some(issue => issue.reason === 'budget')).toBe(true);
  expect(result.stats.tokenProducts).toBe(0);
  expect(result.stats.candidates).toBe(0);
}, 120000);

it('unexamined competitors stay unresolved when scoring runs out of work', () => {
  const doc = (values: string[]) => textDoc(values.map(text => ({ text })));
  const left = doc(['The blue covered item.', 'The blue replacement item.']);
  const right = doc(['The blue covered asset.', 'The blue covered record.']);
  const result = compare(left, right, aviationProfile, { ...aviationProfile.budget, candidates: 1 });
  expect(result.stats.candidates).toBe(1);
  expect(result.differences).toHaveLength(0);
  const unfinished = result.unresolved.find(issue => issue.reason === 'budget');
  expect(unfinished?.left).toHaveLength(2);
  expect(unfinished?.right).toHaveLength(2);
});

it('keeps an isolated receipt change when the default scoring budget is exhausted', () => {
  const inspections = Array.from({ length: 142 }, (_, i) => ({
    oldText: `Safety check record ${i} pending`,
    newText: `Safety check record ${i} cleared`,
    page: Math.floor((i + 1) / 24),
  }));
  const left = textDoc([
    { text: 'Provisional cargo receipt' },
    ...inspections.map(({ oldText: text, page }) => ({ text, page })),
  ]);
  const right = textDoc([
    { text: 'Final cargo receipt' },
    ...inspections.map(({ newText: text, page }) => ({ text, page })),
  ]);
  const result = compare(left, right);
  expect(result.stats.candidates).toBe(20_000);
  expect(result.differences.map(d => [d.oldText, d.newText])).toEqual([
    ['Provisional cargo receipt', 'Final cargo receipt'],
  ]);
  const unfinished = result.unresolved.find(issue => issue.reason === 'budget');
  expect(unfinished?.left).toHaveLength(142);
  expect(unfinished?.right).toHaveLength(142);
  expect(unfinished?.left.every(loc => loc.text.startsWith('Safety check record'))).toBe(true);
  expect(unfinished?.right.every(loc => loc.text.startsWith('Safety check record'))).toBe(true);
});

it('retains a scored receipt as unresolved if a later page could also match it', () => {
  const left = textDoc([
    { text: 'Provisional cargo receipt' },
    { text: 'Safety check record pending' },
    { text: 'Temporary cargo receipt', page: 1 },
  ]);
  const right = textDoc([
    { text: 'Final cargo receipt' },
    { text: 'Safety check record cleared' },
    { text: 'Safety check record archived', page: 1 },
  ]);
  const result = compare(left, right, aviationProfile, { ...aviationProfile.budget, tokenProducts: 25 });
  expect(result.stats.candidates).toBe(2);
  expect(result.stats.tokenProducts).toBe(25);
  expect(result.differences).toHaveLength(0);
  const unfinished = result.unresolved.find(issue => issue.reason === 'budget');
  expect(unfinished?.left.map(loc => loc.text)).toEqual([
    'Provisional cargo receipt', 'Safety check record pending', 'Temporary cargo receipt',
  ]);
  expect(unfinished?.right.map(loc => loc.text)).toContain('Final cargo receipt');
});

it('lists both candidate occurrences for each repeated receipt in source order', () => {
  const doc = (status: string) => textDoc([17, 17, 42, 42].map(site => ({
    text: `Receipt ${site} ${status}`,
  })));
  const result = compare(doc('pending'), doc('cleared'));
  expect(result.stats.candidates).toBe(8);
  expect(result.differences).toHaveLength(8);
  const notices = result.unresolved.filter(issue => issue.reason === 'ambiguous_match');
  expect(notices).toHaveLength(4);
  for (const [i, notice] of notices.entries()) {
    const site = i < 2 ? 17 : 42;
    expect(notice.left.map(loc => loc.text)).toEqual([`Receipt ${site} pending`]);
    expect(notice.right.map(loc => loc.text)).toEqual(Array(2).fill(`Receipt ${site} cleared`));
    expect(notice.right[0].rawRange[0]).toBeLessThan(notice.right[1].rawRange[0]);
  }
});
