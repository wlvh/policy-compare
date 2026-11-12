import React from 'react';
import type {CompareResultV2, CoverageIssue, SourceLocation} from '../../packages/contracts/index';
import {layoutObservations, reviewNotices} from './review-notices';

const sideName = (side: string) => side === 'left' ? 'Baseline' : 'Revised';
const coverageLabels: Record<CoverageIssue['reason'], string> = {
  page_failed: 'Page could not be read',
  raster_only_content: 'Scanned image content',
  unverified_image_text_region: 'Image text coverage unconfirmed',
  encoding_unknown: 'Text encoding unconfirmed',
  body_missing: 'Page text missing',
  unsupported_objects: 'Object coverage unconfirmed',
  unsupported_language: 'Language coverage unconfirmed',
  unsupported_structure: 'Structure coverage unconfirmed',
};
type Entry = {side: 'left' | 'right'; pageIndex: number; text: string; description: string;
  message?: string; index?: number; onLocate: () => void};

function Sources({entries}: {entries: Entry[]}) {
  return <div className="notice-sources">
    {(['left', 'right'] as const).map(side => {
      const sources = entries.filter(e => e.side === side);
      if (!sources.length) return null;
      const pages = [...new Set(sources.map(e => e.pageIndex))].sort((a,b) => a-b);
      return <div className="notice-side" key={side}>
        <h4>{sideName(side)} · {sources.length} locations on {pages.length} {pages.length === 1 ? 'page' : 'pages'}</h4>
        {pages.map(page => <div className="notice-page" key={page}>
          <b>Page {page + 1}</b>
          <div>{sources.filter(e => e.pageIndex === page).map((entry, i) => <button
            key={i} className="notice-location" data-side={side} data-page={page}
            data-notice-index={entry.index} title={entry.description}
            onClick={entry.onLocate}>
            <strong>Area {i + 1}</strong><span>{entry.text}</span>
            {entry.message && <small className="notice-source-message">{entry.message}</small>}
          </button>)}</div>
        </div>)}
      </div>;
    })}
    {!entries.length && <p>No specific source location was supplied. Check the stated limit and the original documents.</p>}
  </div>;
}

export function ReviewNotices({result, onCoverage, onLocate}: {
  result: CompareResultV2;
  onCoverage: (issue: CoverageIssue) => void;
  onLocate: (sources: SourceLocation[], hint: string) => void;
}) {
  const n = reviewNotices(result);
  const coverageCount = n.coverage.length + n.incomplete.length;
  const layoutKinds = new Set(n.layout.map(e => e.issue.layoutHint)).size;
  if (!result.coverage.length && !result.unresolved.length) return null;
  const coverageEntries = (items: typeof n.coverage, showMessages = true): Entry[] => items.map(({issue, index}) => ({
    side:issue.side,pageIndex:issue.pageIndex,text:issue.evidence,
    description:`${issue.message}\n${issue.evidence}\nRegion: ${issue.region.join(', ')}`,
    message:showMessages ? issue.message : undefined,
    index,onLocate:() => onCoverage(issue),
  }));
  const unresolvedEntries = (u: CompareResultV2['unresolved'][number]): Entry[] => [...u.left,...u.right].map(l => ({
    side:l.side,pageIndex:l.pageIndex,text:l.text,description:u.message,
    onLocate:() => onLocate([l],u.reason==='word_diff_budget'
      ? 'Word-level detail incomplete. This is the full source range; highlighting is coarse.'
      : u.reason==='budget' ? 'Matching and comparison are unfinished for this source range.'
        : 'Unresolved correspondence source. This location is not a confirmed match.'),
  }));
  return <section className="gaps" aria-label="Review notices">
    {(n.coverage.length > 0 || n.incomplete.length > 0) && <section className="coverage-alerts" aria-label="Comparison coverage">
      <h2>Comparison coverage · {coverageCount} {coverageCount === 1 ? 'notice' : 'notices'}</h2>
      {[...new Set(n.coverage.map(e => e.issue.reason))].map(reason => {
        const items = n.coverage.filter(e => e.issue.reason === reason);
        const first = items[0].issue;
        return <div className="coverage-group" key={reason}>
          <div className="coverage-overview"><strong>{coverageLabels[reason]}</strong>
            <span>{items.length} {items.length === 1 ? 'location' : 'locations'} · check against the original PDF</span>
            <button onClick={() => onCoverage(first)}>{sideName(first.side)} · Page {first.pageIndex + 1}</button>
          </div>
          <details><summary>View all {items.length} locations</summary>
            <div className="notice-body"><Sources entries={coverageEntries(items)} /></div>
          </details>
        </div>;
      })}
      {n.incomplete.length > 0 && <div className="coverage-group">
        <div className="coverage-overview"><strong>Comparison unfinished</strong>
          <span>{n.incomplete.length} work {n.incomplete.length === 1 ? 'limit' : 'limits'} reached; inspect these ranges in the original PDFs</span>
        </div>
        <details><summary>View unfinished comparisons</summary><div className="notice-body">
          {n.incomplete.map((u,i) => <div key={i}><p>{u.message}</p><Sources entries={unresolvedEntries(u)} /></div>)}
        </div></details>
      </div>}
    </section>}
    {n.wordDetail.length > 0 && <section className="word-detail-notices" aria-label="Word-level comparison detail">
      <h2>Word-level detail incomplete · {n.wordDetail.length} {n.wordDetail.length === 1 ? 'range' : 'ranges'}</h2>
      <p>Both full source texts are retained. Highlighting is coarse; check the complete passages.</p>
      <details><summary>View affected source passages</summary><div className="notice-body">
        {n.wordDetail.map((u,i) => <div key={i}><p>{u.message}</p><Sources entries={unresolvedEntries(u)} /></div>)}
      </div></details>
    </section>}
    {n.uncertain.length > 0 && <details className="match-notices">
      <summary>Correspondence to review · {n.uncertain.length} {n.uncertain.length === 1 ? 'group' : 'groups'}</summary>
      <div className="notice-body">{n.uncertain.map((u,i) => <div key={i}><p>{u.message}</p><Sources entries={unresolvedEntries(u)} /></div>)}</div>
    </details>}
    {n.layout.length > 0 && <details className="structure-notices">
      <summary>Table relationships to check · {layoutKinds} {layoutKinds === 1 ? 'type' : 'types'} · {n.layout.length} {n.layout.length === 1 ? 'notice' : 'notices'}
        <span className="notice-summary-note">These layout observations do not stop local text comparison. Table relationships remain unverified.</span>
      </summary>
      <div className="notice-body">{Object.entries(layoutObservations).map(([key, label]) => {
        const items = n.layout.filter(e => e.issue.layoutHint === key);
        return items.length ? <div className="notice-group" key={key}>
          <h3>{label.title} · {items.length} locations</h3><p>{label.explanation}</p>
          <Sources entries={coverageEntries(items, false)} />
        </div> : null;
      })}</div>
    </details>}
  </section>;
}
