// Round 9: the source units and line baselines of the aviation premium-rate pages (left page 20,
// right page 19) in both engines, to check the item number and cover name of rate events #87-#93
// against what the extraction and the product's structure recovery hold.
// usage: pnpm exec tsx reports/issue-2-validation/rate-units.ts INPUTS > OUT_TXT
import { readFileSync } from "node:fs";
import { loadEngine } from "../../packages/pdf-adapter/node";
import { parseDoc } from "../../packages/contracts/index";
import { structure } from "../../packages/compare-core/structure";
import { aviationProfile } from "../../profiles/aviation";
const [inputs] = process.argv.slice(2);
const LINE = /^(\d\.\d|Contingent|Possessed|Technical|Deregistration|USD [\d,]+ (each|Sum))/;
for (const engine of ["mupdf", "pdfjs"] as const) {
  const { extractPdf } = await loadEngine(engine);
  for (const [side, page] of [["left", 20], ["right", 19]] as const) {
    const doc = parseDoc(await extractPdf(readFileSync(`${inputs}/testdata/renewal/aviation_2024_vs_2025/${side}.pdf`)));
    console.log(`== ${engine} ${side} page ${page}: units`);
    for (const u of structure(doc, aviationProfile).filter((u) => u.role !== "logical_separator" && u.refs.some((r) => r && r.page.pageIndex === page - 1)))
      console.log(`  [${u.id}] ${u.role}${u.rowCells ? " row:" + JSON.stringify(u.rowCells) : ""} title=${JSON.stringify(u.title)} :: ${u.rawText}`);
    console.log(`== ${engine} ${side} page ${page}: line baselines`);
    const p = doc.pages[page - 1];
    const chars = new Map(p.chars.map((c) => [c.id, c.text]));
    for (const l of p.lines) {
      const text = l.charIds.map((i) => chars.get(i) ?? "").join("");
      if (LINE.test(text)) console.log(`  ${JSON.stringify(text)} at ${JSON.stringify(l.baseline)}`);
    }
  }
}
