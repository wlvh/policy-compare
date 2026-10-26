import {describe,it,expect} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {textDoc} from './helpers';

describe('independent review regressions F1/F3/F4',()=>{
 for(const top of [true,false])for(const long of [false,true])it(`F1 preserves section-field ownership (top=${top}, qualifier=${long})`,()=>{
  const doc=(swap:boolean)=>textDoc([
   {text:'SECTION HULL',y:top?40:170},
   {text:`DEDUCTIBLE: USD ${swap?'2,000':'1,000'}${long?' each and every loss arising from declared operations':''}`,y:top?60:190},
   {text:'SECTION LIABILITY',y:top?80:210},
   {text:`DEDUCTIBLE: USD ${swap?'1,000':'2,000'}${long?' each and every loss arising from declared operations':''}`,y:top?100:230},
  ]);
  const r=compare(doc(false),doc(true));expect(r.status).toBe('complete_for_scope');expect(r.differences).toHaveLength(2);
  for(const [section,oldValue,newValue] of [['SECTION HULL','1,000','2,000'],['SECTION LIABILITY','2,000','1,000']]){
   const d=r.differences.find(d=>d.structurePath?.section===section)!;expect(d).toBeDefined();expect(d.structurePath?.field).toBe('deductible');expect(d.oldText).toContain(oldValue);expect(d.newText).toContain(newValue);expect(d.category).toBe('Material');expect(d.defaultVisible).toBe(true);expect(d.left.length).toBeGreaterThan(0);expect(d.right.length).toBeGreaterThan(0);
  }
 });
 for(const removal of [false,true])it(`F3 local ambiguity does not suppress independent ${removal?'removal':'addition'}`,()=>{
  const repeated=[{text:'GENERAL CONDITIONS'},{text:'The insured must notify all covered events promptly.'},{text:'GENERAL CONDITIONS'},{text:'The insured must notify all covered events promptly.'}];
  const a=textDoc(repeated),b=textDoc([...repeated,{text:'DEDUCTIBLE: USD 25,000'}]);const r=compare(...(removal?[b,a]:[a,b]) as [typeof a,typeof a]);
  expect(r.status).toBe('partial');expect(r.unresolved.length).toBeGreaterThan(0);expect(r.unresolved.flatMap(x=>[...x.left,...x.right]).some(x=>x.text.includes('25,000'))).toBe(false);
  const delta=r.differences.find(d=>d.structurePath?.field==='deductible')!;expect(delta).toBeDefined();expect(delta.kind).toBe(removal?'Removed':'Added');expect(delta.category).toBe('Material');expect(delta.defaultVisible).toBe(true);
 });
 for(const changed of [false,true])it(`F4 renewal requires unchanged non-date content (${changed?'mixed change':'date-only control'})`,()=>{
  const a=textDoc([{text:'PERIOD: 01 April 2024 to 31 March 2025 coverage includes war risks'}]),b=textDoc([{text:`PERIOD: 01 April 2025 to 31 March 2026 coverage ${changed?'excludes':'includes'} war risks`}]);
  const r=compare(a,b);expect(r.differences).toHaveLength(1);expect(r.differences[0].category).toBe(changed?'Material':'RollForward');expect(r.differences[0].defaultVisible).toBe(true);
 });
});
