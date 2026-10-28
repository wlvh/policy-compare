// Compares each generator's left/right PDFs with both engines and checks the
// known events of expected.json: each event must be on exactly one card of
// the expected kind that carries its record, and no card may join records
// listed in mustNotPair. expected.json is read only after the comparison.
// usage: pnpm exec tsx reports/issue-2-validation/generators/check.ts PDF_DIR OUT_DIR
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { loadEngine, type EngineName } from "../../../packages/pdf-adapter/node";
import { compare } from "../../../packages/compare-core/index";
import { canonical, parseDoc, type Difference } from "../../../packages/contracts/index";
const [pdfDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const squash = (s: string) => s.replace(/\s+/g, "");
const report: Record<string, unknown>[] = [];
for (const generator of readdirSync(pdfDir).filter((d) => !d.includes(".")).sort())
  for (const engine of ["mupdf", "pdfjs"] as EngineName[]) {
    const { extractPdf } = await loadEngine(engine);
    const files = ["left", "right"].map((s) => path.join(pdfDir, generator, s + ".pdf"));
    const docs = await Promise.all(files.map(async (f) => parseDoc(await extractPdf(readFileSync(f)))));
    const result = compare(docs[0], docs[1]);
    const text = canonical(result) + "\n";
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, `${generator}-${engine}.json.gz`), gzipSync(text, { level: 9 }));
    const expected = JSON.parse(readFileSync(path.join(pdfDir, "expected.json"), "utf8"));
    const has = (d: Difference, side: "old" | "new", s: string) =>
      squash(side === "old" ? d.oldText : d.newText).includes(squash(s));
    const pages = (d: Difference) => ({
      left: [...new Set(d.left.map((l) => l.pageIndex + 1))],
      right: [...new Set(d.right.map((l) => l.pageIndex + 1))],
    });
    const used = new Set<string>();
    const events = expected.events.map((e: any) => {
      const hits = result.differences.filter(
        (d) =>
          d.kind === e.kind &&
          (!e.old || has(d, "old", e.old)) &&
          (!e.new || has(d, "new", e.new)) &&
          (!e.record || ((e.kind === "Added" || has(d, "old", e.record)) && (e.kind === "Removed" || has(d, "new", e.record)))),
      );
      hits.forEach((d) => used.add(d.id));
      const card = hits[0];
      const status =
        hits.length !== 1 ? (hits.length ? "AMBIGUOUS" : "NOT_FOUND")
        : card.category !== "Material" ? "WRONG_CATEGORY"
        : "PASS";
      return {
        ...e,
        status,
        cards: hits.map((d) => ({
          id: d.id, kind: d.kind, category: d.category, method: d.matchEvidence.method,
          rowKey: d.structurePath?.rowKey ?? null, pages: pages(d), oldText: d.oldText, newText: d.newText,
        })),
      };
    });
    const crossed = expected.mustNotPair.flatMap(([a, b]: string[]) =>
      result.differences
        .filter((d) => d.structurePath?.confidence !== "unresolved" &&
          ((has(d, "old", a) && has(d, "new", b) && !has(d, "new", a)) ||
           (has(d, "old", b) && has(d, "new", a) && !has(d, "new", b))))
        .map((d) => ({ pair: [a, b], id: d.id, oldText: d.oldText, newText: d.newText })),
    );
    const other = result.differences.filter((d) => !used.has(d.id)).map((d) => ({
      id: d.id, kind: d.kind, category: d.category, method: d.matchEvidence.method,
      section: d.structurePath?.section, occurrences: d.occurrences.length, pages: pages(d),
      oldText: d.oldText.slice(0, 160), newText: d.newText.slice(0, 160),
    }));
    const record = {
      generator, engine,
      producers: docs.map((d) => d.extractor.name + " " + d.extractor.version),
      inputSha256: files.map((f) => createHash("sha256").update(readFileSync(f)).digest("hex")),
      resultSha256: createHash("sha256").update(text).digest("hex"),
      status: result.status, cards: result.differences.length, unresolved: result.unresolved.length,
      eventsPassed: events.filter((e: any) => e.status === "PASS").length, eventsTotal: events.length,
      crossedRecords: crossed, events,
      otherCards: other,
    };
    report.push(record);
    console.log(JSON.stringify({ generator, engine, status: result.status, cards: record.cards,
      events: `${record.eventsPassed}/${record.eventsTotal}`, crossed: crossed.length,
      failed: events.filter((e: any) => e.status !== "PASS").map((e: any) => `${e.id}:${e.status}`),
      other: other.map((o) => `${o.kind}/${o.category}/${o.section}:${o.oldText.slice(0, 30)}=>${o.newText.slice(0, 30)}`) }));
  }
writeFileSync(path.join(outDir, "generator-check.json"), JSON.stringify(report, null, 1) + "\n");
if (report.some((r: any) => r.eventsPassed !== r.eventsTotal || r.crossedRecords.length)) process.exitCode = 1;
