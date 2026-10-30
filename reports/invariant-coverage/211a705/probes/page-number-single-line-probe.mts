// Codex PR #9 comment 6514411176: a single-page comparison, "Page 1" vs "Page 2" at y=80; the
// product states page_number_only. Graded by the scorer at the path given (argv[2]).
import { compare } from "/home/user/policy-compare/packages/compare-core/index";
import { ResultSchemaV2 } from "/home/user/policy-compare/packages/contracts/index";
import { textDoc } from "/home/user/policy-compare/tests/helpers";
const { grade, factHolds } = await import(process.argv[2]);
const doc = (top: string) => textDoc([{ text: top, x: 280, y: 80, page: 0 }, { text: "Body text here.", x: 40, y: 300, page: 0 }]);
const layoutOf = (d: any) => ({ pages: d.pages.map((p: any) => ({ text_runs: p.lines.map((l: any) => ({ run_id: l.id, text: "", direction: [1, 0], characters: [] })) })) });
for (const [name, a, b] of [
  ["Page 1 -> Page 2", "Page 1", "Page 2"],
  ["Schedule Page 3 of 10 -> Schedule Page 3 of 11", "Schedule Page 3 of 10", "Schedule Page 3 of 11"],
  ["control: Draft Page 1 -> Final Page 2", "Draft Page 1", "Final Page 2"],
] as const) {
  const [l, r] = [doc(a), doc(b)];
  const res = ResultSchemaV2.parse(compare(l, r));
  const score = grade(res, { case_id: "x", required_status: res.status, events: [], invariants: [], coverage_requirements: [], evidence_locations: {} } as any, { before: layoutOf(l), after: layoutOf(r) } as any, [l, r]);
  console.log(`${name} | cards ${res.differences.map((d) => `${JSON.stringify(d.oldText)}->${JSON.stringify(d.newText)} role ${d.structurePath?.section} facts ${JSON.stringify(d.facts)}`).join(" ; ")} | status ${score.status} | faults ${JSON.stringify(score.faults)} | not evaluated ${JSON.stringify((score.notEvaluated ?? []).map((n: any) => n.kind + ": " + n.reason))}`);
}
