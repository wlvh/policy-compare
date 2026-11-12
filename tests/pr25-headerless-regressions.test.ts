/**
 * Follow-up for PR #25 at e1eb30d.
 * Place in tests/ and run with the repository's ACTUAL rebuilt Rust/WASM.
 * This file was authored for the follow-up review; it has not been run in
 * the repository here. Do not replace the original PR25 regression files.
 */
import {expect, it} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {textDoc} from './helpers';
import {resolveLocation, type DocInput} from '../packages/contracts/index';

function table(rows: string[][]): DocInput {
  return textDoc(rows.flatMap((row, index) => row.map((text, column) => ({
    text,
    x: 40 + column * 160,
    y: 180 + index * 40,
  }))));
}

it('an edit in the first headerless data row must not invent edits in an unchanged second row', () => {
  const left = table([['A', '100', '200'], ['B', '300', '400']]);
  const right = table([['A', '200', '100'], ['B', '300', '400']]);
  const result = compare(left, right);
  const idsAt = (doc: DocInput, y: number) => new Set(
    doc.pages[0].lines
      .filter(line => Math.abs(line.baseline[1] - y) < 0.01)
      .flatMap(line => line.charIds),
  );
  const untouched = {left: idsAt(left, 220), right: idsAt(right, 220)};
  const editsInUntouchedRow = result.differences.flatMap(d =>
    d.textOps.filter(op => op.kind !== 'equal' && op.text.trim()).filter(op =>
      (['left', 'right'] as const).some(side => op[side].some(loc =>
        loc.charIds.some(id => untouched[side].has(id)),
      )),
    ),
  );
  expect(editsInUntouchedRow).toHaveLength(0);
  // A blank result or a scope/ambiguity warning alone cannot replace the A-row event.
  const changed = {left: idsAt(left, 180), right: idsAt(right, 180)};
  expect(result.differences.some(d => d.hasTextChange || d.kind === 'Moved')).toBe(true);
  expect(result.differences.some(d =>
    (d.hasTextChange || d.kind === 'Moved') &&
    (['left', 'right'] as const).every(side => d[side].some(loc =>
      loc.charIds.some(id => changed[side].has(id)),
    )),
  )).toBe(true);
  expect(result.coverage).toHaveLength(0);
  // The input does not carry a hidden 'headerless' flag. If a real competing
  // structural interpretation is retained, it must have local source evidence;
  // it cannot justify definite spurious edits in B or hide A's visible event.
  for (const issue of result.unresolved) {
    expect(issue.reason).toBe('ambiguous_match');
    expect(issue.left.length + issue.right.length).toBeGreaterThan(0);
    for (const loc of [...issue.left, ...issue.right]) {
      expect(resolveLocation(loc, [left, right])).toBe(true);
    }
  }
  for (const d of result.differences) {
    for (const loc of [...d.left, ...d.right, ...d.textOps.flatMap(op => [...op.left, ...op.right])]) {
      expect(resolveLocation(loc, [left, right])).toBe(true);
    }
  }
});

it('ordinary headerless numeric edits remain local', () => {
  const result = compare(
    table([['A', '100', '200'], ['B', '300', '400']]),
    table([['A', '150', '200'], ['B', '300', '400']]),
  );
  expect(result.differences.some(d => d.hasTextChange && d.oldText.includes('100') && d.newText.includes('150'))).toBe(true);
  expect(result.differences.some(d => d.hasTextChange && /300|400/.test(d.oldText + d.newText))).toBe(false);
  expect(result.unresolved).toHaveLength(0);
  expect(result.coverage).toHaveLength(0);
});

it('explicit numeric-word headers can still accompany a whole-column reorder without numeric edits', () => {
  const result = compare(
    table([['Reference', 'Phase 1', 'Phase 2'], ['A', '100', '200']]),
    table([['Reference', 'Phase 2', 'Phase 1'], ['A', '200', '100']]),
  );
  expect(result.differences.every(d => !d.hasTextChange)).toBe(true);
  expect(result.unresolved).toHaveLength(0);
  expect(result.coverage).toHaveLength(0);
});
