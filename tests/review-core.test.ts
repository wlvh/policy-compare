import {describe,it,expect} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {ResultSchemaV2 as ResultSchema} from '../packages/contracts/index';
import {textDoc} from './helpers';

describe('independent review regressions F1/F3/F4',()=>{
 for(const recognized of [true,false])it(`F1 repeated keys cannot erase swaps when heading ownership is ${recognized?'stable':'unresolved'}`,()=>{
  const doc=(swap:boolean)=>textDoc([{text:recognized?'HULL':'Hull coverage',y:170},{text:`DEDUCTIBLE: USD ${swap?'2,000':'1,000'} each and every loss arising from declared operations`,y:190},{text:recognized?'LIABILITY':'Liability coverage',y:210},{text:`DEDUCTIBLE: USD ${swap?'1,000':'2,000'} each and every loss arising from declared operations`,y:230}]);
  const result=compare(doc(false),doc(true));
  if(recognized){expect(result.status).toBe('complete_for_scope');expect(result.differences).toHaveLength(2);for(const section of ['HULL','LIABILITY']){const d=result.differences.find(d=>d.structurePath?.section===section)!;expect(d).toBeDefined();expect(d.facts).toEqual([]);}}
  else{expect(result.status).toBe('partial');const d=result.differences.find(d=>d.hasTextChange&&d.structurePath?.field==='deductible')!;expect(d).toBeDefined();expect(d.defaultVisible).toBe(true);expect(d.oldText).toContain('1,000');expect(d.oldText).toContain('2,000');expect(d.newText).not.toBe(d.oldText);expect(d.left.length).toBeGreaterThan(0);expect(d.right.length).toBeGreaterThan(0);expect(result.unresolved.some(u=>u.reason==='ambiguous_identity')).toBe(true);}
 });
 for(const top of [true,false])for(const long of [false,true])it(`F1 preserves section-field ownership (top=${top}, qualifier=${long})`,()=>{
  const doc=(swap:boolean)=>textDoc([
   {text:'SECTION HULL',y:top?40:170},
   {text:`DEDUCTIBLE: USD ${swap?'2,000':'1,000'}${long?' each and every loss arising from declared operations':''}`,y:top?60:190},
   {text:'SECTION LIABILITY',y:top?80:210},
   {text:`DEDUCTIBLE: USD ${swap?'1,000':'2,000'}${long?' each and every loss arising from declared operations':''}`,y:top?100:230},
  ]);
  const r=compare(doc(false),doc(true));expect(r.status).toBe('complete_for_scope');expect(r.differences).toHaveLength(2);
  for(const [section,oldValue,newValue] of [['SECTION HULL','1,000','2,000'],['SECTION LIABILITY','2,000','1,000']]){
   const d=r.differences.find(d=>d.structurePath?.section===section)!;expect(d).toBeDefined();expect(d.structurePath?.field).toBe('deductible');expect(d.oldText).toContain(oldValue);expect(d.newText).toContain(newValue);expect(d.facts).toEqual([]);expect(d.defaultVisible).toBe(true);expect(d.left.length).toBeGreaterThan(0);expect(d.right.length).toBeGreaterThan(0);
  }
 });
 for(const removal of [false,true])it(`F3 local ambiguity does not suppress independent ${removal?'removal':'addition'}`,()=>{
  const repeated=[{text:'GENERAL CONDITIONS'},{text:'The insured must notify all covered events promptly.'},{text:'GENERAL CONDITIONS'},{text:'The insured must notify all covered events promptly.'}];
  const a=textDoc(repeated),b=textDoc([...repeated,{text:'DEDUCTIBLE: USD 25,000'}]);const r=compare(...(removal?[b,a]:[a,b]) as [typeof a,typeof a]);
  expect(r.status).toBe('partial');expect(r.unresolved.length).toBeGreaterThan(0);expect(r.unresolved.flatMap(x=>[...x.left,...x.right]).some(x=>x.text.includes('25,000'))).toBe(false);
  const delta=r.differences.find(d=>d.structurePath?.field==='deductible')!;expect(delta).toBeDefined();expect(delta.kind).toBe(removal?'Removed':'Added');expect(delta.facts).toEqual([]);expect(delta.defaultVisible).toBe(true);
 });
 for(const changed of [false,true])it(`F4 renewal requires unchanged non-date content (${changed?'mixed change':'date-only control'})`,()=>{
  const a=textDoc([{text:'PERIOD: 01 April 2024 to 31 March 2025 coverage includes war risks'}]),b=textDoc([{text:`PERIOD: 01 April 2025 to 31 March 2026 coverage ${changed?'excludes':'includes'} war risks`}]);
  const r=compare(a,b);expect(r.differences).toHaveLength(1);expect(r.differences[0].facts).toEqual(changed?[]:['dates_rolled_forward_one_year']);expect(r.differences[0].defaultVisible).toBe(true);
 });
});

describe('explicit numbered chapter headings keep field ownership',()=>{
 for(const [first,second] of [['SECTION 10.1','SECTION 10.2'],['CHAPTER 3','CHAPTER 4'],['SECTION A','SECTION B']])it(`${first} / ${second}: only the first sum insured changes`,()=>{
  const doc=(value:string)=>textDoc([{text:first,y:170},{text:`SUM INSURED: USD ${value}`,y:190},{text:second,y:210},{text:'SUM INSURED: USD 100,000',y:230}]);
  const r=ResultSchema.parse(compare(doc('100,000'),doc('150,000')));
  expect(r.status).toBe('complete_for_scope');expect(r.unresolved).toHaveLength(0);
  const changed=r.differences.filter(d=>d.hasTextChange);expect(changed).toHaveLength(1);
  expect(changed[0].structurePath?.section).toBe(first);expect(changed[0].structurePath?.field).toBe('sum_insured');
  expect(changed[0].oldText).toContain('100,000');expect(changed[0].newText).toContain('150,000');expect(changed[0].facts).toEqual([]);
 });
});
