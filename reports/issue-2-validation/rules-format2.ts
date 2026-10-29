// Product side of the 32 rule pairs under result format 2, without grading:
// per case, whether the result parses as format 2, its status, its cards by
// kind and correspondence method, the facts it states, occurrence-count
// cards, and the card count of a stored earlier run. Grading is the scorer's
// (#10); this only shows what the product now says.
// usage: pnpm exec tsx reports/issue-2-validation/rules-format2.ts ENGINE EARLIER_RULES_JSON OUT_JSON
import { readFileSync, writeFileSync } from "node:fs";
import { loadEngine, type EngineName } from "../../packages/pdf-adapter/node";
import { compare } from "../../packages/compare-core/index";
import { parseDoc, ResultSchemaV2 } from "../../packages/contracts/index";
const [engine, earlierPath, out] = process.argv.slice(2) as [EngineName, string, string];
const { extractPdf } = await loadEngine(engine);
const manifest = JSON.parse(readFileSync("validation/dataset/manifest.json", "utf8"));
const earlier = new Map<string, { differences: number; resultStatus: string }>(
  JSON.parse(readFileSync(earlierPath, "utf8")).records.map((r: any) => [r.caseId, r]),
);
const count = (xs: string[]) => Object.fromEntries([...new Set(xs)].map((x) => [x, xs.filter((y) => y === x).length]));
const records = [];
for (const meta of manifest.cases) {
  const dir = "validation/dataset/cases/" + meta.case_id;
  const docs = await Promise.all(["before", "after"].map(async (s) => parseDoc(await extractPdf(readFileSync(`${dir}/${s}.pdf`)))));
  const raw = compare(docs[0], docs[1]);
  const parsed = ResultSchemaV2.safeParse(raw);
  const r = raw.differences;
  const before = earlier.get(meta.case_id);
  records.push({
    caseId: meta.case_id, format2: parsed.success, status: raw.status, requiredStatus: meta.required_status,
    cards: r.length, earlierCards: before?.differences ?? null, earlierStatus: before?.resultStatus ?? null,
    kinds: count(r.map((d) => d.kind)), methods: count(r.map((d) => d.matchEvidence.method)),
    facts: count(r.flatMap((d) => d.facts)), occurrenceCountCards: r.filter((d) => d.repeat && d.oldText === d.newText).length,
    unresolved: raw.unresolved.length,
  });
}
writeFileSync(out, JSON.stringify({ engine, records }, null, 1) + "\n");
const changed = records.filter((x) => x.cards !== x.earlierCards || x.status !== x.earlierStatus);
console.log(JSON.stringify({ engine, cases: records.length, format2: records.filter((x) => x.format2).length,
  statusAsRequired: records.filter((x) => x.status === x.requiredStatus).length,
  changedFromEarlier: changed.map((x) => `${x.caseId}: ${x.earlierCards}->${x.cards} ${x.earlierStatus}->${x.status}`) }));
