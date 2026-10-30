// Independent product probes for the user's PR #9 review 6517899051, items 1 and 2.
// Run from the repository root: pnpm exec tsx reports/invariant-coverage/8906d05/probes/product-probes-review-6517899051.ts
import { compare } from "../../../../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 } from "../../../../packages/contracts/index";
import { textDoc } from "../../../../tests/helpers";

const brief = (r: CompareResultV2) => {
  const kinds: Record<string, number> = {};
  for (const d of r.differences) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
  const keys = r.differences.map((d) => `${d.kind}:${d.matchEvidence.method}:${d.structurePath?.rowKey ?? "-"}`);
  return `status=${r.status} differences=${JSON.stringify(kinds)} [${keys.join(", ")}] unresolved=${r.unresolved.length}`;
};

// Item 1 (r4420795051): no heading row; a cell holding an identifier's name plus punctuation only.
const row = (cells: string[]) =>
  textDoc([{ text: "SCHEDULE", y: 150 }, ...cells.map((text, k) => ({ text, x: 40 + k * 150, y: 200 }))]);
console.log("# item 1: label with punctuation, no value");
for (const label of ["MSN", "MSN:", "MSN -", "MSN#", "MSN No.", "MSN: 123", "MSN 123"]) {
  const other = /\d/.test(label) ? label : label;
  const r = ResultSchemaV2.parse(compare(row([label, "Alpha Air", "USD 1000"]), row([other, "Delta Air", "USD 2000"])));
  console.log(`${JSON.stringify(label)}: ${brief(r)}`);
}

// Item 2 (r4421114827): the same text and geometry, extracted row by row on one side and column by
// column on the other. Rows at baselines 180/193/206, columns at x 40/190/340.
const cells = [
  ["MSN", "Operator", "Value"],
  ["123", "Alpha", "USD 1000"],
  ["456", "Beta", "USD 2000"],
];
const ys = [180, 193, 206], xs = [40, 190, 340];
const rowMajor = textDoc(cells.flatMap((r, i) => r.map((text, j) => ({ text, x: xs[j], y: ys[i] }))));
const colMajor = textDoc(xs.flatMap((x, j) => cells.map((r, i) => ({ text: r[j], x, y: ys[i] }))));
console.log("# item 2: extraction order");
console.log(`row-major vs column-major: ${brief(ResultSchemaV2.parse(compare(rowMajor, colMajor)))}`);
console.log(`column-major vs row-major: ${brief(ResultSchemaV2.parse(compare(colMajor, rowMajor)))}`);
console.log(`control, row-major vs row-major: ${brief(ResultSchemaV2.parse(compare(rowMajor, rowMajor)))}`);
console.log(`control, column-major vs column-major: ${brief(ResultSchemaV2.parse(compare(colMajor, colMajor)))}`);
