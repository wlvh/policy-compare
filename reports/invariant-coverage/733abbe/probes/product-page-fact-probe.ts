// The product's page_number_only on Codex r4421658769's texts: a per-page amount and a percentage
// after "Page" on a footer line, against plain page counters.
// Run from the repository root: pnpm exec tsx reports/invariant-coverage/733abbe/probes/product-page-fact-probe.ts
import { compare } from "../../../../packages/compare-core/index";
import { ResultSchemaV2 } from "../../../../packages/contracts/index";
import { textDoc } from "../../../../tests/helpers";

// Pages are 600 x 850; y=815 is a footer, as in tests/margin-text.test.ts.
const footer = (body: string, text: string) => textDoc([{ text, x: 40, y: 815 }, { text: body, x: 40, y: 300 }]);
for (const [a, b] of [
  ["Printing cost per page 100USD", "Printing cost per page 200USD"],
  ["Page 4%", "Page 5%"],
  ["Cost per page 100€", "Cost per page 200€"],
  ["Page 3 of 10%", "Page 3 of 11%"],
  ["Page 3 of 10", "Page 4 of 10"],
]) {
  const r = ResultSchemaV2.parse(compare(footer("Ordinary unchanged body text.", a), footer("Ordinary unchanged body text.", b)));
  const cards = r.differences.map((d) => `${d.kind} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)} facts=${JSON.stringify(d.facts)}`);
  console.log(`${JSON.stringify(a)} -> ${JSON.stringify(b)}: ${cards.join(" || ") || "no differences"}`);
}
