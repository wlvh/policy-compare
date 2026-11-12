import type {CompareResultV2, CoverageIssue, DifferenceV2} from '../../packages/contracts/index';

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
    incomplete: result.unresolved.filter(u => u.reason === 'budget' || u.reason === 'word_diff_budget'),
    uncertain: result.unresolved.filter(u => u.reason === 'ambiguous_match' || u.reason === 'ambiguous_identity'),
  };
}

export function noticeStatus(result: CompareResultV2) {
  const n = reviewNotices(result);
  return [
    n.coverage.length ? `${n.coverage.length} coverage ${n.coverage.length === 1 ? 'notice' : 'notices'}` : '',
    n.incomplete.length ? `${n.incomplete.length} unfinished ${n.incomplete.length === 1 ? 'comparison' : 'comparisons'}` : '',
    n.uncertain.length ? `${n.uncertain.length} unresolved ${n.uncertain.length === 1 ? 'correspondence' : 'correspondences'}` : '',
    n.layout.length ? `${n.layout.length} table-layout ${n.layout.length === 1 ? 'notice' : 'notices'} (local text comparison continued)` : '',
  ].filter(Boolean).join('; ') + '. Open review details for sources. Text and position changes remain in the changes list.';
}

// Link a correspondence notice only where its own source characters overlap.
// Being on the same page is not enough to attach it to an unrelated change.
export function relatedUncertainty(difference: DifferenceV2, unresolved: CompareResultV2['unresolved']) {
  const ids = new Set([...difference.left, ...difference.right].flatMap(l =>
    l.charIds.map(id => `${l.side}:${l.pageIndex}:${id}`)));
  return unresolved.filter(u => (u.reason === 'ambiguous_match' || u.reason === 'ambiguous_identity') &&
    [...u.left, ...u.right].some(l => l.charIds.some(id => ids.has(`${l.side}:${l.pageIndex}:${id}`))));
}
