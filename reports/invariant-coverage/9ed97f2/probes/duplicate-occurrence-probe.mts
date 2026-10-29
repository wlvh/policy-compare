// Codex r4416805143: a four-page repeated header changed on every page; the first occurrence listed twice, both counts raised 4 -> 5.
// The product output on the joint tree, mutated, graded by the scorer given as argv[2].
import { compare } from "/home/user/policy-compare/packages/compare-core/index";
import { textDoc } from "/home/user/policy-compare/tests/helpers";
import type { DocInput } from "/home/user/policy-compare/packages/contracts/index";
const { grade } = await import(process.argv[2]);
type Line = { text: string; x?: number; y: number };
const pages = (count: number, each: (page: number) => Line[]) =>
  textDoc(Array.from({ length: count }, (_, page) => each(page).map((l) => ({ ...l, page }))).flat());
const four = (header: (p: number) => string) => pages(4, (p) => [{ text: header(p), x: 40, y: 60 }, { text: `Ordinary body on page ${p + 1}`, x: 40, y: 300 }]);
const layoutOf = (d: DocInput) => ({
  pages: d.pages.map((p) => ({
    text_runs: p.lines.map((l) => {
      const chars = l.charIds.map((id) => p.chars.find((c) => c.id === id)!);
      return { run_id: chars.map((c) => c.text).join(""), text: chars.map((c) => c.text).join(""), direction: [1, 0],
        characters: chars.map((c) => ({ quad_tl_tr_br_bl: [[c.quad[0], c.quad[1]], [c.quad[2], c.quad[3]], [c.quad[6], c.quad[7]], [c.quad[4], c.quad[5]]] })) };
    }),
  })),
});
const left = four(() => "REPEATED HEADER LIMIT: USD 1000"), right = four(() => "REPEATED HEADER LIMIT: USD 2000");
for (const dup of [false, true]) {
  const r = compare(left, right) as any;
  const d = r.differences.find((x: any) => x.repeat);
  if (dup) {
    d.occurrences.push({ left: [...d.occurrences[0].left], right: [...d.occurrences[0].right] });
    d.repeat.left = 5;
    d.repeat.right = 5;
  }
  const expected = { case_id: "dup", required_status: r.status, events: [], invariants: [], coverage_requirements: [], evidence_locations: {} } as any;
  const s = grade(r, expected, { before: layoutOf(left), after: layoutOf(right) } as any, [left, right]);
  console.log(`scorer ${process.argv[2].split("/").pop()}; ${dup ? "first occurrence listed twice, counts 5/5" : "product output as is"}: card ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)} repeat ${JSON.stringify(d.repeat)} occurrences ${d.occurrences.length}`);
  console.log(`  ${s.status}; faults ${JSON.stringify(s.faults)}`);
}
