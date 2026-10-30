// Probe for Codex PR #9 comment 6510906577: a repeated table heading `MSN | Operator | Value` in a PDF
// extracted column by column, so the raw text between two cited heading cells holds the column's
// data cells of other rows. Two pages before, three after; each page's rows differ.
// Usage: npx tsx column-major-probe.mts <scorer path>
import { compare } from "/home/user/policy-compare/packages/compare-core/index";
import { textDoc } from "/home/user/policy-compare/tests/helpers";
import type { DocInput } from "/home/user/policy-compare/packages/contracts/index";
const { grade } = await import(process.argv[2]);
// A page of table rows (cells at fixed columns). The characters are in column order (x first, then
// y), as a column-wise extraction gives, with an inferred newline between cells that sits on a
// separator line of its own; each visual row is one line. `rowMajor` keeps the reading order.
function tablePages(pages: string[][][], rowMajor = false): DocInput {
  const doc = textDoc(pages.map((_, p) => ({ text: "x", page: p, y: 800 })));
  const xs = [40, 200, 400];
  doc.pages.forEach((pg, p) => {
    const rows = pages[p];
    const cells = rows.flatMap((r, i) => r.map((text, k) => ({ text, x: xs[k], y: 60 + 30 * i, row: i })));
    if (!rowMajor) cells.sort((a, b) => a.x - b.x || a.y - b.y);
    const chars: typeof pg.chars = [], lines = rows.map((_, i) => ({ id: `r${p}.${i}`, charIds: [] as string[], direction: [1, 0] as [number, number], writingMode: "horizontal" as const, baseline: [40, 60 + 30 * i] as [number, number], baselineProvenance: "synthetic" as const }));
    const seps = { id: `s${p}`, charIds: [] as string[], direction: [1, 0] as [number, number], writingMode: "horizontal" as const, baseline: [40, 820] as [number, number], baselineProvenance: "synthetic" as const };
    const put = (text: string, x: number, y: number, provenance: string) => {
      const id = `c${p}.${chars.length}`;
      chars.push({ id, text, rawRange: [chars.length, chars.length + 1], origin: [x, y], quad: [x, y - 10, x + 6, y - 10, x, y + 2, x + 6, y + 2], size: 10, style: "synthetic", precision: "synthetic", provenance, sharedGeometry: null } as any);
      return id;
    };
    cells.forEach((c, k) => {
      if (k) seps.charIds.push(put("\n", 560, 820, "inferred"));
      Array.from(c.text).forEach((ch, i) => lines[c.row].charIds.push(put(ch, c.x + i * 6, c.y, "synthetic")));
    });
    for (const l of lines) l.charIds.sort((a, b) => chars.find((c) => c.id === a)!.origin[0] - chars.find((c) => c.id === b)!.origin[0]);
    pg.chars = chars;
    pg.lines = [...lines, seps] as any;
  });
  return doc;
}
const head = ["MSN", "Operator", "Value"];
const data = [[["123", "Alpha", "USD 100"], ["456", "Beta", "USD 200"]], [["789", "Gamma", "USD 300"]], [["321", "Delta", "USD 400"]]];
const docs = (rowMajor: boolean) => [tablePages([[head, ...data[0]], [head, ...data[1]]], rowMajor), tablePages([[head, ...data[0]], [head, ...data[1]], [head, ...data[2]]], rowMajor)];
const layoutOf = (d: DocInput) => ({ pages: d.pages.map((p) => ({ text_runs: p.lines.map((l) => {
  const chars = l.charIds.map((id) => p.chars.find((c) => c.id === id)!);
  return { run_id: chars.map((c) => c.text).join(""), text: chars.map((c) => c.text).join(""), direction: [1, 0],
    characters: chars.map((c) => ({ quad_tl_tr_br_bl: [[c.quad[0], c.quad[1]], [c.quad[2], c.quad[3]], [c.quad[6], c.quad[7]], [c.quad[4], c.quad[5]]] })) };
}) })) });
const raw = (d: DocInput, i: number) => d.pages[i].chars.map((c) => c.text).join("");
for (const rowMajor of [false, true]) {
const [left, right] = docs(rowMajor);
console.log(`## ${rowMajor ? "control: the same pages extracted row by row" : "column-wise extraction"}; left page 1 raw text: ${JSON.stringify(raw(left, 0))}`);
const r = compare(left, right);
console.log(`product ${r.coreVersion}, status ${r.status}`);
for (const d of r.differences as any[])
  console.log(`  card ${d.kind} ${JSON.stringify(d.oldText)} -> ${JSON.stringify(d.newText)} repeat ${JSON.stringify(d.repeat ?? null)} occurrences ${d.occurrences.length}`);
const expected = { case_id: "column-major", required_status: r.status, events: [], invariants: [], coverage_requirements: [], evidence_locations: {} } as any;
const s = grade(r as any, expected, { before: layoutOf(left), after: layoutOf(right) } as any, [left, right]);
console.log(`scorer: ${s.status}; faults ${JSON.stringify(s.faults)}; open ${JSON.stringify(s.notEvaluated.map((n: any) => n.reason))}`);
}
