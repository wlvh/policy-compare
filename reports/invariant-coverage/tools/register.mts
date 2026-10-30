// Coverage register of one evidence folder: every invariant with its coverage, basis, tests, cases and
// the four runs' results. Usage, from the repository root:
//   pnpm exec tsx reports/invariant-coverage/tools/register.mts <evidence folder> <full code commit>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const [V, commit] = process.argv.slice(2);
const { INVARIANTS } = await import(resolve("tests/evaluation/scorer.ts"));
const runs = Object.fromEntries(
  ["rules-mupdf", "rules-pdfjs", "browser-rules-mupdf", "browser-rules-pdfjs"].map((n) => [n, JSON.parse(readFileSync(`${V}/${n}.json`, "utf8"))]),
);
const cases: Record<string, string[]> = {};
for (const c of readdirSync("validation/dataset/cases"))
  for (const i of JSON.parse(readFileSync(`validation/dataset/cases/${c}/expected.json`, "utf8")).invariants)
    (cases[i] ??= []).push(c);
const register = Object.entries(INVARIANTS as Record<string, any>).map(([name, v]) => ({
  name,
  coverage: v.coverage,
  basis: v.basis,
  tests: v.coverage === "direct" ? ["direct invariant check rejects a violation: " + name, ...v.tests] : v.tests,
  cases: cases[name].sort(),
  results: Object.fromEntries(
    Object.entries(runs).map(([run, r]) => [
      run,
      Object.fromEntries(
        cases[name].map((c) => [c, r.records.find((x: any) => x.caseId === c).invariants.find((i: any) => i.name === name).result]),
      ),
    ]),
  ),
}));
writeFileSync(`${V}/register.json`, JSON.stringify({ codeCommit: commit, invariants: register }, null, 1) + "\n");
const count = (c: string) => register.filter((r) => r.coverage === c).length;
console.log("direct", count("direct"), "indirect", count("indirect"), "unsupported", count("unsupported"), "total", register.length);
const bad = register.filter((r) => Object.values(r.results).some((m: any) => Object.values(m).some((x) => x === "FAIL")));
console.log("invariants with FAIL:", bad.map((b) => b.name));
