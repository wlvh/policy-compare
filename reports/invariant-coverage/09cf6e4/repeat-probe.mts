// Codex r4414789954: a repeated header changed on one page only; the product cites unchanged occurrences as context.
import { compare } from "../../../packages/compare-core/index";
import { ResultSchemaV2 } from "../../../packages/contracts/index";
import { textDoc } from "../../../tests/helpers";
const four = (header: (p: number) => string) =>
  textDoc(Array.from({ length: 4 }, (_, page) => [
    { text: header(page), x: 40, y: 60, page },
    { text: `Ordinary body on page ${page + 1}`, x: 40, y: 300, page },
  ]).flat());
const r = ResultSchemaV2.parse(compare(four(() => "Hull limit any one aircraft USD 1,000,000"), four((p) => `Hull limit any one aircraft USD ${p === 1 ? "2,000,000" : "1,000,000"}`)));
for (const d of r.differences) {
  const [L, R] = [d.occurrences.filter((o) => o.left.length).length, d.occurrences.filter((o) => o.right.length).length];
  console.log(JSON.stringify(d.oldText), "->", JSON.stringify(d.newText), "repeat", JSON.stringify(d.repeat), "occurrences with left/right", L, R,
    "right texts", JSON.stringify(d.occurrences.flatMap((o) => o.right.map((l) => l.text))),
    "=> scorer repeat check", d.repeat && (d.repeat.left !== L || d.repeat.right !== R) ? "FAULT" : "ok");
}
