import type {DifferenceV2} from '../../packages/contracts/index';
export type Operation = DifferenceV2['textOps'][number];
export type Excerpt = {parts: {kind:Operation['kind'];text:string}[]; operations:Operation[]};

// Never trim an edit. Only omit middle/remote portions of equal operations,
// at complete sentence boundaries. Keep the edited sentence and neighbouring
// sentences; a long sentence stays long rather than losing a qualifier.
export function changeExcerpts(d: Pick<DifferenceV2,'oldText'|'newText'|'textOps'>) {
  const old = d.textOps.filter(o => o.kind !== 'insert').map(o => o.text).join('');
  const next = d.textOps.filter(o => o.kind !== 'delete').map(o => o.text).join('');
  if (old !== d.oldText || next !== d.newText || !d.textOps.some(o => o.kind !== 'equal'))
    return {excerpts:[] as Excerpt[], omitted:0, precise:false};
  const excerpts: Excerpt[] = [];
  let active: Excerpt = {parts:[],operations:[]}, omitted = 0;
  const add = (op:Operation, text = op.text) => { if (text) active.parts.push({kind:op.kind,text}); if(op.kind!=='equal')active.operations.push(op); };
  const gap = (text:string) => {
    if (!text) return;
    omitted += Array.from(text).length;
    if (active.operations.length) excerpts.push(active);
    active = {parts:[],operations:[]};
  };
  const segmenter = new Intl.Segmenter('en',{granularity:'sentence'});
  d.textOps.forEach((op,i) => {
    if (op.kind !== 'equal') { add(op); return; }
    const sentences = [...segmenter.segment(op.text)];
    const before = d.textOps.slice(0,i).some(o => o.kind !== 'equal');
    const after = d.textOps.slice(i+1).some(o => o.kind !== 'equal');
    if (!before && sentences.length > 2) {
      const start = sentences.at(-2)!.index;
      gap(op.text.slice(0,start)); add(op,op.text.slice(start));
    } else if (!after && sentences.length > 2) {
      const end = sentences[1].index + sentences[1].segment.length;
      add(op,op.text.slice(0,end)); gap(op.text.slice(end));
    } else if (before && after && sentences.length > 4) {
      const end = sentences[1].index + sentences[1].segment.length, start = sentences.at(-2)!.index;
      add(op,op.text.slice(0,end)); gap(op.text.slice(end,start)); add(op,op.text.slice(start));
    } else add(op);
  });
  if(active.operations.length)excerpts.push(active);
  return {excerpts,omitted,precise:true};
}
