// Real-fixture check: does every quad a product card cites fall in a layout.json run, and which amount cells are cited?
// Run from the repository root: pnpm exec tsx reports/invariant-coverage/55e669a/geometry-probe.mts <mupdf|pdfjs>
import { readFileSync } from "node:fs";
import { loadEngine } from "../../../packages/pdf-adapter/node";
import { compare } from "../../../packages/compare-core/index";
import { parseDoc } from "../../../packages/contracts/index";
const engine = process.argv[2] as "mupdf" | "pdfjs";
const { extractPdf } = await loadEngine(engine);
const box = (p: number[][]) => [Math.min(...p.map((x) => x[0])), Math.min(...p.map((x) => x[1])), Math.max(...p.map((x) => x[0])), Math.max(...p.map((x) => x[1]))];
const ov = (a: number[], b: number[]) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const ar = (a: number[]) => Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
for (const c of ["R11_label_alias", "R26_key_change", "R22_table_value", "R02_amount"]) {
  const dir = "validation/dataset/cases/" + c;
  const docs = await Promise.all(["before", "after"].map(async (s) => parseDoc(await extractPdf(readFileSync(`${dir}/${s}.pdf`)))));
  const layout = JSON.parse(readFileSync(dir + "/layout.json", "utf8"));
  const res = compare(docs[0], docs[1]);
  let chars = 0, mapped = 0, amountCells: string[] = [];
  for (const d of res.differences)
    for (const side of ["left", "right"] as const)
      for (const loc of [...d[side], ...d.textOps.flatMap((o: any) => o[side])]) {
        const runs = layout[side === "left" ? "before" : "after"].pages[loc.pageIndex].text_runs.filter((r: any) => r.characters.length).map((r: any) => ({ r, b: box(r.characters.flatMap((x: any) => x.quad_tl_tr_br_bl)) }));
        for (const q of loc.quads) {
          const b = box([[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]]);
          const hit = runs.filter((x: any) => ov(b, x.b) > 0.5 * Math.min(ar(b), ar(x.b)));
          chars++; if (hit.length) mapped++;
          for (const h of hit) if (/agreed_value|sum_insured|limit|deductible/.test(h.r.logical_path?.split(".").at(-1) ?? "")) amountCells.push(`${side}:${h.r.text}`);
        }
      }
  console.log(engine, c, "cards", res.differences.length, "cited quads", chars, "mapped", mapped, "amount cells", [...new Set(amountCells)].join(" | "));
}
