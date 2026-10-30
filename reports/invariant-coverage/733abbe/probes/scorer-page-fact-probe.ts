// page_number_only as the scorer recomputes it, on the texts of Codex r4421658769 and controls.
// Run from the repository root: pnpm exec tsx reports/invariant-coverage/733abbe/probes/scorer-page-fact-probe.ts
import { factHolds } from "../../../../tests/evaluation/scorer";
const cases: [string, string | null, string | null][] = [
  ["Codex: per-page amount", "Printing cost per page 100USD", "Printing cost per page 200USD"],
  ["Codex: percentage", "Page 4%", "Page 5%"],
  ["percentage, spaced", "Page 4 %", "Page 5 %"],
  ["amount, currency sign", "Cost per page 100€", "Cost per page 200€"],
  ["percentage as the total", "Page 3 of 10%", "Page 3 of 11%"],
  ["currency code after a space (undecidable)", "Cost per page 100 USD", "Cost per page 200 USD"],
  ["currency code after a space, page then amount (undecidable)", "Page 3 USD 100", "Page 4 USD 100"],
  ["one side: Page 4%", null, "Page 4%"],
  ["control: Page 3 of 10 -> Page 4 of 10", "Page 3 of 10", "Page 4 of 10"],
  ["control: Page 3 -> Page 4, amount unchanged after the total", "Page 3 of 10 USD 100", "Page 4 of 10 USD 100"],
  ["a changed total with a currency after a space (undecidable)", "Page 3 of 10 USD 100", "Page 3 of 11 USD 100"],
  ["control: one side: Page 4", null, "Page 4"],
];
for (const [name, a, b] of cases) {
  const d = { left: a === null ? [] : [{}], right: b === null ? [] : [{}], oldText: a ?? "", newText: b ?? "" } as never;
  console.log(`${name}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}: ${factHolds("page_number_only", d, [] as never)}`);
}
