import { compare } from "../../../../packages/compare-core/index";
import { textDoc } from "../../../../tests/helpers";
const doc = (count: number, line: (p: number) => string | null) => textDoc(Array.from({ length: count }, (_, page) => [
  ...(line(page) === null ? [] : [{ text: line(page)!, x: 40, y: 120, page }]),
  { text: `Clause ${page + 1} keeps the insured terms unchanged.`, x: 40, y: 400, page }]).flat());
const show = (name: string, a: any, b: any) => {
  const r: any = compare(a, b);
  console.log(name, r.schemaVersion, r.status);
  for (const d of r.differences) console.log("  ", JSON.stringify([d.kind, d.category ?? null, d.facts ?? null, d.oldText, d.newText, d.matchEvidence.method, d.repeat ?? null, d.reviewReasons.join("")]));
};
show("4/4 -> 3/5", doc(4, () => "War risks excluded"), doc(5, (p) => (p < 3 ? "War risks excluded" : null)));
show("4/4 -> 5/5", doc(4, () => "War risks excluded"), doc(5, () => "War risks excluded"));
show("1%..4% -> 5%..8%", doc(4, (p) => `${p + 1}%`), doc(4, (p) => `${p + 5}%`));
show("$1..$4 -> $5..$8", doc(4, (p) => `$${p + 1}`), doc(4, (p) => `$${p + 5}`));
show("- n - 4 -> 5 pages", doc(4, (p) => `- ${p + 1} -`), doc(5, (p) => `- ${p + 1} -`));
show("Page n of 4 -> of 5", doc(4, (p) => `Page ${p + 1} of 4`), doc(5, (p) => `Page ${p + 1} of 5`));
