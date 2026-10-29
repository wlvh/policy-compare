// Compares each generator's left/right PDFs with both engines and checks the
// known events of expected.json: each event must be on exactly one card of
// the expected kind that carries its record, or (round 8) a Replaced event on
// exactly one Removed card with the old text and one Added card with the new
// text, each carrying the record ("SPLIT", reported apart from PASS). No card
// may join records listed in mustNotPair. Results are format 2: there is no
// category to check. expected.json is read only after the comparison.
// usage: pnpm exec tsx reports/issue-2-validation/generators/check.ts PDF_DIR OUT_DIR
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { loadEngine, type EngineName } from "../../../packages/pdf-adapter/node";
import { compare } from "../../../packages/compare-core/index";
import { canonical, parseDoc, type DifferenceV2 as Difference } from "../../../packages/contracts/index";
const [pdfDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const squash = (s: string) => s.replace(/\s+/g, "");
const report: Record<string, unknown>[] = [];
for (const generator of ["chromium", "libreoffice"])
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
      // One delete + one add, each holding the record and its side of the edit.
      const side = (kind: string, s: "old" | "new", t: string) =>
        result.differences.filter((d) => d.kind === kind && has(d, s, t) && (!e.record || has(d, s, e.record)));
      const split = e.kind === "Replaced" && !hits.length && e.old && e.new
        ? [side("Removed", "old", e.old), side("Added", "new", e.new)] : null;
      const parts = split?.every((x) => x.length === 1) ? split.flat() : [];
      [...hits, ...parts].forEach((d) => used.add(d.id));
      const status =
        hits.length === 1 ? "PASS"
        : hits.length ? "AMBIGUOUS"
        : parts.length ? "SPLIT"
        : "NOT_FOUND";
      return {
        ...e,
        status,
        cards: [...hits, ...parts].map((d) => ({
          id: d.id, kind: d.kind, facts: d.facts, method: d.matchEvidence.method,
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
      id: d.id, kind: d.kind, facts: d.facts, method: d.matchEvidence.method, repeat: d.repeat,
      section: d.structurePath?.section, occurrences: d.occurrences.length, pages: pages(d),
      oldText: d.oldText.slice(0, 160), newText: d.newText.slice(0, 160),
    }));
    const record = {
      generator, engine,
      producers: docs.map((d) => d.extractor.name + " " + d.extractor.version),
      inputSha256: files.map((f) => createHash("sha256").update(readFileSync(f)).digest("hex")),
      resultSha256: createHash("sha256").update(text).digest("hex"),
      status: result.status, cards: result.differences.length, unresolved: result.unresolved.length,
      eventsPassed: events.filter((e: any) => e.status === "PASS").length,
      eventsSplit: events.filter((e: any) => e.status === "SPLIT").length, eventsTotal: events.length,
      crossedRecords: crossed, events,
      otherCards: other,
    };
    report.push(record);
    console.log(JSON.stringify({ generator, engine, status: result.status, cards: record.cards,
      events: `${record.eventsPassed}/${record.eventsTotal}`, split: record.eventsSplit, crossed: crossed.length,
      failed: events.filter((e: any) => e.status !== "PASS").map((e: any) => `${e.id}:${e.status}`),
      other: other.map((o) => `${o.kind}/${o.facts.join("+")}/${o.section}:${o.oldText.slice(0, 30)}=>${o.newText.slice(0, 30)}`) }));
  }
writeFileSync(path.join(outDir, "generator-check.json"), JSON.stringify(report, null, 1) + "\n");
if (report.some((r: any) => r.eventsPassed + r.eventsSplit !== r.eventsTotal || r.crossedRecords.length)) process.exitCode = 1;
