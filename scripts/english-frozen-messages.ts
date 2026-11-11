import type { CompareResultV2 } from '../packages/contracts/index';

export type MessageTranslation = { path: string; before: string; after: string };

// This is an explicit migration of the generated explanations inventoried in
// the 64 frozen Issue #19 results. It is independent of both current cores.
// Do not use a general Chinese-text replacement or derive expected messages
// from product output: unknown explanations must fail this verifier.
const identityReason = new Map([
  ['无法确定唯一表格行身份', 'A unique table row identity could not be established'],
]);
const unresolvedMessage = new Map([
  ['表格主键或次级键重复；金额变化仍展示，无法确定唯一实体', 'Duplicate primary or secondary table keys; amount changes remain visible, but a unique entity cannot be identified'],
]);
const evidenceDetail = new Map([
  ['主体与字段身份一致', 'Entity and field identities match'],
]);
const unchangedDetails = new Set([
  'declared-table-key', 'joint-local-alignment', 'page-furniture',
  'repeated-header', 'unique-exact', 'unmatched', 'unresolved-table-group',
]);
const repeatSummary = /^这段文字出现次数：(\d+) 次 → (\d+) 次；文档页数：(\d+) 页 → (\d+) 页；逐处来源见出现位置$/;

export function translateFrozenMessages(frozen: CompareResultV2) {
  const expected = structuredClone(frozen);
  const translations: MessageTranslation[] = [];
  const translate = (before: string, path: string, table: Map<string, string>, allowRepeat = false, allowMethod = false) => {
    let after = table.get(before);
    if (after === undefined && allowRepeat) {
      const counts = repeatSummary.exec(before);
      if (counts) after = `Text occurrences: ${counts[1]} → ${counts[2]}; document pages: ${counts[3]} → ${counts[4]}; see occurrence locations for each source`;
    }
    if (after === undefined && allowMethod && unchangedDetails.has(before)) return before;
    if (after === undefined) throw new Error(`Unapproved frozen explanation at ${path}: ${JSON.stringify(before)}`);
    translations.push({ path, before, after });
    return after;
  };
  expected.differences.forEach((difference, i) => {
    difference.reviewReasons = difference.reviewReasons.map((text, j) =>
      translate(text, `/differences/${i}/reviewReasons/${j}`, identityReason, true));
    difference.matchEvidence.details = difference.matchEvidence.details.map((text, j) =>
      translate(text, `/differences/${i}/matchEvidence/details/${j}`, evidenceDetail, false, true));
  });
  expected.unresolved.forEach((item, i) => {
    item.message = translate(item.message, `/unresolved/${i}/message`, unresolvedMessage);
  });
  // Coverage messages are copied from the input pages. Frozen input pages and
  // their messages/hashes remain untouched, as do every source quote and fact.
  return { expected, translations };
}
