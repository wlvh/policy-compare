// Codex r4414995196: two spellings of a repeated header on both sides, their counts swapped.
import { compare } from "../../../packages/compare-core/index";
import { ResultSchemaV2 } from "../../../packages/contracts/index";
import { textDoc } from "../../../tests/helpers";
const four = (header: (p: number) => string) =>
  textDoc(Array.from({ length: 4 }, (_, page) => [
    { text: header(page), x: 40, y: 60, page },
    { text: `Ordinary body on page ${page + 1}`, x: 40, y: 300, page },
  ]).flat());
const run = (name: string, l: (p: number) => string, r: (p: number) => string) => {
  const res = ResultSchemaV2.parse(compare(four(l), four(r)));
  console.log(`${name}: status ${res.status}, differences ${res.differences.length}, unresolved ${res.unresolved.length}`,
    res.differences.map((d) => `[${d.kind} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)} repeat ${JSON.stringify(d.repeat)}]`).join(" "));
};
// Left: B1234AV2024 on pages 1-3, B01234AV2024 on page 4. Right: B1234AV2024 on page 1, B01234AV2024 on pages 2-4.
run("swapped counts (Codex)", (p) => (p < 3 ? "UMR B1234AV2024" : "UMR B01234AV2024"), (p) => (p < 1 ? "UMR B1234AV2024" : "UMR B01234AV2024"));
// Controls: identical; one spelling only on each side, changed on one page.
run("identical", (p) => (p < 3 ? "UMR B1234AV2024" : "UMR B01234AV2024"), (p) => (p < 3 ? "UMR B1234AV2024" : "UMR B01234AV2024"));
run("first occurrence of a variant", () => "UMR B1234AV2024", (p) => (p === 2 ? "UMR B01234AV2024" : "UMR B1234AV2024"));
