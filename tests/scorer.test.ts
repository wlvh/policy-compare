import { describe,it,expect } from 'vitest';
import { compare } from '../packages/compare-core/index';
import { textDoc } from './helpers';
import { grade,type Expected,type Layout } from './evaluation/scorer';
import type { CompareResult,DocInput } from '../packages/contracts/index';
function example(){const left=textDoc([{text:'SUMS INSURED:',x:40,y:150},{text:'USD 100',x:180,y:150}]),right=textDoc([{text:'SUMS INSURED:',x:40,y:150},{text:'USD 200',x:180,y:150}]);
  const expected:Expected={case_id:'independent-scorer-test',required_status:'complete_for_scope',events:[{event_id:'amount',logical_path:'risk_details.sum_insured',old:'USD 100',new:'USD 200',operation:'replace',detection_requirement:'must_detect',acceptable_kinds:['Replaced'],acceptable_categories:['Material','Review']}],invariants:[],coverage_requirements:[],evidence_locations:{amount:{before:[{page_index:0,run_id:'amount'}],after:[{page_index:0,run_id:'amount'}]}}};
  const page=(d:DocInput)=>({text_runs:[{run_id:'amount',text:'USD',direction:[1,0],characters:d.pages[0].chars.filter(c=>c.origin[0]>=180).map(c=>({quad_tl_tr_br_bl:[[c.quad[0],c.quad[1]],[c.quad[2],c.quad[3]],[c.quad[6],c.quad[7]],[c.quad[4],c.quad[5]]]}))}]});
  return {docs:[left,right] as [DocInput,DocInput],expected,layout:{before:{pages:[page(left)]},after:{pages:[page(right)]}} as Layout,result:compare(left,right)};
}
describe('independent grader rejects dishonest outputs',()=>{
  it('accepts valid evidence and a genuine control',()=>{const x=example();expect(grade(x.result,x.expected,x.layout,x.docs).status).toBe('PASS');x.expected.events=[];x.expected.invariants=['no_content_differences'];expect(grade(compare(x.docs[0],x.docs[0]),x.expected,x.layout,[x.docs[0],x.docs[0]]).status).toBe('PASS');});
  const mutations:Record<string,(r:CompareResult)=>void>={
    'empty required output':r=>{r.differences=[];},
    'wrong subject':r=>{r.differences[0].structurePath!.entity='wrong';},
    'wrong page':r=>{r.differences[0].left[0].pageIndex=9;},
    'hidden event':r=>{(r.differences[0] as unknown as {defaultVisible:boolean}).defaultVisible=false;},
    'invalid source':r=>{r.differences[0].left[0].charIds=['missing'];},
    'reversed sides':r=>{[r.differences[0].left,r.differences[0].right]=[r.differences[0].right,r.differences[0].left];},
    'unjustified partial':r=>{r.status='partial';},
    'wrong operation':r=>{r.differences[0].kind='Added';},
    'no precise changed source':r=>{r.differences[0].textOps=[];},
  };
  for(const [name,mutate] of Object.entries(mutations))it(name,()=>{const x=example();mutate(x.result);expect(grade(x.result,x.expected,x.layout,x.docs).status).toBe('FAIL');});
  for(const mode of ['empty','generic warning','wrong region','incorrect complete'])it('coverage: '+mode,()=>{const x=example();x.expected.required_status='partial';x.expected.events[0].detection_requirement='coverage_warning_required';x.expected.coverage_requirements=[{side:'both',page_index:0,reason:'unverified_image_text_region'}];x.expected.evidence_locations.amount={before:[{page_index:0,image_bbox_top_left_pt:[50,250,500,400]}],after:[{page_index:0,image_bbox_top_left_pt:[50,250,500,400]}]};x.result.differences=[];x.result.status=mode==='incorrect complete'?'complete_for_scope':'partial';if(mode!=='empty')x.result.coverage=(['left','right'] as const).map(side=>({side,pageIndex:0,region:mode==='generic warning'?[0,0,600,850]:mode==='wrong region'?[0,0,20,20]:[50,250,500,400],reason:'unverified_image_text_region',evidence:'image object',message:'image not compared',defaultVisible:true}));expect(grade(x.result,x.expected,x.layout,x.docs).status).toBe('FAIL');});
  it('duplicate-key warning alone cannot waive amount evidence',()=>{const x=example();x.expected.required_status='partial_or_explicit_review';x.expected.events[0].detection_requirement='visible_text_delta_with_identity_review';x.result.status='partial';x.result.unresolved=[{reason:'ambiguous_identity',message:'duplicate keys',left:[],right:[],defaultVisible:true}];x.result.differences=[];expect(grade(x.result,x.expected,x.layout,x.docs).status).toBe('FAIL');});
  it('Review does not excuse false text in control',()=>{const x=example();x.expected.events=[];x.expected.invariants=['no_material_differences'];x.result.differences[0].category='Review';expect(grade(x.result,x.expected,x.layout,x.docs).status).toBe('FAIL');});
});
