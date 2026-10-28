// Browser check of fine highlighting and source navigation on the renewal
// pairs, in the built app (pnpm build:<engine>; pnpm preview:<engine>).
// For each selected card the highlight polygons drawn on each side must lie
// on the card's page, inside the card's changed source runs from the
// exported JSON (PDF.js refines engine runs to glyph ranges in the text
// layer; MuPDF draws native glyph quads). For aggregated page-furniture
// cards every occurrence button must bring both sides to that occurrence's
// pages and highlight it there.
// With FURNITURE_DIR (left.pdf, right.pdf, expected.json from generators/),
// it also checks cards whose repeated line varies inside one version: kind,
// category, the explanation shown on the card, the occurrence count, and that
// the occurrences of the changed pages and of a page that kept the old text
// open those pages with their highlight.
// usage: pnpm exec tsx reports/issue-2-validation/browser-check.ts INPUTS OUT_DIR
//   env: PDFJS_URL (default http://127.0.0.1:4174), MUPDF_URL (http://127.0.0.1:4175),
//        CHROMIUM_PATH to use a locally installed Chromium.
import { chromium, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const [inputs, out] = process.argv.slice(2).map((p) => path.resolve(p));
const urls = {
  pdfjs: process.env.PDFJS_URL ?? "http://127.0.0.1:4174",
  mupdf: process.env.MUPDF_URL ?? "http://127.0.0.1:4175",
};
type Loc = { side: string; pageIndex: number; quads: number[][]; text: string };
type Card = { id: string; oldText: string; newText: string; left: Loc[]; right: Loc[];
  textOps: { kind: string; left: Loc[]; right: Loc[] }[]; occurrences: { left: Loc[]; right: Loc[] }[];
  structurePath: { rowKey: string | null; section: string } | null; category: string; kind: string };
const checks: Record<string, (d: Card) => boolean> = {
  "aviation HPX share 12.5% -> 10.0%": (d) => d.oldText.includes("HPX 0624") && d.oldText.includes("12.5%") && d.newText.includes("10.0%"),
  "aviation MSN 15256 agreed value": (d) => d.oldText.includes("15256") && d.oldText.includes("16,900,000"),
  "aviation MSN 4551 lessee (wrapped type cell)": (d) => d.oldText.includes("4551") && d.oldText.includes("Kestrel Connect"),
  "aviation engine ESN 1949020 location": (d) => d.oldText.includes("1949020") && d.newText.includes("Singapore"),
  "bizav Dubai hangar operator": (d) => d.oldText.includes("Dubai (OMDW)") && d.newText.includes("Desert Falcon"),
  "bizav M-FNKB Selwyn endorsement (wrapped party cell)": (d) => d.oldText.includes("M-FNKB") && d.oldText.includes("Selwyn") && d.newText.includes("AVN67C"),
};
const furnitureChecks: Record<string, (d: Card) => boolean> = {
  "aviation header UMR": (d) => d.structurePath?.section === "page_furniture" && d.oldText.includes("B4417K240093"),
  "bizav Draft watermark": (d) => d.structurePath?.section === "page_furniture" && d.newText.trim() === "Draft",
  "bizav page numbers": (d) => d.structurePath?.section === "page_furniture" && /Page \d+ of \d+/.test(d.oldText),
};
// Inside a source box: ±2 pt across, and down the line ±3 pt or 15% of its
// height, since Node estimates a run's top and bottom from font metrics while
// the browser measures the text layer (a 70 pt watermark differs by ~8 pt).
const within = (b: number[], src: number[]) => {
  const tol = Math.max(3, 0.15 * (src[3] - src[1]));
  return b[0] >= src[0] - 2 && b[2] <= src[2] + 2 && b[1] >= src[1] - tol && b[3] <= src[3] + tol;
};
const box = (quads: number[][]) => {
  const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]]), ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
async function polygons(page: Page, side: number) {
  return page.locator(".document").nth(side).locator("polygon").evaluateAll((els) =>
    els.map((e) => e.getAttribute("points")!.trim().split(/\s+/).flatMap((p) => p.split(",").map(Number))));
}
async function readyPage(page: Page, side: number) {
  return Number(await page.locator(".document").nth(side).locator("[data-ready-page]").getAttribute("data-ready-page"));
}
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const records: any[] = [];
mkdirSync(out, { recursive: true });
try {
  for (const engine of ["pdfjs", "mupdf"] as const)
    for (const pair of ["aviation_2024_vs_2025", "bizav_2024_vs_2025"]) {
      const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
      const page = await context.newPage();
      await page.goto(urls[engine]);
      await expect(page.locator("main")).toHaveAttribute("data-engine-ready", "true", { timeout: 30000 });
      const dir = path.join(inputs, "testdata/renewal", pair);
      await page.getByLabel("基准 PDF", { exact: true }).setInputFiles(path.join(dir, "left.pdf"));
      await page.getByLabel("待审 PDF", { exact: true }).setInputFiles(path.join(dir, "right.pdf"));
      await page.getByRole("button", { name: "开始比较", exact: true }).click();
      await expect(page.locator("[data-status]")).toHaveAttribute("data-status", /complete_for_scope|partial/, { timeout: 120000 });
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
      const file = path.join(out, `${pair}-${engine}-browser.json`);
      await (await download).saveAs(file);
      const result = JSON.parse(readFileSync(file, "utf8")) as { coreVersion: string; status: string; differences: Card[] };
      const record: any = { engine, pair, coreVersion: result.coreVersion, status: result.status, cards: result.differences.length, highlights: [], navigation: [] };
      for (const [name, match] of Object.entries(checks)) {
        if (!name.startsWith(pair.split("_")[0])) continue;
        const hits = result.differences.filter(match);
        const entry: any = { name, cards: hits.map((d) => d.id) };
        record.highlights.push(entry);
        if (hits.length !== 1) { entry.status = "FAIL"; entry.reason = `expected one card, found ${hits.length}`; continue; }
        const d = hits[0];
        const changed = d.textOps.filter((o) => o.kind !== "equal");
        entry.rowKey = d.structurePath?.rowKey ?? null;
        entry.card = { kind: d.kind, category: d.category, oldText: d.oldText, newText: d.newText };
        await page.locator(".card").filter({ hasText: d.oldText.slice(0, 40) }).filter({ hasText: d.newText.slice(-25) }).first().click();
        entry.sides = [];
        for (const [index, side] of (["left", "right"] as const).entries()) {
          const runs = changed.flatMap((o) => o[side]);
          if (!runs.length) continue;
          const pageIndex = runs[0].pageIndex;
          await expect.poll(() => readyPage(page, index), { timeout: 30000 }).toBe(pageIndex);
          await expect.poll(async () => (await polygons(page, index)).length, { timeout: 15000 }).toBeGreaterThan(0);
          const drawn = (await polygons(page, index)).map((q) => box([q]));
          const runBox = box(runs.filter((r) => r.pageIndex === pageIndex).flatMap((r) => r.quads));
          const inside = drawn.every((b) => within(b, runBox));
          const drawnWidth = drawn.reduce((n, b) => n + b[2] - b[0], 0);
          entry.sides.push({ side, pageIndex, polygons: drawn.length, changedText: runs.map((r) => r.text).join("|"),
            sourceRunBox: runBox.map((v) => +v.toFixed(1)), drawnBoxes: drawn.map((b) => b.map((v) => +v.toFixed(1))),
            drawnWidthOverRunWidth: +(drawnWidth / (runBox[2] - runBox[0])).toFixed(3), insideSourceRuns: inside });
        }
        entry.status = entry.sides.length && entry.sides.every((s: any) => s.polygons > 0 && s.insideSourceRuns) && entry.rowKey ? "PASS" : "FAIL";
        await page.screenshot({ path: path.join(out, `${pair}-${engine}-${entry.cards[0]}.png`) });
      }
      for (const [name, match] of Object.entries(furnitureChecks)) {
        if (!name.startsWith(pair.split("_")[0])) continue;
        const hits = result.differences.filter(match);
        const entry: any = { name, cards: hits.map((d) => d.id), visited: [] };
        record.navigation.push(entry);
        if (hits.length !== 1) { entry.status = "FAIL"; entry.reason = `expected one card, found ${hits.length}`; continue; }
        const d = hits[0];
        entry.occurrences = d.occurrences.length;
        const card = page.locator(".card").filter({ has: page.locator(".occurrences") }).filter({ hasText: (d.newText || d.oldText).slice(0, 30) }).first();
        await card.click();
        const picks = [...new Set([0, Math.floor(d.occurrences.length / 2), d.occurrences.length - 1])];
        for (const k of picks) {
          await card.getByRole("button", { name: `出现位置 ${k + 1}`, exact: true }).click();
          const o = d.occurrences[k], visit: any = { occurrence: k + 1 };
          for (const [index, side] of (["left", "right"] as const).entries()) {
            const locs = o[side];
            if (!locs.length) continue;
            await expect.poll(() => readyPage(page, index), { timeout: 30000 }).toBe(locs[0].pageIndex);
            await expect.poll(async () => (await polygons(page, index)).length, { timeout: 15000 }).toBeGreaterThan(0);
            const drawn = (await polygons(page, index)).map((q) => box([q])), src = box(locs.flatMap((l) => l.quads));
            visit[side] = { pageIndex: locs[0].pageIndex, text: locs.map((l) => l.text).join(""), polygons: drawn.length,
              insideSource: drawn.every((b) => within(b, src)) };
          }
          entry.visited.push(visit);
        }
        entry.buttonLabels = await card.locator(".occurrences button").evaluateAll((els) => els.slice(0, 3).map((e) => e.textContent));
        entry.status = entry.visited.length === picks.length &&
          entry.visited.every((v: any) => ["left", "right"].every((s) => !v[s] || (v[s].polygons > 0 && v[s].insideSource))) ? "PASS" : "FAIL";
        await page.screenshot({ path: path.join(out, `${pair}-${engine}-${d.id}.png`) });
      }
      records.push(record);
      console.log(JSON.stringify({ engine, pair, highlights: record.highlights.map((h: any) => `${h.name}:${h.status}`), navigation: record.navigation.map((n: any) => `${n.name}:${n.status}`) }));
      await context.close();
    }
  if (process.env.FURNITURE_DIR)
    for (const engine of ["pdfjs", "mupdf"] as const) {
      const dir = path.resolve(process.env.FURNITURE_DIR);
      const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8"));
      const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
      const page = await context.newPage();
      await page.goto(urls[engine]);
      await expect(page.locator("main")).toHaveAttribute("data-engine-ready", "true", { timeout: 30000 });
      await page.getByLabel("基准 PDF", { exact: true }).setInputFiles(path.join(dir, "left.pdf"));
      await page.getByLabel("待审 PDF", { exact: true }).setInputFiles(path.join(dir, "right.pdf"));
      await page.getByRole("button", { name: "开始比较", exact: true }).click();
      await expect(page.locator("[data-status]")).toHaveAttribute("data-status", /complete_for_scope|partial/, { timeout: 120000 });
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
      const file = path.join(out, `furniture-${engine}-browser.json`);
      await (await download).saveAs(file);
      const result = JSON.parse(readFileSync(file, "utf8")) as { coreVersion: string; status: string; differences: Card[] };
      const record: any = { engine, pair: "furniture", coreVersion: result.coreVersion, status: result.status, cards: result.differences.length, furniture: [] };
      const pagesOf = (locs: Loc[]) => [...new Set(locs.map((l) => l.pageIndex + 1))].sort((a, b) => a - b);
      for (const want of expected.cards) {
        const hits = result.differences.filter((d) => d.oldText.includes(want.old) && d.newText.includes(want.new));
        const entry: any = { id: want.id, what: want.what, cards: hits.map((d) => d.id) };
        record.furniture.push(entry);
        if (hits.length !== 1) { entry.status = "FAIL"; entry.reason = `expected one card, found ${hits.length}`; continue; }
        const d = hits[0];
        const changedRight = d.occurrences.flatMap((o) => o.right).filter((l) => l.text.includes(want.new));
        const keptRight = d.occurrences.flatMap((o) => o.right).filter((l) => l.text.includes(want.old));
        const card = page.locator(".card").filter({ hasText: d.reviewReasons[0].slice(0, 60) }).first();
        await card.click();
        const shown = (await card.textContent()) ?? "";
        entry.kind = d.kind; entry.category = d.category; entry.reason = d.reviewReasons.join("");
        entry.occurrences = d.occurrences.length;
        entry.buttons = await card.locator(".occurrences button").count();
        entry.changedRightPages = pagesOf(changedRight);
        entry.keptOldRightPages = pagesOf(keptRight);
        entry.reasonShownOnCard = shown.includes(d.reviewReasons[0].slice(0, 80));
        entry.visited = [];
        // The first changed occurrence and every occurrence that kept the old text.
        const targets = d.occurrences.map((o, k) => ({ o, k })).filter(({ o }) =>
          o.right.some((l) => l.text.includes(want.new)) || o.right.some((l) => l.text.includes(want.old)) || o.left.length);
        const picks = [...new Set([targets.findIndex(({ o }) => o.right.some((l) => l.text.includes(want.new))),
          ...targets.map(({ o }, i) => (o.right.some((l) => l.text.includes(want.old)) ? i : -1)).filter((i) => i >= 0),
          targets.findIndex(({ o }) => o.left.length > 0)])].filter((i) => i >= 0).map((i) => targets[i]);
        for (const { o, k } of picks) {
          await card.getByRole("button", { name: `出现位置 ${k + 1}`, exact: true }).click();
          const visit: any = { occurrence: k + 1, label: (await card.getByRole("button", { name: `出现位置 ${k + 1}`, exact: true }).textContent())?.trim() };
          for (const [index, side] of (["left", "right"] as const).entries()) {
            const locs = o[side];
            if (!locs.length) continue;
            await expect.poll(() => readyPage(page, index), { timeout: 30000 }).toBe(locs[0].pageIndex);
            await expect.poll(async () => (await polygons(page, index)).length, { timeout: 15000 }).toBeGreaterThan(0);
            const drawn = (await polygons(page, index)).map((q) => box([q])), src = box(locs.flatMap((l) => l.quads));
            visit[side] = { page: locs[0].pageIndex + 1, text: locs.map((l) => l.text).join(""), polygons: drawn.length, insideSource: drawn.every((b) => within(b, src)) };
          }
          entry.visited.push(visit);
        }
        entry.status =
          d.kind === want.kind && d.category === want.category &&
          JSON.stringify(entry.changedRightPages) === JSON.stringify(want.rightPages) &&
          JSON.stringify(entry.keptOldRightPages) === JSON.stringify(want.keptOldOnRightPages ?? []) &&
          (!want.keptOldOnRightPages || entry.reason.includes(`待审版第 ${want.keptOldOnRightPages.join("、")} 页仍为基准版文字`)) &&
          entry.reasonShownOnCard && entry.buttons === entry.occurrences &&
          entry.visited.length > 0 && entry.visited.every((v: any) => ["left", "right"].every((s) => !v[s] || (v[s].polygons > 0 && v[s].insideSource)))
            ? "PASS" : "FAIL";
        await page.screenshot({ path: path.join(out, `furniture-${engine}-${want.id}.png`) });
      }
      records.push(record);
      console.log(JSON.stringify({ engine, pair: "furniture", furniture: record.furniture.map((f: any) => `${f.id}:${f.status}`) }));
      await context.close();
    }
} finally {
  await browser.close();
}
writeFileSync(path.join(out, "browser-check.json"), JSON.stringify({ browser: "chromium " + browser.version(), records }, null, 1) + "\n");
if (records.some((r) => [...(r.highlights ?? []), ...(r.navigation ?? []), ...(r.furniture ?? [])].some((x: any) => x.status !== "PASS"))) process.exitCode = 1;
