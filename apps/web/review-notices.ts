import type {CompareResultV2, CoverageIssue, DifferenceV2, SourceLocation} from '../../packages/contracts/index';

type Notice = CompareResultV2['unresolved'][number];
const isUncertain = (u: Notice) =>
  u.reason === 'ambiguous_match' || u.reason === 'ambiguous_identity' || u.reason === 'ambiguous_column_mapping';

export const noticeMessage = (u: Notice) => u.reason === 'ambiguous_column_mapping'
  ? 'The correspondence between these table fields could not be determined. Both source rows are retained.'
  : u.message;

export const layoutObservations = {
  repeated_tabular_text: {
    title: 'Repeated tabular text',
    explanation: 'The same multi-column text occurs on another page. This alone does not establish a continued table. Cross-page relationships have not been verified; local text comparison continued.',
  },
  varying_cell_boundaries: {
    title: 'Different cell boundaries',
    explanation: 'Nearby lines have different cell counts. This alone does not establish wrapped or merged cells. Cell structure has not been verified; local text comparison continued.',
  },
} as const;

export function isLayoutObservation(issue: CoverageIssue) {
  return issue.reason === 'unsupported_structure' && !!issue.layoutHint &&
    Object.hasOwn(layoutObservations, issue.layoutHint);
}

export function reviewNotices(result: Pick<CompareResultV2, 'coverage' | 'unresolved'>) {
  const entries = result.coverage.map((issue, index) => ({issue, index}));
  return {
    layout: entries.filter(e => isLayoutObservation(e.issue)),
    coverage: entries.filter(e => !isLayoutObservation(e.issue)),
    incomplete: result.unresolved.filter(u => u.reason === 'budget'),
    wordDetail: result.unresolved.filter(u => u.reason === 'word_diff_budget'),
    uncertain: result.unresolved.filter(isUncertain),
  };
}

export function noticeStatus(result: CompareResultV2) {
  const n = reviewNotices(result);
  return [
    n.coverage.length ? `${n.coverage.length} coverage ${n.coverage.length === 1 ? 'notice' : 'notices'}` : '',
    n.incomplete.length ? `${n.incomplete.length} unfinished ${n.incomplete.length === 1 ? 'comparison' : 'comparisons'}` : '',
    n.wordDetail.length ? `${n.wordDetail.length} ${n.wordDetail.length === 1 ? 'range has' : 'ranges have'} coarse highlighting; both full texts are retained` : '',
    n.uncertain.length ? `${n.uncertain.length} unresolved ${n.uncertain.length === 1 ? 'correspondence' : 'correspondences'}` : '',
    n.layout.length ? `${n.layout.length} table-layout ${n.layout.length === 1 ? 'notice' : 'notices'} (local text comparison continued)` : '',
  ].filter(Boolean).join('; ') + '. Open review details for sources. Text and position changes remain in the changes list.';
}

// Link a correspondence notice only where its own source characters overlap.
// Being on the same page is not enough to attach it to an unrelated change.
// A new comparison replaces the notice list. Card renders reuse its index.
const noticeIndexes = new WeakMap<readonly Notice[], Map<string, number[]>>();

function sourceKey(location: SourceLocation, charId: string) {
  return `${location.side}:${location.pageIndex}:${charId}`;
}

function indexNotices(unresolved: readonly Notice[]) {
  const prior = noticeIndexes.get(unresolved);
  if (prior) return prior;
  const index = new Map<string, number[]>();
  unresolved.forEach((notice, i) => {
    if (notice.reason === 'budget') return;
    for (const loc of [...notice.left, ...notice.right]) {
      for (const id of loc.charIds) {
        const key = sourceKey(loc, id);
        const entries = index.get(key);
        if (entries) entries.push(i);
        else index.set(key, [i]);
      }
    }
  });
  noticeIndexes.set(unresolved, index);
  return index;
}

function relatedSources(difference: DifferenceV2, unresolved: readonly Notice[], matches: (notice: Notice) => boolean) {
  if (!unresolved.length) return [];
  const index = indexNotices(unresolved);
  if (!index.size) return [];
  const found = new Set<number>();
  for (const loc of [...difference.left, ...difference.right]) {
    for (const id of loc.charIds) {
      for (const i of index.get(sourceKey(loc, id)) ?? []) found.add(i);
    }
  }
  return [...found].sort((a, b) => a - b).map(i => unresolved[i]).filter(matches);
}
export const relatedUncertainty = (d: DifferenceV2, unresolved: readonly Notice[]) =>
  relatedSources(d, unresolved, isUncertain);
export const relatedWordDetail = (d: DifferenceV2, unresolved: readonly Notice[]) =>
  relatedSources(d, unresolved, u => u.reason === 'word_diff_budget');
