// Run from the repository root: pnpm exec tsx reports/invariant-coverage/c9c6e0c/probes/page-codes-probe.ts
// page_number_only as the scorer recomputes it, with currency codes outside the scorer's list (Codex
// PR #11 comment 6519800754) and controls (true holds, false disproved, null undecided).
import { factHolds } from "../../../../tests/evaluation/scorer";
const cases: [string, string, string][] = [
  ["Codex: NZD attached", "Printing cost per page 100NZD", "Printing cost per page 200NZD"],
  ["Codex: INR attached", "Printing cost per page 100INR", "Printing cost per page 200INR"],
  ["Codex: AED attached", "Printing cost per page 100AED", "Printing cost per page 200AED"],
  ["AED after a space, page then amount", "Page 3 AED 100", "Page 4 AED 100"],
  ["control: USD attached (listed)", "Printing cost per page 100USD", "Printing cost per page 200USD"],
  ["control: PAGE 3 OF 10", "PAGE 3 OF 10", "PAGE 4 OF 10"],
  ["control: PAGE 3 NOTE", "PAGE 3 NOTE", "PAGE 4 NOTE"],
  ["control: Page 3 of 10", "Page 3 of 10", "Page 4 of 10"],
];
for (const [name, a, b] of cases) {
  const d = { left: [{}], right: [{}], oldText: a, newText: b } as never;
  console.log(`${name}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}: ${factHolds("page_number_only", d, [] as never)}`);
}
