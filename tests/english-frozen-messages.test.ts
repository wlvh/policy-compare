import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import type { CompareResultV2 } from '../packages/contracts/index';
import { translateFrozenMessages } from '../scripts/english-frozen-messages';

const frozenCase = (name: string): CompareResultV2 => JSON.parse(gunzipSync(readFileSync(`validation/migration/issue-19/mupdf-${name}.json.gz`)).toString('utf8')).result;

it('translates the approved count template without rounding, dropping or swapping counts', () => {
  const frozen = frozenCase('R09_header_limit');
  frozen.differences[0].reviewReasons = ['这段文字出现次数：40000000000000001 次 → 3 次；文档页数：4 页 → 5 页；逐处来源见出现位置'];
  const { expected } = translateFrozenMessages(frozen);
  expect(expected.differences[0].reviewReasons).toEqual(['Text occurrences: 40000000000000001 → 3; document pages: 4 → 5; see occurrence locations for each source']);
  expect(frozen.differences[0].reviewReasons[0]).toContain('40000000000000001 次');
});

it('preserves source text, input-derived coverage, facts and locations while translating generated explanations', () => {
  const frozen = frozenCase('R25_duplicate_keys');
  const before = structuredClone(frozen);
  frozen.differences[0].oldText = '主体与字段身份一致：quoted source 原文';
  frozen.differences[0].newText = '无法确定唯一表格行身份：quoted source 原文';
  frozen.coverage = frozenCase('R27_mixed_scan_page').coverage;
  const original = structuredClone(frozen);
  const { expected, translations } = translateFrozenMessages(frozen);
  expect(frozen).toEqual(original);
  expect(expected.coverage).toEqual(original.coverage);
  expect(expected.differences[0].oldText).toBe(original.differences[0].oldText);
  expect(expected.differences[0].newText).toBe(original.differences[0].newText);
  expect(expected.differences[0].reviewReasons).toEqual(['A unique table row identity could not be established']);
  expect(expected.unresolved[0].message).toBe('Duplicate primary or secondary table keys; amount changes remain visible, but a unique entity cannot be identified');
  expect(expected.differences[0].left).toEqual(before.differences[0].left);
  expect(expected.differences[0].right).toEqual(before.differences[0].right);
  expect(expected.differences[0].facts).toEqual(before.differences[0].facts);
  expect(translations.length).toBeGreaterThan(0);
});

it.each(['reviewReasons', 'details', 'unresolved'] as const)('rejects an unknown generated %s explanation', field => {
  const frozen = frozenCase('R25_duplicate_keys');
  if (field === 'reviewReasons') frozen.differences[0].reviewReasons = ['Unknown replacement'];
  if (field === 'details') frozen.differences[0].matchEvidence.details = ['unknown-method'];
  if (field === 'unresolved') frozen.unresolved[0].message = 'Unapproved explanation';
  expect(() => translateFrozenMessages(frozen)).toThrow(/^Unapproved frozen explanation/);
});

it('rejects extra text or quoted notes instead of silently dropping them from a count summary', () => {
  const frozen = frozenCase('R09_header_limit');
  frozen.differences[0].reviewReasons = ['这段文字出现次数：2 次 → 2 次；文档页数：2 页 → 2 页；逐处来源见出现位置；原文“不可丢失”'];
  expect(() => translateFrozenMessages(frozen)).toThrow(/^Unapproved frozen explanation/);
});
