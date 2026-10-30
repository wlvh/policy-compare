// Full-row wraps after b32b3a4 (+row-identity.34): every cell of record 123 wraps onto a second line, each
// cell's lines extracted together; and a four-column compact table read row by row against column by column.
// Run from the repository root: pnpm exec tsx reports/invariant-coverage/88718d0/probes/product-fullwrap-probe.ts
import { compare } from "../../../../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 } from "../../../../packages/contracts/index";
import { textDoc } from "../../../../tests/helpers";
const brief = (r: CompareResultV2) =>
  `status=${r.status} unresolved=${r.unresolved.length} ` +
  (r.differences.map((d) => `${d.kind}/${d.matchEvidence.method}/row=${d.structurePath?.rowKey ?? "-"} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)}`).join(" || ") || "no differences");
const run = (a: ReturnType<typeof textDoc>, b: ReturnType<typeof textDoc>) => brief(ResultSchemaV2.parse(compare(a, b)));
type R = { text: string; x: number; y: number };
// Three columns; every cell of record 123 wraps onto a second line 11 below (cell order).
const all3 = (last: string) => textDoc([
  { text: "MSN", x: 40, y: 180 }, { text: "Operator", x: 190, y: 180 }, { text: "Value", x: 340, y: 180 },
  { text: "123", x: 40, y: 195 }, { text: "(a)", x: 40, y: 206 },
  { text: "Alpha Air", x: 190, y: 195 }, { text: "Holdings", x: 190, y: 206 },
  { text: "USD 1000", x: 340, y: 195 }, { text: last, x: 340, y: 206 },
  { text: "456", x: 40, y: 225 }, { text: "Beta", x: 190, y: 225 }, { text: "USD 2000", x: 340, y: 225 },
]);
console.log(`three columns, all three cells wrap, cell order, "per annum" -> "per month": ${run(all3("per annum"), all3("per month"))}`);
// Four columns; all four cells of record 123 wrap (cell order).
const all4 = (last: string) => textDoc([
  { text: "MSN", x: 40, y: 180 }, { text: "Operator", x: 150, y: 180 }, { text: "Cover", x: 290, y: 180 }, { text: "Value", x: 430, y: 180 },
  { text: "123", x: 40, y: 195 }, { text: "(a)", x: 40, y: 206 },
  { text: "Alpha Air", x: 150, y: 195 }, { text: "Holdings", x: 150, y: 206 },
  { text: "Hull and", x: 290, y: 195 }, { text: "war risks", x: 290, y: 206 },
  { text: "USD 1000", x: 430, y: 195 }, { text: last, x: 430, y: 206 },
  { text: "456", x: 40, y: 225 }, { text: "Beta", x: 150, y: 225 }, { text: "Hull", x: 290, y: 225 }, { text: "USD 2000", x: 430, y: 225 },
]);
console.log(`four columns, all four cells wrap, cell order, the same change: ${run(all4("per annum"), all4("per month"))}`);
// Four columns, three cells wrap (the 33bda44 regression case), compact rows (13 apart) column-major vs row-major.
const ys = [180, 193, 206, 219], xs = [40, 150, 290, 430];
const cells = [["MSN", "Operator", "Cover", "Value"], ["123", "Alpha", "Hull", "USD 1000"], ["456", "Beta", "Hull", "USD 2000"]];
const rm = (c: string[][]) => textDoc(c.flatMap((r, i) => r.map((text, j) => ({ text, x: xs[j], y: ys[i] }))));
const cm = (c: string[][]) => textDoc(xs.flatMap((x, j) => c.map((r, i) => ({ text: r[j], x, y: ys[i] }))));
console.log(`four-column compact table, row-major vs column-major: ${run(rm(cells), cm(cells))}`);
