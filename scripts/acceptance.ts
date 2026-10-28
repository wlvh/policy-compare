import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { loadEngine, type EngineName } from "../packages/pdf-adapter/node";
const engine: EngineName = process.argv[2] === "pdfjs" ? "pdfjs" : "mupdf";
const { extractPdf } = await loadEngine(engine);
import { compare } from "../packages/compare-core/index";
import { parseDoc, digest, ResultSchema } from "../packages/contracts/index";
import { grade, summarize } from "../tests/evaluation/scorer";
const manifest = JSON.parse(
  readFileSync("validation/dataset/manifest.json", "utf8"),
);
mkdirSync("reports", { recursive: true });
const records: (Parameters<typeof summarize>[0][number] &
  Record<string, unknown>)[] = [];
for (const meta of manifest.cases) {
  const dir = "validation/dataset/cases/" + meta.case_id;
  try {
    const docs = await Promise.all(
      ["before", "after"].map(async (side) =>
        parseDoc(await extractPdf(readFileSync(`${dir}/${side}.pdf`))),
      ),
    );
    const result = ResultSchema.parse(compare(docs[0], docs[1]));
    const score = grade(
      result,
      JSON.parse(readFileSync(dir + "/expected.json", "utf8")),
      JSON.parse(readFileSync(dir + "/layout.json", "utf8")),
      [docs[0], docs[1]],
    );
    records.push({
      ...score,
      differences: result.differences.length,
      resultStatus: result.status,
    });
    // NOT_EVALUATED is kept for review too: it never counts as passed.
    if (score.status !== "PASS") {
      mkdirSync("reports/failures", { recursive: true });
      writeFileSync(
        `reports/failures/${engine}-${meta.case_id}-${Date.now()}.json`,
        JSON.stringify({ result, score }, null, 2),
      );
    }
    console.log(
      meta.case_id,
      score.status,
      [
        ...score.faults,
        ...score.notEvaluated.map((n) => `not evaluated ${n.eventId}: ${n.reason}`),
      ].join("; "),
    );
  } catch (e) {
    records.push({ caseId: meta.case_id, status: "FAIL", error: String(e) });
    console.log(meta.case_id, "FAIL", String(e));
  }
}
const summary = summarize(records);
const report = {
  subject: "actual_pdf_product_rules",
  engine,
  finePositionStatus: engine === "pdfjs" ? "NOT_RUN" : "PASS",
  finePositionEvidence:
    engine === "pdfjs"
      ? "See separate real-browser rules report; Node records engine-run sources only"
      : "Native character quads",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  manifestHash: digest(manifest),
  ...summary,
  records,
};
writeFileSync(
  `reports/rules-${engine}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
process.exitCode = summary.status === "PASS" ? 0 : 1;
