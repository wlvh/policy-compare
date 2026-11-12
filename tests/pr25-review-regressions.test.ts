/**
 * Proposed regression tests for PR #25, commit 65e23d5.
 * Place this file in policy-compare/tests/ and run it using the repository's
 * existing Vitest command after building its normal Rust/WASM artifact.
 * These tests were syntax-checked, NOT run against the production WASM here.
 */
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { compare } from '../packages/compare-core/index';
import { textDoc } from './helpers';
import { gradeGeneric } from './evaluation/generic';
import { resolveLocation, type DocInput, type SourceLocation, type DifferenceV2 } from '../packages/contracts/index';

function twoSeparateTables(a: string, b: string): DocInput {
  const lines: Parameters<typeof textDoc>[0] = [];
  for (const [title, value, top] of [
    ['Block A.', a, 80],
    ['Block B.', b, 300],
  ] as const) {
    lines.push({ text: title, x: 40, y: top });
    [['Item', 'Value'], ['Widget', value]].forEach((row, j) => {
      row.forEach((text, k) => lines.push({ text, x: 40 + 160 * k, y: top + 40 + j * 40 }));
    });
  }
  return textDoc(lines);
}

it('does not erase changed local relations across two tables with identical headings', () => {
  const left = twoSeparateTables('100', '200');
  const right = twoSeparateTables('200', '100');
  const result = compare(left, right);
  const changes = result.differences.filter(d => d.defaultVisible && (d.hasTextChange || d.kind === 'Moved'));
  expect(changes.length).toBeGreaterThan(0);
  // Either local replacements or explicitly sourced cross-block movement may
  // explain the relation change. Do not require a business key or card count.
  for (const [side, doc] of [['left', left], ['right', right]] as const) {
    for (const line of doc.pages[0].lines) {
      const chars = line.charIds.map(id => doc.pages[0].chars.find(c => c.id === id)!);
      if (!['100', '200'].includes(chars.map(c => c.text).join(''))) continue;
      const ids = new Set(line.charIds);
      expect(changes.some(d => d[side].some(loc => loc.charIds.some(id => ids.has(id))))).toBe(true);
    }
  }
  for (const d of result.differences) {
    for (const loc of [...d.left, ...d.right]) expect(resolveLocation(loc, [left, right])).toBe(true);
  }
});

it.each([['First', 'Second'], ['2024', '2025']])(
  'whole-column reordering must not invent value edits with headings %s / %s',
  (first, second) => {
    const make = (swap: boolean) => textDoc(
      (swap
        ? [['Reference', second, first], ['A', '200', '100']]
        : [['Reference', first, second], ['A', '100', '200']]
      ).flatMap((row, j) => row.map((text, k) => ({ text, x: 40 + 160 * k, y: 180 + 40 * j }))),
    );
    const result = compare(make(false), make(true));
    // Movement cards are allowed. Each value still belongs to the same heading.
    expect(result.differences.filter(d => d.hasTextChange)).toHaveLength(0);
  },
);

function firstLineLocation(doc: DocInput, side: 'left' | 'right'): SourceLocation {
  const page = doc.pages[0];
  const line = page.lines.find(l => l.charIds.length > 0)!;
  const chars = line.charIds.map(id => page.chars.find(c => c.id === id)!);
  const precision = chars[0].precision;
  const quads = precision === 'run'
    ? [...new Map(chars.map(c => [JSON.stringify(c.quad), c.quad])).values()]
    : chars.map(c => c.quad);
  return {
    side, pageIndex: 0, unitId: 'negative-false-movement',
    rawRange: [chars[0].rawRange[0], chars.at(-1)!.rawRange[1]],
    charIds: line.charIds, text: chars.map(c => c.text).join(''),
    quads, direction: line.direction, precision,
  };
}

it('the generic grader rejects a fabricated movement in an unchanged document', () => {
  const id = 'R01_identical';
  const { docs } = JSON.parse(gunzipSync(readFileSync(`validation/migration/issue-19/mupdf-${id}.json.gz`)).toString()) as { docs: [DocInput, DocInput] };
  const root = `validation/dataset/cases/${id}`;
  const expected = JSON.parse(readFileSync(`${root}/expected.json`, 'utf8'));
  const layout = JSON.parse(readFileSync(`${root}/layout.json`, 'utf8'));
  const result = compare(docs[0], docs[1]);
  expect(gradeGeneric(result, expected, layout, docs).status).toBe('PASS');
  const left = [firstLineLocation(docs[0], 'left')];
  const right = [firstLineLocation(docs[1], 'right')];
  expect(left[0].text).toBe(right[0].text);
  expect(resolveLocation(left[0], docs)).toBe(true);
  expect(resolveLocation(right[0], docs)).toBe(true);
  const fake: DifferenceV2 = {
    id: 'negative-false-movement', kind: 'Moved',
    structurePath: { section: 'document', entity: null, field: null, table: null, rowKey: null, confidence: 'candidate' },
    left, right, oldText: left[0].text, newText: right[0].text,
    textOps: [{ kind: 'equal', text: left[0].text, left, right }],
    hasTextChange: false, facts: [], repeat: null, defaultVisible: true,
    matchEvidence: { method: 'exact-source-text', score: null, details: ['Negative test: no source movement occurred.'] },
    reviewReasons: [], occurrences: [],
  };
  result.differences.push(fake);
  expect(gradeGeneric(result, expected, layout, docs).status).toBe('FAIL');
});
