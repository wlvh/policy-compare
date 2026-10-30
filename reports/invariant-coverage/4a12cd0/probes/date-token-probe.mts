// Probe for Codex PR #11 comment 6513158877: whole day and year numbers in the roll-forward fact.
// Grades the product's own card for one changed line with a given scorer. Usage: npx tsx probe.mts <scorer path>
import { compare } from "/home/user/policy-compare/packages/compare-core/index";
import { textDoc } from "/home/user/policy-compare/tests/helpers";
const { grade, factHolds } = await import(process.argv[2]);
const cases: [string, string, string][] = [
  ["year 20240 -> 20250 (ten years)", "PERIOD: 1 January 20240 to 31 December 20240 coverage includes war risks", "PERIOD: 1 January 20250 to 31 December 20250 coverage includes war risks"],
  ["day 121", "PERIOD: 121 January 2024 to 31 December 2024 coverage includes war risks", "PERIOD: 121 January 2025 to 31 December 2025 coverage includes war risks"],
  ["year 2024.5", "PERIOD: 1 January 2024.5 to 31 December 2024 coverage includes war risks", "PERIOD: 1 January 2025.5 to 31 December 2025 coverage includes war risks"],
  ["control: whole dates", "PERIOD: 1 January 2024 to 31 December 2024 coverage includes war risks", "PERIOD: 1 January 2025 to 31 December 2025 coverage includes war risks"],
];
for (const [name, before, after] of cases) {
  const docs = [textDoc([{ text: before }]), textDoc([{ text: after }])];
  const r = compare(docs[0], docs[1]);
  const d = r.differences[0];
  const expected = { case_id: name, required_status: r.status, events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
  const s = grade(r, expected, { before: { pages: [] }, after: { pages: [] } }, docs);
  console.log(`${name}: product facts ${JSON.stringify(d.facts)}; scorer factHolds ${factHolds("dates_rolled_forward_one_year", d, docs)}; grade ${s.status} ${JSON.stringify(s.faults.filter((f: string) => f.includes("dates_rolled")))}`);
}
