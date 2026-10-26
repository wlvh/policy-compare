import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {createHash} from 'node:crypto';
const requested = process.argv[2],
  engines = requested ? [requested] : ["pdfjs", "mupdf"];
if (engines.some((e) => !["pdfjs", "mupdf"].includes(e)))
  throw new Error("Unknown engine");
const sourceMatches=(revision:string)=>{
  const diff=spawnSync('git',['diff',revision,'--','apps','packages','engines','profiles','patches','deploy','vite.config.ts','bench'],{encoding:'utf8'});
  return diff.status===0&&!diff.stdout.trim();
};
const checks: {
  name: string;
  status: string;
  exitCode?: number | null;
  reason?: string;
}[] = [];
function run(name: string, bin: string, args: string[]) {
  const result = spawnSync(bin, args, { stdio: "inherit", timeout: 600000 });
  const status = result.status === 0 ? "PASS" : "FAIL";
  checks.push({
    name,
    status,
    exitCode: result.status,
    reason: result.error?.message,
  });
}
run("common-core-and-scorer", "pnpm", ["verify:core"]);
if (existsSync(".venv/bin/python"))
  run("fixture-construction-only", ".venv/bin/python", [
    "validation/fixture_checks.py",
  ]);
else
  checks.push({
    name: "fixture-construction-only",
    status: "BLOCKED",
    reason: "Create .venv and install validation/requirements.txt",
  });
for (const engine of engines) {
  if (
    !existsSync(
      `engines/${engine}/node_modules/${engine === "pdfjs" ? "pdfjs-dist" : "mupdf"}`,
    )
  ) {
    checks.push({
      name: engine + "-dependency",
      status: "BLOCKED",
      reason: "Install selected engine dependencies",
    });
    continue;
  }
  run(engine + "-build", "pnpm", ["build:" + engine]);
  run(engine + "-pdf-mechanisms", "pnpm", [
    "exec",
    "tsx",
    "scripts/pdf-check.ts",
    engine,
  ]);
  run(engine + "-32-rules", "pnpm", ["test:rules:" + engine]);
  run(engine + "-review-regressions", "pnpm", ["exec","tsx","scripts/review-check.ts",engine]);
  run(engine + "-browser", "pnpm", ["test:browser:" + engine]);
}
run("linux-containers", "pnpm", ["test:container",...(requested?[requested]:[])]);
const containerReport=requested?`reports/container-${requested}.json`:'reports/container.json';
if (existsSync(containerReport)) {
  const x = JSON.parse(readFileSync(containerReport, "utf8"));
  if (x.status === "BLOCKED")
    Object.assign(checks.at(-1)!, { status: "BLOCKED", reason: x.reason });
}
if(checks.at(-1)?.status==='BLOCKED'&&existsSync('reports/ci-review-fixes.json')){
  const ci=JSON.parse(readFileSync('reports/ci-review-fixes.json','utf8'));
  if(ci.status==='PASS'&&ci.treeEquality==='PASS'&&sourceMatches(ci.productRevision)&&engines.every(e=>ci.containerStatus[e]==='PASS'))
    Object.assign(checks.at(-1)!,{status:'PASS',reason:'Local Docker unavailable; actual Linux CI for the unchanged product passed: '+ci.runUrl});
}
if (existsSync("reports/engine-ab.json")) {
  const ab = JSON.parse(readFileSync("reports/engine-ab.json", "utf8"));
  for (const engine of engines) {
    const groups = ab.summary.filter((s: any) => s.engine === engine);
    const buildFiles=Object.entries(ab.builds?.[engine]??{});
    const bound=sourceMatches(ab.commit)&&buildFiles.length>0&&buildFiles.every(([file,hash])=>existsSync(file)&&createHash('sha256').update(readFileSync(file)).digest('hex')===hash);
    const complete=groups.length===9&&groups.every((g:any)=>g.attempts>=20)&&ab.attempts.length===360&&ab.cold.length===6;
    checks.push({
      name: engine + "-development-performance",
      status:
        !bound?'BLOCKED':!complete?'NOT_RUN':groups.some((s:any)=>s.developmentBudgetStatus==='FAIL')?'FAIL':groups.some((s:any)=>s.developmentBudgetStatus==='BLOCKED')?'BLOCKED':'PASS',
      reason:!bound?'Saved performance does not match current product sources/build hashes':!complete?'Formal balanced run is incomplete':undefined,
    });
  }
  checks.push({
    name: "reference-device-performance",
    status: ab.referenceDeviceStatus,
  });
} else checks.push({ name: "balanced-browser-ab", status: "NOT_RUN" });
const result = {
  subject: "mandatory_engineering_acceptance",
  status: checks.every((c) => c.status === "PASS")
    ? "PASS"
    : checks.some((c) => c.status === "FAIL")
      ? "FAIL"
      : "BLOCKED",
  businessPilot: "BLOCKED",
  checks,
};
writeFileSync(
  `reports/verify-${requested ?? "all"}.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(result);
process.exitCode = result.status === "PASS" ? 0 : 1;
