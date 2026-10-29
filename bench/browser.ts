import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
const execAsync = promisify(execFile);
const smoke = process.argv.includes("--smoke"),
  runs = smoke ? 1 : 20;
const manifest = JSON.parse(
  readFileSync("bench/generated/manifest.json", "utf8"),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const records: Record<string, unknown>[] = [],
  groups: Record<string, unknown>[] = [];
const out = smoke
  ? "reports/browser-benchmark-smoke.json"
  : "reports/browser-benchmark.json";
const percentile = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? null;
};
const summary = (xs: number[]) => ({
  median: percentile(xs, 0.5),
  p95: percentile(xs, 0.95),
  max: xs.length ? Math.max(...xs) : null,
});
let browserVersion = "";
const environment = {
  platform: os.platform(),
  release: os.release(),
  cpu: os.cpus()[0].model,
  logicalCpus: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  power: "AC connected; power mode not independently instrumented",
  referenceDevice: false,
  node: process.version,
};
function save() {
  writeFileSync(
    out,
    JSON.stringify(
      {
        subject: "actual_browser_end_to_end",
        commit,
        build: "production Vite dist",
        environment,
        browserVersion,
        runsPerWorkload: runs,
        smoke,
        referenceDeviceStatus: "BLOCKED",
        referenceDeviceReason:
          "Available machine has 128 GiB; ordinary 16 GiB office device was not available.",
        memoryMethod:
          "Dedicated Chrome process tree: 100 ms RSS samples plus macOS footprint physical/kernel lifetime peaks for every live descendant at each completion. Reports idle baseline, total physical footprint, sum of process lifetime peaks, and incremental peak above the fixed pre-document baseline. Includes Worker, WASM, native and GPU allocations. Sum of per-process peaks is conservative because peaks may occur at different times; RSS may double-count shared pages. Memory budget uses the declared incremental document-attributable physical peak; total is also retained.",
        groups,
        attempts: records,
      },
      null,
      2,
    ) + "\n",
  );
}
mkdirSync("reports", { recursive: true });
for (const workload of manifest) {
  const server = await chromium.launchServer({
    channel: "chrome",
    headless: true,
    args: ["--disable-background-networking"],
  });
  const browser = await chromium.connect(server.wsEndpoint());
  browserVersion = browser.version();
  const context = await browser.newContext({
      viewport: { width: 1500, height: 1000 },
    }),
    page = await context.newPage();
  const rootPid = server.process().pid!;
  let peak = 0,
    busy = false;
  const rssSamples: { at: number; bytes: number }[] = [];
  let currentPids: number[] = [];
  async function sample() {
    if (busy) return;
    busy = true;
    try {
      const { stdout } = await execAsync("/bin/ps", [
        "-axo",
        "pid=,ppid=,rss=",
      ]);
      const rows = stdout
        .trim()
        .split("\n")
        .map((l) => l.trim().split(/\s+/).map(Number));
      const pids = new Set([rootPid]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const [pid, ppid] of rows)
          if (pids.has(ppid) && !pids.has(pid)) {
            pids.add(pid);
            changed = true;
          }
      }
      currentPids = [...pids];
      const total = rows
        .filter((r) => pids.has(r[0]))
        .reduce((n, r) => n + r[2] * 1024, 0);
      peak = Math.max(peak, total);
      rssSamples.push({ at: Date.now(), bytes: total });
    } finally {
      busy = false;
    }
  }
  async function footprint() {
    await sample();
    const file = `reports/memory-${workload.name}.json`;
    try {
      await execAsync(
        "/usr/bin/footprint",
        [
          ...currentPids.map(String),
          "--noCategories",
          "-f",
          "bytes",
          "-j",
          file,
        ],
        { timeout: 10000 },
      );
      const x = JSON.parse(readFileSync(file, "utf8"));
      return {
        status: x.errors?.length ? "BLOCKED" : "PASS",
        total: x["total footprint"],
        peakSum: x.processes.reduce(
          (n: number, p: { auxiliary: { phys_footprint_peak: number } }) =>
            n + p.auxiliary.phys_footprint_peak,
          0,
        ),
        processes: x.processes,
        errors: x.errors,
      };
    } catch (e) {
      return { status: "BLOCKED", total: 0, peakSum: 0, error: String(e) };
    }
  }
  const sampler = setInterval(() => {
    void sample();
  }, 100);
  const networkViolations: string[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith("blob:")) return;
    const url = new URL(req.url());
    if (req.method() !== "GET" || url.origin !== "http://127.0.0.1:4173")
      networkViolations.push(`${req.method()} ${url.origin}`);
  });
  const groupRecords: Record<string, unknown>[] = [];
  try {
    const coldStart = performance.now();
    await page.goto("http://127.0.0.1:4173");
    const baseline = await footprint();
    await page
      .getByLabel("基准 PDF", { exact: true })
      .setInputFiles(path.resolve(workload.paths[0]));
    await page
      .getByLabel("待审 PDF", { exact: true })
      .setInputFiles(path.resolve(workload.paths[1]));
    for (let i = 0; i <= runs; i++) {
      peak = 0;
      rssSamples.length = 0;
      const started = performance.now();
      let record: Record<string, unknown> = {
        workload: workload.name,
        run: i,
        kind: i === 0 ? "cold" : "hot",
      };
      try {
        await page
          .getByRole("button", { name: "开始比较", exact: true })
          .click();
        const interactionStart = performance.now();
        await page.getByLabel("按变化方式筛选").selectOption("Replaced");
        await page.getByLabel("按变化方式筛选").selectOption("all");
        record.interactionMs = (performance.now() - interactionStart) / 2;
        await page.waitForFunction(
          () => {
            const status = document
              .querySelector("[data-status]")
              ?.getAttribute("data-status");
            return (
              status === "failed" ||
              typeof window.__policyMetrics.total === "number"
            );
          },
          {},
          { timeout: 125_000 },
        );
        const metrics = await page.evaluate(() => window.__policyMetrics);
        const state = await page
          .locator("[data-status]")
          .getAttribute("data-status");
        const text = await page.locator(".cards").textContent();
        const validState =
          workload.size === "capacity"
            ? ["complete_for_scope", "partial"].includes(state ?? "")
            : state === "complete_for_scope";
        const correct =
          validState &&
          Boolean(text?.includes(workload.assertion.new_visible_value));
        // Template drift changes every numbered condition, independently known at generation.
        const expectedCards =
          workload.family === "template_change"
            ? workload.pages_per_document * 10 + 2
            : workload.family === "renewal"
              ? 2
              : 1;
        const count = await page.locator(".card").count();
        const full = state !== "complete_for_scope" || count === expectedCards;
        await sample();
        const physical = await footprint();
        record = {
          ...record,
          ...metrics,
          resultStatus: state,
          status: correct && full ? "PASS" : "FAIL",
          correctness: correct && full,
          differenceCards: count,
          expectedCards,
          sampledPeakRssBytes: peak,
          rssSamples: [...rssSamples],
          physicalMemory: physical,
          baselinePhysicalBytes: baseline.total,
          attributablePeakBytes: Math.max(0, physical.peakSum - baseline.total),
          elapsedAttemptMs: performance.now() - started,
          ...(i === 0
            ? { coldFromNavigationMs: performance.now() - coldStart }
            : {}),
        };
      } catch (e) {
        record = {
          ...record,
          status: "FAIL",
          error: String(e),
          sampledPeakRssBytes: peak,
          elapsedAttemptMs: performance.now() - started,
        };
      }
      groupRecords.push(record);
      records.push(record);
      save();
      console.log(
        workload.name,
        record.kind,
        i,
        record.status,
        "ms",
        record.total ?? record.elapsedAttemptMs,
        "MiB",
        Math.round(Number(record.sampledPeakRssBytes) / 1024 / 1024),
      );
      if (
        (await page.locator("[data-status]").getAttribute("data-status")) ===
        "running"
      )
        await page.getByRole("button", { name: "取消", exact: true }).click();
      // Each subsequent run reopens PDFs in new workers; no DocInput/CompareResult cache.
    }
    const hot = groupRecords.filter((r) => r.kind === "hot"),
      totals = hot
        .filter((r) => typeof r.total === "number")
        .map((r) => Number(r.total));
    const failures = hot.filter((r) => r.status !== "PASS").length;
    const timing = summary(totals),
      interactions = summary(hot.map((r) => Number(r.interactionMs)));
    const memoryPeak = Math.max(
      ...hot.map((r) => Number(r.attributablePeakBytes) || 0),
    );
    const memoryMeasured =
      baseline.status === "PASS" &&
      hot.every(
        (r) =>
          (r.physicalMemory as { status: string } | undefined)?.status ===
          "PASS",
      );
    const memoryStatus = !memoryMeasured
      ? "BLOCKED"
      : memoryPeak <= 1024 ** 3
        ? "PASS"
        : "FAIL";
    const pass =
      failures === 0 &&
      hot.length === runs &&
      (workload.budget_ms === null ||
        Number(timing.p95) <= workload.budget_ms) &&
      Number(interactions.p95) <= 100 &&
      memoryStatus === "PASS" &&
      networkViolations.length === 0;
    groups.push({
      name: workload.name,
      size: workload.size,
      attempts: hot.length,
      failures,
      timing,
      interactions,
      memoryPeak,
      memoryStatus,
      baselinePhysicalBytes: baseline.total,
      networkViolations,
      developmentDeviceStatus: pass ? "PASS" : "FAIL",
      referenceDeviceStatus: "BLOCKED",
      cold: groupRecords[0],
    });
  } finally {
    clearInterval(sampler);
    await browser.close();
    await server.close();
    save();
  }
}
console.log("Saved", out);
process.exitCode = groups.every((g) => g.developmentDeviceStatus === "PASS")
  ? 0
  : 1;
