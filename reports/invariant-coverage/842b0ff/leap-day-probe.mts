// The product's dates_rolled_forward_one_year against the scorer's own recomputation (factHolds),
// on #2's synthetic inputs from tests/result-format-2.test.ts ("PERIOD: ..." is read as the policy_period field).
// Synthetic text through compare(), not an end-to-end run on a real layout.
//   pnpm exec tsx reports/invariant-coverage/842b0ff/leap-day-probe.mts                 # product of this tree
//   git show 2740d94:packages/compare-core/index.ts > packages/compare-core/before.ts    # product before the fix
//   pnpm exec tsx reports/invariant-coverage/842b0ff/leap-day-probe.mts packages/compare-core/before.ts; rm packages/compare-core/before.ts
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { textDoc } from "../../../tests/helpers";
import { factHolds } from "../../../tests/evaluation/scorer";
const core = process.argv[2] ?? "packages/compare-core/index.ts";
const { compare } = await import(pathToFileURL(resolve(core)).href);
const pairs = [
  ["1 March 2023 to 29 February 2024", "1 March 2024 to 28 February 2025"],
  ["1 April 2024 to 30 September 2024", "1 April 2025 to 30 September 2025"],
  ["01 April 2024 to 31 March 2025", "01 April 2025 to 31 March 2026"],
];
console.log("product:", core);
for (const [a, b] of pairs) {
  const docs = [a, b].map((p) => textDoc([{ text: `PERIOD: ${p} coverage includes war risks` }]));
  for (const d of compare(docs[0], docs[1]).differences)
    console.log(`${a} -> ${b}: product states ${JSON.stringify(d.facts)}; scorer recomputes dates_rolled_forward_one_year ${factHolds("dates_rolled_forward_one_year", d, docs as any)}`);
}
