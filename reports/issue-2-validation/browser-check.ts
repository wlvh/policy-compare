// Browser check of fine highlighting and source navigation on the renewal
// pairs, in the built app (pnpm build:<engine>; pnpm preview:<engine>).
// Round 8 (result format 2): every card is listed by default, in the order of
// the exported result, which follows document position; no importance label
// is shown. A checked change is one card holding its record on both sides,
// or one Removed card with the old text and one Added card with the new text,
// each holding the record; each card's highlights are checked on its sides.
// Repeated-line cards also show their occurrence counts.
// For each selected card the highlight polygons drawn on each side must lie
// on the card's page, inside the card's changed source runs from the
// exported JSON (PDF.js refines engine runs to glyph ranges in the text
// layer; MuPDF draws native glyph quads). For aggregated page-furniture
// cards every occurrence button must bring both sides to that occurrence's
// pages and highlight it there.
// With FURNITURE_DIR (left.pdf, right.pdf, expected.json from generators/),
// it also checks cards whose repeated line varies inside one version: kind,
// the explanation shown on the card, the occurrence count, and that
// the occurrences of the changed pages and of a page that kept the old text
// open those pages with their highlight.
// With MARGIN_DIR (left.pdf, right.pdf, expected.json of the margin pair), it
// checks each expected card's kind and pages, that repeated lines
// keep their own horizontal place, and that the card (or its first and last
// occurrence) opens its pages with the highlight inside its sources.
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
  structurePath: { rowKey: string | null; section: string } | null; kind: string;
  facts: string[]; repeat: { left: number; right: number } | null; reviewReasons: string[] };
// Each change: the words its old side and its new side must hold, record included.
const all = (...words: string[]) => (t: string) => words.every((w) => t.includes(w));
const checks: Record<string, [(t: string) => boolean, (t: string) => boolean]> = {
  "aviation HPX share 12.5% -> 10.0%": [all("HPX 0624", "12.5%"), all("HPX 0624", "10.0%")],
  "aviation MSN 15256 agreed value": [all("15256", "16,900,000"), all("15256", "15,640,000")],
  "aviation MSN 4551 lessee (wrapped type cell)": [all("4551", "Kestrel Connect"), all("4551", "Coral Bay")],
  "aviation engine ESN 1949020 location": [all("1949020", "Tallinn"), all("1949020", "Singapore")],
  "bizav Dubai hangar operator": [all("Dubai (OMDW)", "Al Maktoum"), all("Dubai (OMDW)", "Desert Falcon")],
  "bizav M-FNKB Selwyn endorsement (wrapped party cell)": [all("M-FNKB", "Selwyn", "AVN67B"), all("M-FNKB", "Selwyn", "AVN67C")],
};
const furnitureChecks: Record<string, (d: Card) => boolean> = {
  "aviation header UMR": (d) => d.structurePath?.section === "page_furniture" && d.oldText.includes("B4417K240093"),
  "aviation repeated line, 20 -> 19 occurrences": (d) => d.structurePath?.section === "page_furniture" && d.oldText.trim() === "LONDON MARKET" && d.newText.trim() === "LONDON MARKET",
  "bizav Draft watermark": (d) => d.structurePath?.section === "page_furniture" && d.newText.trim() === "Draft",
  "bizav page numbers": (d) => d.structurePath?.section === "page_furniture" && /Page \d+ of \d+/.test(d.oldText),
};
// Where a card starts in the document: its first source, left side first.
const position = (d: Card) => {
  const l = d.left[0] ?? d.right[0];
  return l ? l.pageIndex * 1_000_000 + Math.min(l.quads[0][1], l.quads[0][3], l.quads[0][5], l.quads[0][7]) : -1;
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
      // The list: every card shown with no filter, in the exported order, which follows the document.
      const shown = await page.locator(".card").count();
      const olds = await page.locator(".card .old").allTextContents();
      const labels = await page.locator(".card .badge").allTextContents();
      const positions = result.differences.map(position);
      record.list = {
        filter: await page.getByLabel("按变化方式筛选").inputValue(),
        shownCards: shown,
        sameOrderAsResult: olds.every((t, i) => t === (result.differences[i].oldText || "（无）")),
        resultInPositionOrder: positions.every((p, i) => !i || positions[i - 1] <= p),
        importanceLabelsShown: ["重要变化", "需要复核", "期间顺延", "形式变化"].filter((w) => labels.some((l) => l.includes(w))),
        labels: [...new Set(labels)],
        statusText: (await page.locator("[data-status] strong").textContent())?.trim(),
      };
      record.list.status = record.list.filter === "all" && shown === result.differences.length && record.list.sameOrderAsResult &&
        record.list.resultInPositionOrder && !record.list.importanceLabelsShown.length ? "PASS" : "FAIL";
      for (const [name, [was, is]] of Object.entries(checks)) {
        if (!name.startsWith(pair.split("_")[0])) continue;
        const one = result.differences.filter((d) => was(d.oldText) && is(d.newText));
        const split = [result.differences.filter((d) => d.kind === "Removed" && was(d.oldText)),
          result.differences.filter((d) => d.kind === "Added" && is(d.newText))];
        const hits = one.length ? one : split.every((x) => x.length === 1) ? split.flat() : [];
        const entry: any = { name, cards: hits.map((d) => d.id), form: one.length ? "one card" : "removed + added", sides: [] };
        record.highlights.push(entry);
        if (one.length > 1 || !hits.length) { entry.status = "FAIL"; entry.reason = `found ${one.length} cards with both sides, ${split.map((x) => x.length).join(" + ")} removed + added`; continue; }
        entry.rowKeys = hits.map((d) => d.structurePath?.rowKey ?? null);
        entry.cardTexts = hits.map((d) => ({ kind: d.kind, oldText: d.oldText, newText: d.newText, method: (d as any).matchEvidence?.method }));
        for (const d of hits) {
          const changed = d.textOps.filter((o) => o.kind !== "equal");
          await page.locator(".card").filter({ has: page.locator(".old", { hasText: (d.oldText || "（无）").slice(0, 40) }) })
            .filter({ has: page.locator(".new", { hasText: (d.newText || "（无）").slice(-25) }) }).first().click();
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
            entry.sides.push({ card: d.id, side, pageIndex, polygons: drawn.length, changedText: runs.map((r) => r.text).join("|"),
              sourceRunBox: runBox.map((v) => +v.toFixed(1)), drawnBoxes: drawn.map((b) => b.map((v) => +v.toFixed(1))),
              drawnWidthOverRunWidth: +(drawnWidth / (runBox[2] - runBox[0])).toFixed(3), insideSourceRuns: inside });
          }
          await page.screenshot({ path: path.join(out, `${pair}-${engine}-${d.id}.png`) });
        }
        // One card must show both sides; a removed + added pair one side each.
        entry.status = entry.sides.length >= 2 && entry.sides.every((s: any) => s.polygons > 0 && s.insideSourceRuns) ? "PASS" : "FAIL";
      }
      for (const [name, match] of Object.entries(furnitureChecks)) {
        if (!name.startsWith(pair.split("_")[0])) continue;
        const hits = result.differences.filter(match);
        const entry: any = { name, cards: hits.map((d) => d.id), visited: [] };
        record.navigation.push(entry);
        if (hits.length !== 1) { entry.status = "FAIL"; entry.reason = `expected one card, found ${hits.length}`; continue; }
        const d = hits[0];
        entry.occurrences = d.occurrences.length;
        entry.repeat = d.repeat;
        const card = page.locator(".card").filter({ has: page.locator(".occurrences") })
          .filter({ hasText: (d.newText || d.oldText).slice(0, 30) }).filter({ hasText: d.reviewReasons[0] }).first();
        await card.click();
        entry.reasonShownOnCard = ((await card.textContent()) ?? "").includes(d.reviewReasons[0]);
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
        entry.status = entry.visited.length === picks.length && entry.reasonShownOnCard &&
          entry.visited.every((v: any) => ["left", "right"].every((s) => !v[s] || (v[s].polygons > 0 && v[s].insideSource))) ? "PASS" : "FAIL";
        await page.screenshot({ path: path.join(out, `${pair}-${engine}-${d.id}.png`) });
      }
      records.push(record);
      console.log(JSON.stringify({ engine, pair, list: record.list.status, highlights: record.highlights.map((h: any) => `${h.name}:${h.form}:${h.status}`), navigation: record.navigation.map((n: any) => `${n.name}:${n.status}`) }));
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
        const card = page.locator(".card").filter({ hasText: d.reviewReasons[0] }).first();
        await card.click();
        const shown = (await card.textContent()) ?? "";
        entry.kind = d.kind; entry.repeat = d.repeat; entry.reason = d.reviewReasons.join("");
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
          d.kind === want.kind &&
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
  if (process.env.MARGIN_DIR)
    for (const engine of ["pdfjs", "mupdf"] as const) {
      const dir = path.resolve(process.env.MARGIN_DIR);
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
      const file = path.join(out, `margin-${engine}-browser.json`);
      await (await download).saveAs(file);
      const result = JSON.parse(readFileSync(file, "utf8")) as { coreVersion: string; status: string; differences: Card[] };
      const record: any = { engine, pair: "margin", coreVersion: result.coreVersion, status: result.status, cards: result.differences.length, margin: [] };
      const pagesOf = (locs: Loc[]) => [...new Set(locs.map((l) => l.pageIndex + 1))].sort((a, b) => a - b);
      const exact = (t: string) => new RegExp("^\\s*" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$");
      for (const want of expected.cards) {
        const hits = result.differences.filter((d) => d.kind === want.kind &&
          (want.old === undefined || d.oldText.trim() === want.old) && (want.new === undefined || d.newText.trim() === want.new));
        const entry: any = { id: want.id, what: want.what, cards: hits.map((d) => d.id), visited: [] };
        record.margin.push(entry);
        if (hits.length !== 1) { entry.status = "FAIL"; entry.reason = `expected one card, found ${hits.length}`; continue; }
        const d = hits[0];
        const all = d.occurrences.length ? d.occurrences.flatMap((o) => [...o.left, ...o.right]) : [...d.left, ...d.right];
        entry.kind = d.kind; entry.facts = d.facts;
        entry.leftPages = pagesOf(d.occurrences.length ? d.occurrences.flatMap((o) => o.left) : d.left);
        entry.rightPages = pagesOf(d.occurrences.length ? d.occurrences.flatMap((o) => o.right) : d.right);
        if (want.x !== undefined) entry.sourceX = [...new Set(all.map((l) => Math.round(l.quads[0][0])))];
        const card = page.locator(".card")
          .filter({ has: page.locator(".old", { hasText: exact(d.oldText || "（无）") }) })
          .filter({ has: page.locator(".new", { hasText: exact(d.newText || "（无）") }) }).first();
        await card.click();
        // A plain card opens its changed text; a repeated line its first and last occurrence.
        const ops = d.textOps.filter((o) => o.kind !== "equal");
        const visits = d.occurrences.length
          ? [...new Set([0, d.occurrences.length - 1])].map((k) => ({ k, locs: d.occurrences[k] }))
          : [{ k: -1, locs: { left: ops.flatMap((o) => o.left), right: ops.flatMap((o) => o.right) } }];
        for (const { k, locs } of visits) {
          if (k >= 0) await card.getByRole("button", { name: `出现位置 ${k + 1}`, exact: true }).click();
          const visit: any = { occurrence: k + 1 || null };
          entry.visited.push(visit);
          try {
            for (const [index, side] of (["left", "right"] as const).entries()) {
              // An occurrence shows only its own sides; a plain card falls back
              // to its sources when its changed text is on one side only.
              const here = k >= 0 || locs[side].length ? locs[side] : side === "left" ? d.left : d.right;
              if (!here.length) continue;
              await expect.poll(() => readyPage(page, index), { timeout: 30000 }).toBe(here[0].pageIndex);
              await expect.poll(async () => (await polygons(page, index)).length, { timeout: 15000 }).toBeGreaterThan(0);
              const drawn = (await polygons(page, index)).map((q) => box([q])),
                src = box(here.filter((l) => l.pageIndex === here[0].pageIndex).flatMap((l) => l.quads));
              visit[side] = { page: here[0].pageIndex + 1, text: here.map((l) => l.text).join(""), polygons: drawn.length, insideSource: drawn.every((b) => within(b, src)) };
            }
          } catch (e) {
            visit.error = String(e).split("\n")[0];
          }
        }
        entry.status =
          d.kind === want.kind &&
          JSON.stringify(entry.leftPages) === JSON.stringify(want.left) &&
          JSON.stringify(entry.rightPages) === JSON.stringify(want.right) &&
          (want.x === undefined || all.every((l) => Math.abs(l.quads[0][0] - want.x) < 3)) &&
          entry.visited.length > 0 && entry.visited.every((v: any) => !v.error && (v.left || v.right) && ["left", "right"].every((s) => !v[s] || (v[s].polygons > 0 && v[s].insideSource)))
            ? "PASS" : "FAIL";
        await page.screenshot({ path: path.join(out, `margin-${engine}-${want.id}.png`) });
      }
      records.push(record);
      console.log(JSON.stringify({ engine, pair: "margin", margin: record.margin.map((f: any) => `${f.id}:${f.status}`) }));
      await context.close();
    }
} finally {
  await browser.close();
}
writeFileSync(path.join(out, "browser-check.json"), JSON.stringify({ browser: "chromium " + browser.version(), records }, null, 1) + "\n");
if (records.some((r) => [...(r.list ? [r.list] : []), ...(r.highlights ?? []), ...(r.navigation ?? []), ...(r.furniture ?? []), ...(r.margin ?? [])].some((x: any) => x.status !== "PASS"))) process.exitCode = 1;
