// Codex r4416878298: four "REPEATED HEADER LIMIT: USD 1000" lines, the third revised to "USD1000".
// The product's output on the joint tree, graded by the scorer given as argv[2].
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
const left = four(() => "REPEATED HEADER LIMIT: USD 1000"), right = four((p) => (p === 2 ? "REPEATED HEADER LIMIT: USD1000" : "REPEATED HEADER LIMIT: USD 1000"));
const r = compare(left, right);
const expected = { case_id: "joined", required_status: r.status, events: [], invariants: [], coverage_requirements: [], evidence_locations: {} } as any;
const s = grade(r as any, expected, { before: layoutOf(left), after: layoutOf(right) } as any, [left, right]);
console.log(`scorer ${process.argv[2].split("/").pop()}; product ${r.coreVersion}`);
for (const d of (r as any).differences)
  console.log(`  card ${d.kind} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)} repeat ${JSON.stringify(d.repeat)} context ${d.occurrences.filter((o: any) => o.context).length}`);
console.log(`  ${s.status}; faults ${JSON.stringify(s.faults)}`);
