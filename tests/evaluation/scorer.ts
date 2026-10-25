import { ResultSchema, resolveLocation, type CompareResult, type DocInput, type SourceLocation, type Difference } from '../../packages/contracts/index';
export type Expected = {case_id:string;required_status:string;events:{event_id:string;logical_path:string;old:string|null;new:string|null;operation:string;detection_requirement:string;acceptable_kinds:string[];acceptable_categories:string[]}[];invariants:string[];coverage_requirements:{side:string;page_index:number;reason:string}[];evidence_locations:Record<string,Record<'before'|'after',Evidence[]>>};
type Evidence={page_index:number;run_id?:string;image_bbox_top_left_pt?:number[]};
export type Layout={before:{pages:LayoutPage[]};after:{pages:LayoutPage[]}};
type LayoutPage={text_runs:{run_id:string;text:string;direction:number[];characters:{quad_tl_tr_br_bl:number[][]}[]}[]};
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const box=(points:number[][])=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const overlap=(a:number[],b:number[])=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
const area=(a:number[])=>Math.max(0,a[2]-a[0])*Math.max(0,a[3]-a[1]);
function located(locs:SourceLocation[],refs:Evidence[],layout:LayoutPage[],side:'left'|'right'):boolean{
  return locs.some(loc=>loc.side===side&&refs.some(ref=>{
    if(loc.pageIndex!==ref.page_index||!ref.run_id)return false;
    const run=layout[ref.page_index]?.text_runs.find(r=>r.run_id===ref.run_id);if(!run)return false;
    const bbox=box(run.characters.flatMap(c=>c.quad_tl_tr_br_bl));
    const direction=loc.direction[0]*run.direction[0]+loc.direction[1]*run.direction[1];
    return direction>.98&&loc.quads.some(q=>{const b=box([[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]]);return overlap(b,bbox)/Math.max(1,area(b))>.35;});
  }));
}
export function grade(input:unknown,expected:Expected,layout:Layout,docs:[DocInput,DocInput]){
  const faults:string[]=[];const parsed=ResultSchema.safeParse(input);
  if(!parsed.success)return {caseId:expected.case_id,status:'FAIL',faults:['Invalid result schema: '+parsed.error.issues.map(x=>x.path.join('.')).join(',')],events:[]};
  const result=parsed.data;
  if(result.documentHashes.some((h,i)=>h!==docs[i].contentHash))faults.push('Input hash or direction mismatch');
  const checkLoc=(loc:SourceLocation,side:'left'|'right')=>loc.side===side&&resolveLocation(loc,docs);
  for(const d of result.differences){
    if(d.textOps.filter(o=>o.kind!=='insert').map(o=>o.text).join('')!==d.oldText||d.textOps.filter(o=>o.kind!=='delete').map(o=>o.text).join('')!==d.newText)faults.push('Text operations do not reconstruct both raw sides');
    for(const [locs,side] of [[d.left,'left'],[d.right,'right']] as const)if(locs.some(l=>!checkLoc(l,side)))faults.push('Invalid source reference or geometry: '+d.id);
    if(d.kind!=='Added'&&!d.left.length||d.kind!=='Removed'&&!d.right.length)faults.push('Missing source: '+d.id);
    for(const op of d.textOps){if(op.left.some(l=>!checkLoc(l,'left'))||op.right.some(l=>!checkLoc(l,'right')))faults.push('Invalid operation source');if(op.kind==='insert'&&op.left.length||op.kind==='delete'&&op.right.length)faults.push('Operation side reversed');}
    for(const o of d.occurrences)if(o.left.some(l=>!checkLoc(l,'left'))||o.right.some(l=>!checkLoc(l,'right')))faults.push('Invalid occurrence source');
  }
  const required=expected.required_status;
  const completeness=required==='partial_or_explicit_review'?result.status==='partial'&&result.unresolved.some(u=>u.reason==='ambiguous_identity'):result.status===required;
  if(!completeness)faults.push('Wrong global completeness state');
  const events=expected.events.map(e=>{
    if(e.detection_requirement==='coverage_warning_required'){
      const findings=expected.coverage_requirements.every(req=>(req.side==='both'?['left','right']:[req.side]).every(side=>{
        const refs=expected.evidence_locations[e.event_id][side==='left'?'before':'after'];
        return result.coverage.some(c=>c.side===side&&c.pageIndex===req.page_index&&c.reason===req.reason&&c.defaultVisible&&c.evidence.length>0&&refs.some(r=>r.image_bbox_top_left_pt&&overlap(c.region,r.image_bbox_top_left_pt)/Math.max(1,area(r.image_bbox_top_left_pt))>.7&&area(c.region)/Math.max(1,area(r.image_bbox_top_left_pt))<1.3));
      }));
      return {eventId:e.event_id,discovery:findings,correspondence:findings,position:findings,visibility:findings,completeness:result.status==='partial',pass:findings&&result.status==='partial'};
    }
    if(!['must_detect','visible_text_delta_with_identity_review'].includes(e.detection_requirement))return {eventId:e.event_id,pass:false,reason:'Unknown detection branch'};
    const candidates=result.differences.filter(d=>(e.old===null||clean(d.oldText).includes(clean(e.old)))&&(e.new===null||clean(d.newText).includes(clean(e.new)))&&(e.old!==null||d.kind==='Added')&&(e.new!==null||d.kind==='Removed'));
    const discovery=candidates.length>0;
    const acceptable=candidates.filter(d=>e.acceptable_kinds.includes(d.kind)&&e.acceptable_categories.includes(d.category));
    const refs=expected.evidence_locations[e.event_id];
    const positioned=acceptable.filter(d=>(e.old===null||located(d.left,refs.before,layout.before.pages,'left'))&&(e.new===null||located(d.right,refs.after,layout.after.pages,'right')));
    const pathParts=e.logical_path.split('.');
    const identity=(d:Difference)=>{
      if(e.detection_requirement==='visible_text_delta_with_identity_review')return d.structurePath?.confidence==='unresolved'&&d.structurePath.rowKey===null;
      if(pathParts[0]==='risk_details'){const entity=['original_insured','reinsured'].includes(pathParts[1])?pathParts[1]:null;const field=pathParts.slice(entity?2:1).join('.');return d.structurePath?.entity===entity&&d.structurePath?.field===field;}
      if(pathParts[0]==='aircraft_schedule')return d.structurePath?.rowKey===pathParts[1]&&d.structurePath?.field===pathParts[2];
      return true;
    };
    const matched=positioned.filter(identity);
    const correspondence=acceptable.some(identity)&&matched.length>0;
    const visibility=matched.some(d=>d.defaultVisible);
    // Changed-character evidence must land in the target run, not merely a broad field card.
    const precise=matched.some(d=>e.operation==='move'&&!d.hasTextChange||d.textOps.some(op=>op.kind!=='equal'&&
      ((op.kind==='delete'&&e.old!==null&&located(op.left,refs.before,layout.before.pages,'left'))||(op.kind==='insert'&&e.new!==null&&located(op.right,refs.after,layout.after.pages,'right')))));
    const position=matched.length>0&&precise;
    return {eventId:e.event_id,discovery,correspondence,position,visibility,completeness,pass:discovery&&correspondence&&position&&visibility&&completeness};
  });
  for(const ev of events)if(!ev.pass)faults.push('Required event failed: '+ev.eventId);
  const inv=expected.invariants;
  if(inv.includes('no_content_differences')&&result.differences.length)faults.push('False content differences in control');
  if(inv.includes('no_false_text_added_or_removed')&&result.differences.some(d=>d.hasTextChange))faults.push('False text delta in reflow control');
  if(inv.includes('no_false_clause_moves')&&result.differences.some(d=>d.kind==='Moved'))faults.push('False move caused by pagination');
  if(inv.includes('no_material_differences')&&result.differences.some(d=>d.category==='Material'||(d.hasTextChange&&d.category!=='Cosmetic')))faults.push('False substantive change; Review is not an exemption');
  if(inv.includes('no_false_row_additions_or_deletions')&&result.differences.some(d=>d.structurePath?.table&&d.hasTextChange))faults.push('False table value/entity delta');
  if(inv.includes('moved_clause_has_no_internal_word_edits')&&result.differences.some(d=>d.kind==='Moved'&&d.hasTextChange))faults.push('False internal move edit');
  if(inv.includes('must_not_classify_as_unchanged_duration_roll_forward')&&result.differences.some(d=>d.structurePath?.field==='policy_period'&&d.category==='RollForward'))faults.push('Changed duration mislabeled renewal');
  if(inv.includes('grouping_allowed_only_with_all_occurrence_locations')){const event=expected.events[0],d=result.differences.find(d=>clean(d.oldText).includes(clean(event.old??'')));if(d){for(const s of ['before','after'] as const){const side=s==='before'?'left':'right';const refs=expected.evidence_locations[event.event_id][s];const locs=d.occurrences.flatMap(o=>o[side]);if(!refs.every(r=>located(locs,[r],layout[s].pages,side)))faults.push('Missing repeated-header occurrence');}}}
  return {caseId:expected.case_id,status:faults.length?'FAIL':'PASS',faults,events};
}
