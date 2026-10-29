import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import {
  digest,
  hashBytes,
  type CompareResult,
} from "../packages/contracts/index";
import { aviationProfile } from "../profiles/aviation";
const exec = promisify(execFile),
  smoke = process.argv.includes("--smoke"),
  runs = smoke ? 1 : 20,
  coldRuns = smoke ? 1 : 3;
const engines = ["pdfjs", "mupdf"] as const;
type Engine = (typeof engines)[number];
const urls = { pdfjs: "http://127.0.0.1:8081", mupdf: "http://127.0.0.1:8082" };
const manifest = JSON.parse(
  readFileSync("bench/generated/manifest.json", "utf8"),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? files(dir + "/" + x.name) : [dir + "/" + x.name],
  );
const builds = Object.fromEntries(
  engines.map((e) => [
    e,
    Object.fromEntries(
      files("dist/" + e)
        .sort()
        .map((p) => [p, hashBytes(readFileSync(p))]),
    ),
  ]),
);
const environment = {
  cpu: os.cpus()[0].model,
  logicalCpu: os.cpus().length,
  memoryBytes: os.totalmem(),
  os: os.platform(),
  osRelease: os.release(),
  viewport: [1500, 1000],
  dpr: 1,
  headless: true,
  power: "AC attached; no system cache flush",
  referenceDevice: false,
};
const attempts: any[] = [],
  cold: any[] = [],
  order: any[] = [];
let browserVersion = "";
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(p * values.length) - 1)
  ] ?? null;
const stats = (values: number[]) => ({
  n: values.length,
  median: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  max: values.length ? Math.max(...values) : null,
});
const output = smoke
  ? "reports/engine-ab-smoke.json"
  : "reports/engine-ab.json";
mkdirSync("reports", { recursive: true });
function summary() {
  return manifest.flatMap((w: any) =>
    engines.map((engine) => {
      const all = attempts.filter(
          (a) => a.workload === w.name && a.engine === engine,
        ),
        ok = all.filter((a) => a.status === "PASS"),
        timing = stats(ok.map((a) => a.metrics.total));
      const memory = all.every((a) => a.memory?.status === "PASS")
          ? "PASS"
          : "BLOCKED",
        peak = Math.max(
          0,
          ...all.map((a) => a.memory?.incrementalPeakBytes ?? 0),
        );
      return {
        workload: w.name,
        engine,
        size: w.size,
        successes: ok.length,
        attempts: all.length,
        failures: all.length - ok.length,
        successfulTiming: timing,
        memoryMeasurement: memory,
        timingBudgetStatus:ok.length===all.length&&all.length===runs&&(w.budget_ms===null||Number(timing.p95)<=w.budget_ms)?'PASS':all.length!==runs?'NOT_RUN':'FAIL',
        peakIncrementalBytes: peak,
        interaction: stats(ok.flatMap((a) => a.interactionMs)),
        developmentBudgetStatus:
          all.length !== runs
            ? "NOT_RUN"
            : ok.length !== all.length
              ? "FAIL"
              : w.budget_ms !== null && Number(timing.p95) > w.budget_ms
                ? "FAIL"
                : memory !== "PASS"
                  ? "BLOCKED"
                  : w.size === "standard" && peak > 1024 ** 3
                    ? "FAIL"
                    : stats(ok.flatMap((a) => a.interactionMs)).p95! > 100
                      ? "FAIL"
                    : "BLOCKED",
        referenceDeviceStatus: "BLOCKED",
        fullMemoryAcceptance:'BLOCKED',
        memoryCoverageLimit:'Live descendant kernel peaks and sampled RSS cannot reconstruct the peak of a short-lived helper that exits before collection; a real exited-helper case was observed in the preserved first batch. Values are measurements, not a full-memory pass.',
      };
    }),
  );
}
function save() {
  writeFileSync(
    output,
    JSON.stringify(
      {
        subject: "balanced_two_complete_browser_paths",
        commit,
        builds,
        profile: aviationProfile,
        configDigest: digest(aviationProfile),
        environment,
        browserVersion,
        runsPerWorkload: runs,
        smoke,
        runType:smoke?'development_precheck':'formal',
        coldRuns,
        quantile: "nearest-rank; n=20 uses sorted item 19 for p95",
        hotDefinition:
          "New dedicated browser for each attempt; navigate and initialize selected engine before timer; then reread, open, extract, compare and locate both PDFs; no document/result reuse. One engine active at a time.",
        memoryMethod:
          "macOS footprint: fixed about:blank baseline before app/engine; sum of per-process lifetime physical peaks at completion minus baseline, including app/worker/WASM/native/GPU. Also sampled process-tree RSS. Export is performed only after memory capture. Per-process peaks can occur at different times, so their sum is conservative.",
        referenceDeviceStatus: "BLOCKED",
        fullMemoryAcceptance:'BLOCKED',
        memoryCoverageLimit:'Short-lived helpers can exit before physical peak collection; full-memory acceptance is not claimed.',
        order,
        cold,
        summary: summary(),
        attempts,
      },
      null,
      2,
    ) + "\n",
  );
}
async function execute(engine: Engine, w: any | null, iteration: number) {
  const server = await chromium.launchServer({
    channel: "chrome",
    headless: true,
    args: ["--disable-background-networking"],
  });
  const browser = await chromium.connect(server.wsEndpoint());
  browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const root = server.process().pid!;
  const pids = async () => {
    const { stdout } = await exec("/bin/ps", ["-axo", "pid=,ppid=,rss="]);
    const rows = stdout
      .trim()
      .split("\n")
      .map((l) => l.trim().split(/\s+/).map(Number));
    const ids = new Set([root]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [pid, parent] of rows)
        if (ids.has(parent) && !ids.has(pid)) {
          ids.add(pid);
          changed = true;
        }
    }
    return {
      ids: [...ids],
      rss: rows
        .filter((r) => ids.has(r[0]))
        .reduce((n, r) => n + r[2] * 1024, 0),
    };
  };
  const footprint = async () => {
    const { ids } = await pids();
    const file = `tmp/footprint-${root}.json`;
    mkdirSync("tmp", { recursive: true });
    try {
      await exec(
        "/usr/bin/footprint",
        [...ids.map(String), "--noCategories", "-f", "bytes", "-j", file],
        { timeout: 10000 },
      );
      const x = JSON.parse(readFileSync(file, "utf8"));
      return {
        status: x.errors?.length ? "BLOCKED" : "PASS",
        current: x["total footprint"],
        peak: x.processes.reduce(
          (n: number, p: any) => n + p.auxiliary.phys_footprint_peak,
          0,
        ),
        processes: x.processes,
        errors: x.errors,
      };
    } catch (e) {
      return { status: "BLOCKED", current: 0, peak: 0, error: String(e) };
    }
  };
  const baseline = await footprint();
  const requests: any[] = [],
    violations: string[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith("blob:")) return;
    if (
      req.method() !== "GET" ||
      !req.url().startsWith(urls[engine] + "/") ||
      (engine === "pdfjs" && /mupdf/i.test(req.url()))
    )
      violations.push(req.url());
  });
  page.on("requestfinished", (req) => {
    void req
      .sizes()
      .then((s) => requests.push({ url: new URL(req.url()).pathname, ...s }))
      .catch(() => {});
  });
  let interval: ReturnType<typeof setInterval> | undefined;
  const rss: { elapsed: number; bytes: number }[] = [];
  let sampling = false;
  const base: any = {
    engine,
    workload: w?.name ?? "cold-start",
    iteration,
    commit,
    pdfHashes: w?.sha256,
    engineVersion: engine === "pdfjs" ? "6.4.299" : "1.28.1+scalar-fix.1",
    displayScale: 1.35,
    visiblePages: 2,
  };
  try {
    const navStart = performance.now();
    await page.goto(urls[engine]);
    await page.waitForSelector('main[data-engine-ready="true"]', {
      timeout: 20000,
    });
    const initializationMs = performance.now() - navStart;
    if (!w) {
      cold.push({ ...base, status: "PASS", initializationMs, requests });
      save();
      return;
    }
    await page
      .getByLabel("基准 PDF", { exact: true })
      .setInputFiles(path.resolve(w.paths[0]));
    await page
      .getByLabel("待审 PDF", { exact: true })
      .setInputFiles(path.resolve(w.paths[1]));
    const start = performance.now();
    interval = setInterval(() => {
      if (sampling) return;
      sampling = true;
      void pids()
        .then((x) =>
          rss.push({ elapsed: performance.now() - start, bytes: x.rss }),
        )
        .finally(() => {
          sampling = false;
        });
    }, 100);
    await page.getByRole("button", { name: "开始比较", exact: true }).click();
    const interactionMs: number[] = [];
    for (const option of ["Replaced", "all"]) {
      const t = performance.now();
      await page.getByLabel("按变化方式筛选").selectOption(option);
      interactionMs.push(performance.now() - t);
    }
    await page.waitForFunction(
      () =>
        document.querySelector("[data-status]")?.getAttribute("data-status") ===
          "failed" || typeof window.__policyMetrics.total === "number",
      {},
      { timeout: 125000 },
    );
    const metrics = await page.evaluate(() => window.__policyMetrics);
    const taskStatus = await page
      .locator("[data-status]")
      .getAttribute("data-status");
    const ready =
      (await page.locator('[data-ready-page="0"]').count()) === 2 &&
      (await page.locator("polygon").count()) > 0;
    const geometry=await page.locator('.document').evaluateAll((documents)=>documents.map(doc=>[...doc.querySelectorAll('polygon')].map(poly=>poly.getAttribute('points')!.split(/[ ,]/).map(Number))));
    const regions=w.assertion.first_location.regions as number[][];
    const located=ready&&geometry.every((polygons,side)=>polygons.length>0&&polygons.every(numbers=>{const box=[Math.min(numbers[0],numbers[2],numbers[4],numbers[6]),Math.min(numbers[1],numbers[3],numbers[5],numbers[7]),Math.max(numbers[0],numbers[2],numbers[4],numbers[6]),Math.max(numbers[1],numbers[3],numbers[5],numbers[7])],region=regions[side];const overlap=Math.max(0,Math.min(box[2],region[2])-Math.max(box[0],region[0]))*Math.max(0,Math.min(box[3],region[3])-Math.max(box[1],region[1]));return overlap/Math.max(1,(box[2]-box[0])*(box[3]-box[1]))>.35;}));
    const physical = await footprint();
    clearInterval(interval);
    interval = undefined;
    let result: CompareResult | undefined;
    if (taskStatus !== "failed") {
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 JSON" }).click();
      const download=await pending,downloadPath=`tmp/result-${root}.json`;await download.saveAs(downloadPath);
      result = JSON.parse(
        readFileSync(downloadPath, "utf8"),
      );
    }
    let knownEvents = 0;
    const amount = result?.differences.some(
      (d) =>
        d.defaultVisible &&
        d.newText.includes("9,876,543") &&
        d.left.length &&
        d.right.length,
    );
    if (amount) knownEvents++;
    if (w.family === "renewal" || w.family === "template_change") {
      if (
        result?.differences.some(
          (d) =>
            d.defaultVisible &&
            d.oldText.includes("01 April 2024") &&
            d.newText.includes("01 April 2025"),
        )
      )
        knownEvents++;
    }
    if (w.family === "template_change")
      for (let i = 0; i < w.pages_per_document * 10; i++) {
        const id = String(i).padStart(5, "0");
        if (
          result?.differences.some(
            (d) =>
              d.defaultVisible &&
              d.oldText.includes("The operator shall document") &&
              d.newText.includes("The insured must record") &&
              d.oldText.includes("asset " + id) &&
              d.newText.includes("asset " + id),
          )
        )
          knownEvents++;
      }
    const expectedEvents =
      w.family === "template_change"
        ? w.pages_per_document * 10 + 2
        : w.family === "renewal"
          ? 2
          : 1;
    const allowedPartial =
      w.size === "capacity" &&
      taskStatus === "partial" &&
      Boolean(result?.unresolved.length)&&result!.unresolved.every(u=>['budget','word_diff_budget'].includes(u.reason)&&u.left.length+u.right.length>0) &&
      amount;
    const correct = Boolean(
      result && metrics.cooperativeCancellation===true &&
      ((taskStatus === "complete_for_scope" &&
        knownEvents === expectedEvents) ||
        allowedPartial) &&
      located &&
      result.documentHashes.every((hash, i) => hash === w.sha256[i]) &&
      violations.length === 0,
    );
    attempts.push({
      ...base,
      status: correct ? "PASS" : "FAIL",
      taskStatus,
      knownEvents,
      expectedEvents,
      locationReady: located,
      locationGeometry:geometry,
      metrics,
      coreVersion:result?.coreVersion,
      extractors:result?.extractors,
      configDigest:result?.configDigest,
      stats: result?.stats,
      interactionMs,
      initializationOutsideHotTimerMs: initializationMs,
      memory: {
        status:
          baseline.status === "PASS" && physical.status === "PASS"
            ? "PASS"
            : "BLOCKED",
        baselineBytes: baseline.current,
        totalPhysicalBytes: physical.current,
        sumProcessPeaksBytes: physical.peak,
        incrementalPeakBytes: Math.max(0, physical.peak - baseline.current),
        processes: physical.processes,
        collector:physical,
        baselineCollector:baseline,
        rss,
      },
      requests,
      networkViolations: violations,
    });
    console.log(
      engine,
      w.name,
      iteration,
      correct ? "PASS" : "FAIL",
      metrics.total,
      Math.round((physical.peak - baseline.current) / 2 ** 20) + " MiB",
    );
  } catch (e) {
    (w ? attempts : cold).push({
      ...base,
      status: "FAIL",
      error: String(e),
      rss,
      networkViolations: violations,
    });
    console.log(engine, w?.name ?? "cold", iteration, "FAIL", String(e));
  } finally {
    if (interval) clearInterval(interval);
    await browser.close();
    await server.close();
    save();
  }
}
for (let i = 0; i < coldRuns; i++)
  for (const engine of i % 2 ? [...engines].reverse() : engines)
    await execute(engine, null, i + 1);
for (const w of manifest)
  for (let i = 0; i < runs; i++)
    for (const engine of i % 2 ? [...engines].reverse() : engines) {
      order.push({ workload: w.name, iteration: i + 1, engine });
      await execute(engine as Engine, w, i + 1);
    }
save();
process.exitCode = summary().every(
  (s: any) => s.developmentBudgetStatus === "PASS",
)
  ? 0
  : 1;
