// Codex r4414859932: page_number_only on a margin line whose printed page is not the physical page.
// Input as in #2's tests/result-format-2.test.ts ("covers the page numbers of a margin line").
import { compare } from "../../../packages/compare-core/index";
import { ResultSchemaV2 } from "../../../packages/contracts/index";
import { textDoc } from "../../../tests/helpers";
import { factHolds } from "../../../tests/evaluation/scorer";
const base = [{ text: "The insured confirms the declared operations.", x: 40, y: 300 }];
for (const [a, b] of [["Schedule Page 3 of 10", "Schedule Page 3 of 11"], ["Schedule Page 1 of 1", "Schedule Page 1 of 2"]]) {
  const docs = [textDoc([{ text: a, x: 40, y: 40 }, ...base]), textDoc([{ text: b, x: 40, y: 40 }, ...base])] as const;
  for (const d of ResultSchemaV2.parse(compare(docs[0], docs[1])).differences)
    console.log(`one-page documents, margin line ${a} -> ${b}: product states ${JSON.stringify(d.facts)}; scorer recomputes page_number_only ${factHolds("page_number_only", d, [docs[0], docs[1]])}`);
}
