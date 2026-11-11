import type {DifferenceV2} from '../../packages/contracts/index';
// Presentation only, after every occurrence was compared. The original result
// (including each record's textOps) is retained for export and evaluation.
export function foldOccurrences(differences:DifferenceV2[],pages:[number,number]):DifferenceV2[]{
 const groups=new Map<string,DifferenceV2[]>();
 for(const d of differences){const key=JSON.stringify([d.kind,d.oldText,d.newText,d.facts,d.matchEvidence.method]);const group=groups.get(key)??[];group.push(d);groups.set(key,group);}
 return [...groups.values()].map(group=>{const d=group[0];if(group.length===1||d.repeat)return d;
 return {...d,repeat:{left:group.filter(d=>d.left.length).length,right:group.filter(d=>d.right.length).length,leftPages:pages[0],rightPages:pages[1]},occurrences:group.map(d=>({left:d.left,right:d.right})),reviewReasons:[...d.reviewReasons,`${group.length} occurrences compared individually. Each source pair remains available; exported records retain their own edits.`]};});
}
