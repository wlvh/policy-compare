// Independent probes of #2's 33bda44 (+row-identity.33): variants of the review's items 1 and 2,
// and a table whose record wraps three cells onto a second line.
// Run from the repository root: pnpm exec tsx reports/invariant-coverage/67f5c44/probes/product-probes-33bda44.ts
import { compare } from "../../../../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 } from "../../../../packages/contracts/index";
import { textDoc } from "../../../../tests/helpers";

const brief = (r: CompareResultV2) =>
  `status=${r.status} unresolved=${r.unresolved.length} ` +
  (r.differences
    .map((d) => `${d.kind}/${d.matchEvidence.method}/row=${d.structurePath?.rowKey ?? "-"}/change=${d.hasTextChange} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)}`)
    .join(" || ") || "no differences");
const run = (a: ReturnType<typeof textDoc>, b: ReturnType<typeof textDoc>) => brief(ResultSchemaV2.parse(compare(a, b)));
type R = { text: string; x: number; y: number };

// Item 1 (r4420795051, r4421180075): no heading row; two records whose first cell is the same label.
const row = (cells: string[]) => textDoc([{ text: "SCHEDULE", y: 150 }, ...cells.map((text, k) => ({ text, x: 40 + k * 150, y: 200 }))]);
console.log("# item 1: label with punctuation, more forms");
for (const [l, r] of [["(MSN)", "(MSN)"], ["MSN No.:", "MSN No.:"], ["MSN: —", "MSN: —"], ["MSN/", "MSN/"], ["MSN :", "MSN :"], ["MSN:", "MSN: 123"], ["MSN: TBA", "MSN: TBA"]]) {
  console.log(`${JSON.stringify(l)} vs ${JSON.stringify(r)}: ${run(row([l, "Alpha Air", "USD 1000"]), row([r, "Delta Air", "USD 2000"]))}`);
}

// Item 2 (r4421114827): a compact table (10-point text, baselines 13 apart) read row by row or column by column.
const ys = [180, 193, 206, 219];
const rm = (c: string[][], xs: number[]) => textDoc(c.flatMap((r, i) => r.map((text, j) => ({ text, x: xs[j], y: ys[i] }))));
const cm = (c: string[][], xs: number[]) => textDoc(xs.flatMap((x, j) => c.map((r, i) => ({ text: r[j], x, y: ys[i] }))));
const three = [40, 190, 340], two = [40, 240];
const base = [["MSN", "Operator", "Value"], ["123", "Alpha", "USD 1000"], ["456", "Beta", "USD 2000"]];
const changed = [["MSN", "Operator", "Value"], ["123", "Alpha", "USD 1000"], ["456", "Beta", "USD 3000"]];
console.log("# item 2: extraction order, more forms");
console.log(`three columns, 2000 -> 3000, row-major vs column-major: ${run(rm(base, three), cm(changed, three))}`);
console.log(`three columns, 2000 -> 3000, column-major vs row-major: ${run(cm(base, three), rm(changed, three))}`);
console.log(`three columns, four rows, row-major vs column-major: ${run(rm([...base, ["789", "Gamma", "USD 4000"]], three), cm([...base, ["789", "Gamma", "USD 4000"]], three))}`);
const pair = (v: string) => [["MSN", "Value"], ["123", "USD 1000"], ["456", v]];
console.log(`two columns, row-major vs column-major: ${run(rm(pair("USD 2000"), two), cm(pair("USD 2000"), two))}`);
console.log(`two columns, 2000 -> 3000, row-major vs column-major: ${run(rm(pair("USD 2000"), two), cm(pair("USD 3000"), two))}`);
console.log(`control, two columns, 2000 -> 3000, row-major vs row-major: ${run(rm(pair("USD 2000"), two), rm(pair("USD 3000"), two))}`);

// A four-column table whose record wraps its last three cells onto a second line 11 below; the MSN
// cell does not wrap. "cell" lists each cell's lines together, "line" lists by baseline.
const wrapped = (last: string, order: "cell" | "line") => {
  const head: R[] = [{ text: "MSN", x: 40, y: 180 }, { text: "Operator", x: 150, y: 180 }, { text: "Cover", x: 290, y: 180 }, { text: "Value", x: 430, y: 180 }];
  const cells: R[][] = [
    [{ text: "123", x: 40, y: 195 }],
    [{ text: "Alpha Air", x: 150, y: 195 }, { text: "Holdings", x: 150, y: 206 }],
    [{ text: "Hull and", x: 290, y: 195 }, { text: "war risks", x: 290, y: 206 }],
    [{ text: "USD 1000", x: 430, y: 195 }, { text: last, x: 430, y: 206 }],
  ];
  const body = order === "cell" ? cells.flat() : cells.flat().sort((a, b) => a.y - b.y || a.x - b.x);
  const next: R[] = [{ text: "456", x: 40, y: 225 }, { text: "Beta", x: 150, y: 225 }, { text: "Hull", x: 290, y: 225 }, { text: "USD 2000", x: 430, y: 225 }];
  return textDoc([...head, ...body, ...next]);
};
// Control: only two cells wrap (two clusters on the wrap line).
const twoWrap = (last: string) => textDoc([
  { text: "MSN", x: 40, y: 180 }, { text: "Operator", x: 150, y: 180 }, { text: "Cover", x: 290, y: 180 }, { text: "Value", x: 430, y: 180 },
  { text: "123", x: 40, y: 195 }, { text: "Alpha Air", x: 150, y: 195 }, { text: "Holdings", x: 150, y: 206 },
  { text: "Hull", x: 290, y: 195 }, { text: "USD 1000", x: 430, y: 195 }, { text: last, x: 430, y: 206 },
  { text: "456", x: 40, y: 225 }, { text: "Beta", x: 150, y: 225 }, { text: "Hull", x: 290, y: 225 }, { text: "USD 2000", x: 430, y: 225 },
]);
console.log("# a record wrapping three cells");
console.log(`cell order, wrap line "per annum" -> "per month": ${run(wrapped("per annum", "cell"), wrapped("per month", "cell"))}`);
console.log(`line order, the same change: ${run(wrapped("per annum", "line"), wrapped("per month", "line"))}`);
console.log(`cell order vs line order, no change: ${run(wrapped("per annum", "cell"), wrapped("per annum", "line"))}`);
console.log(`control, two cells wrap, cell order, the same change: ${run(twoWrap("per annum"), twoWrap("per month"))}`);
