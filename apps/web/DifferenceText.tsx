import React, {useMemo} from 'react';
import type {DifferenceV2} from '../../packages/contracts/index';
import {changeExcerpts,type Operation} from './change-excerpts';

function Text({parts,side}: {parts:{kind:Operation['kind'];text:string}[];side:'old'|'new'}) {
  const visible=parts.filter(o => o.kind !== (side === 'old' ? 'insert' : 'delete'));
  return <>{visible.length ? visible.map((o,i) => o.kind === 'equal' ? <React.Fragment key={i}>{o.text}</React.Fragment> :
    <mark key={i} className={side === 'old' ? 'edit-delete' : 'edit-insert'}>{o.text}</mark>) : '(none)'}</>;
}

export function DifferenceText({difference:d,coarse,onLocate}: {
  difference:DifferenceV2;coarse:boolean;onLocate:(ops:Operation[])=>void;
}) {
  const display=useMemo(() => changeExcerpts(d),[d.oldText,d.newText,d.textOps]);
  if(!d.hasTextChange && d.oldText===d.newText)return <div className="same-text">{d.oldText}</div>;
  if(coarse || !display.precise)return <div className="coarse-text">
    <p className="coarse-detail">{coarse ? 'Word-level detail incomplete. Both full texts are retained; highlighting is coarse. Check the complete passages.' : 'Exact edit positions are unavailable. Full text is shown below.'}</p>
    <button className="source-action" onClick={e=>{e.stopPropagation();onLocate([]);}}>{d.left.length && d.right.length ? 'View both sources' : 'View source'}</button>
    <div className="old"><b>Baseline</b><p>{d.oldText || '(none)'}</p></div>
    <div className="new"><b>Revised</b><p>{d.newText || '(none)'}</p></div>
  </div>;
  return <div className="change-text">
    {display.omitted > 0 && <p className="excerpt-note">Context excerpts · {display.excerpts.length} {display.excerpts.length===1?'edit group':'edit groups'}. Unchanged text is omitted; expand for the complete context.</p>}
    {display.excerpts.map((excerpt,i) => <div className="change-excerpt" key={i} data-edit-group={i}>
      {display.excerpts.length>1 && <small>Edit group {i+1} of {display.excerpts.length}</small>}
      <div className="old"><Text parts={excerpt.parts} side="old" /></div>
      <div className="new"><Text parts={excerpt.parts} side="new" /></div>
      <button className="source-action" onClick={e=>{e.stopPropagation();onLocate(excerpt.operations);}}>
        {d.left.length && d.right.length ? 'View both sources' : 'View source'}
      </button>
    </div>)}
    {display.omitted > 0 && <details className="complete-text" onClick={e=>e.stopPropagation()}>
      <summary>View complete text</summary>
      <div className="full-old"><b>Baseline</b><p><Text parts={d.textOps} side="old" /></p></div>
      <div className="full-new"><b>Revised</b><p><Text parts={d.textOps} side="new" /></p></div>
    </details>}
  </div>;
}
