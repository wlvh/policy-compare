// Diagnostic for the row-identity scope review: recomputes every unique
// identity link rowIdentity can form (same section+title scope, same
// position among non-value cells, unique on both sides) and compares the
// physical x position of the linking cell on both sides. A link whose cells
// start more than 3 pt apart would join different columns or tables.
// usage: pnpm exec tsx reports/issue-2-validation/identity-columns.ts INPUTS OUT_JSON
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEngine, type EngineName } from "../../packages/pdf-adapter/node";
import { structure, type Unit } from "../../packages/compare-core/structure";
import { parseDoc } from "../../packages/contracts/index";
import { aviationProfile } from "../../profiles/aviation";
const [inputs, out] = process.argv.slice(2);
// Same definitions as packages/compare-core/index.ts rowIdentity().
const valueLike = (c: string) => /%|\d[.,]\d|\b(?:USD|EUR|GBP)\b|[$€£]|\d{1,2}\/\d{1,2}\/\d{2,4}/u.test(c);
const counter = (c: string) => { const m = c.match(/^\D{0,8}?(\d{1,4})\.?$/u); return m ? Number(m[1]) : null; };
const counting = (rs: Unit[]) => {
  const n = rs.map((r) => counter(r.rowCells![0])).filter((x): x is number => x !== null);
  return n.length >= 2 && n[0] <= 1 && n.every((x, i) => x === n[0] + i);
};
const scopes = (us: Unit[]) => {
  const m = new Map<string, Unit[]>();
  for (const u of us.filter((u) => u.rowCells)) m.set(u.path.section + "\u0000" + u.title, [...(m.get(u.path.section + "\u0000" + u.title) ?? []), u]);
  return m;
};
const owners = (rs: Unit[], numbered: boolean) => {
  const m = new Map<string, { row: Unit; x: number }[]>();
  for (const r of rs) {
    const raw = Array.from(r.rawText);
    let cursor = 0;
    let cells = r.rowCells!.map((c) => {
      while (cursor < raw.length && raw[cursor] !== Array.from(c)[0]) cursor++;
      const ref = r.refs[cursor];
      cursor += Array.from(c).length;
      return { c, x: ref ? ref.char.quad[0] : NaN };
    });
    if (numbered && counter(r.rowCells![0]) !== null) cells = cells.slice(1);
    cells.map((o) => ({ ...o, c: o.c.normalize("NFKC") })).filter((o) => o.c.length >= 2 && !valueLike(o.c))
      .forEach((o, k) => { const key = k + "\u0000" + o.c; m.set(key, [...(m.get(key) ?? []), { row: r, x: o.x }]); });
  }
  return m;
};
const report: unknown[] = [];
for (const engine of ["mupdf", "pdfjs"] as EngineName[]) {
  const { extractPdf } = await loadEngine(engine);
  for (const pair of ["aviation_2024_vs_2025", "bizav_2024_vs_2025"]) {
    const [l, r] = await Promise.all(["left", "right"].map(async (s) =>
      structure(parseDoc(await extractPdf(readFileSync(path.join(inputs, "testdata/renewal", pair, s + ".pdf")))), aviationProfile)));
    const L = scopes(l), R = scopes(r);
    let links = 0;
    const mismatches: unknown[] = [];
    for (const [scope, rows] of L) {
      const others = R.get(scope);
      if (!others) continue;
      const numbered = counting(rows) || counting(others), right = owners(others, numbered);
      for (const [key, as] of owners(rows, numbered)) {
        const bs = right.get(key);
        if (as.length !== 1 || bs?.length !== 1) continue;
        links++;
        if (!(Math.abs(as[0].x - bs[0].x) <= 3))
          mismatches.push({ scope: scope.split("\u0000")[1], key: key.replace("\u0000", "@"), leftX: as[0].x, rightX: bs[0].x, left: as[0].row.rawText, right: bs[0].row.rawText });
      }
    }
    report.push({ engine, pair, scopes: [...L].map(([k, v]) => ({ title: k.split("\u0000")[1], rows: v.length })), uniqueLinks: links, mismatches });
    console.log(JSON.stringify({ engine, pair, uniqueLinks: links, mismatches: mismatches.length }));
  }
}
writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
