import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
const exec = promisify(execFile);
const requested=process.argv[2],engines=requested?[requested]:['pdfjs','mupdf'];
if(engines.some(e=>!['pdfjs','mupdf'].includes(e)))throw new Error('Unknown engine');
const output=requested?`reports/container-${requested}.json`:'reports/container.json';
let report: Record<string, unknown>;
try {
  await exec("docker", ["info", "--format", "{{.OSType}}"], {
    timeout: 15_000,
  });
} catch (e) {
  report = {
    subject: "linux_container_build_and_start",
    status: "BLOCKED",
    reason: "Local Docker daemon is not responding or not available",
    evidence: String(e),
    attempted: true,
    variants: Object.fromEntries(engines.map(engine=>[engine,'BLOCKED'])),
  };
  writeFileSync(
    output,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
  process.exit(1);
}
const variants:Record<string,unknown>[]=[];
for(const engine of engines){
let id = "";
try {
  const build = await exec(
    "docker",
    [
      "build",
      "--build-arg",
      `ENGINE=${engine}`,
      "-f",
      "deploy/Dockerfile",
      "-t",
      `policy-compare:${engine}`,
      ".",
    ],
    { timeout: 600_000, maxBuffer: 4 * 1024 * 1024 },
  );
  writeFileSync(`reports/container-build-${engine}.log`, build.stdout + build.stderr);
  id = (
    await exec("docker", [
      "run",
      "-d",
      "--rm",
      "--read-only",
      "--user",
      "12345:12345",
      "-p",
      "127.0.0.1:18080:8080",
      `policy-compare:${engine}`,
    ])
  ).stdout.trim();
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    try {
      healthy = (await fetch("http://127.0.0.1:18080/healthz")).ok;
      if (healthy) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!healthy) throw new Error("Health endpoint did not start");
  const image = (
    await exec("docker", [
      "image",
      "inspect",
      `policy-compare:${engine}`,
      "--format",
      "{{.Id}} {{.Architecture}} {{.Os}}",
    ])
  ).stdout.trim();
  report = {
    engine,
    subject: "linux_container_build_and_start",
    status: "PASS",
    image,
    readOnly: true,
    uid: 12345,
    port: 18080,
  };
} catch (e) {
  report = {
    engine,
    subject: "linux_container_build_and_start",
    status: "FAIL",
    error: String(e),
  };
} finally {
  if (id) await exec("docker", ["stop", id]);
}
variants.push(report);
}
report={subject:'linux_container_build_and_start',status:variants.every(x=>x.status==='PASS')?'PASS':'FAIL',variants};
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(report);
process.exitCode = report.status === "PASS" ? 0 : 1;
