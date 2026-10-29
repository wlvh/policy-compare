// Probe: grade the product's own output (joint tree) for #2's r4417244277 case and analogs.
import { compare } from "/home/user/policy-compare/packages/compare-core/index";
import { textDoc } from "/home/user/policy-compare/tests/helpers";
import { grade } from "/home/user/policy-compare/tests/evaluation/scorer";
import type { DocInput } from "/home/user/policy-compare/packages/contracts/index";
type Line = { text: string; x?: number; y: number };
const pages = (count: number, each: (page: number) => Line[]) =>
  textDoc(Array.from({ length: count }, (_, page) => each(page).map((l) => ({ ...l, page }))).flat());
const four = (header: (p: number) => string | null) =>
  pages(4, (p) => [...(header(p) === null ? [] : [{ text: header(p)!, x: 40, y: 60 }]), { text: `Ordinary body on page ${p + 1}`, x: 40, y: 300 }]);
const layoutOf = (d: DocInput) => ({
  pages: d.pages.map((p) => ({
    text_runs: p.lines.map((l) => {
      const chars = l.charIds.map((id) => p.chars.find((c) => c.id === id)!);
      return { run_id: chars.map((c) => c.text).join(""), text: chars.map((c) => c.text).join(""), direction: [1, 0],
        characters: chars.map((c) => ({ quad_tl_tr_br_bl: [[c.quad[0], c.quad[1]], [c.quad[2], c.quad[3]], [c.quad[6], c.quad[7]], [c.quad[4], c.quad[5]]] })) };
    }),
  })),
});
const run = (name: string, left: DocInput, right: DocInput) => {
  const r = compare(left, right);
  const expected = { case_id: name, required_status: r.status, events: [], invariants: [], coverage_requirements: [], evidence_locations: {} } as any;
  const s = grade(r as any, expected, { before: layoutOf(left), after: layoutOf(right) } as any, [left, right]);
  console.log(`## ${name}: product ${r.coreVersion}`);
  for (const d of (r as any).differences)
    console.log(`  card ${d.kind} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)} repeat ${JSON.stringify(d.repeat)} facts ${JSON.stringify(d.facts)} occurrences ${d.occurrences.length}`);
  console.log(`  scorer: ${s.status}; faults ${JSON.stringify(s.faults)}; open ${JSON.stringify(s.notEvaluated.map((n: any) => n.reason))}`);
};
// Codex r4418530241 (PR #9): a profile-declared repeated header with a page counter; only the last counter changes.
const hdr = (v: (p: number) => string, y = 40) => pages(4, (p) => [{ text: v(p), x: 40, y }, { text: `Ordinary body on page ${p + 1}`, x: 40, y: 300 }]);
run("declared header REPEATED HEADER LIMIT: Page 1..4 -> last Page 5", hdr((p) => `REPEATED HEADER LIMIT: Page ${p + 1}`), hdr((p) => `REPEATED HEADER LIMIT: Page ${p === 3 ? 5 : p + 1}`));
run("control: plain Page 1..4 -> last Page 5", hdr((p) => `Page ${p + 1}`), hdr((p) => `Page ${p === 3 ? 5 : p + 1}`));
