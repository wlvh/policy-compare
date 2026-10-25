import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const target = resolve("tmp/pdfjs-independent");
mkdirSync(target, { recursive: true });
for (const name of [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.pdfjs.json",
  "vite.config.ts",
  "apps",
  "packages",
  "profiles",
])
  cpSync(name, resolve(target, name), { recursive: true });
cpSync("engines/pdfjs", resolve(target, "engines/pdfjs"), {
  recursive: true,
  filter: (p) => !p.includes("node_modules"),
});
const log: string[] = [];
const run = (args: string[]) => {
  log.push(
    execFileSync("pnpm", args, {
      cwd: target,
      encoding: "utf8",
      timeout: 240_000,
    }),
  );
};
run([
  "install",
  "--frozen-lockfile",
  "--store-dir",
  resolve("tmp/pdfjs-only-store"),
]);
run([
  "--dir",
  "engines/pdfjs",
  "install",
  "--frozen-lockfile",
  "--store-dir",
  resolve("tmp/pdfjs-only-store"),
]);
run(["build:pdfjs"]);
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(dir + "/" + d.name) : [dir + "/" + d.name],
  );
const artifacts = walk(target + "/dist/pdfjs"),
  forbidden = artifacts.filter(
    (p) =>
      /mupdf/i.test(p) ||
      (/\.(js|mjs|ts|map)$/.test(p) &&
        /libmupdf|Artifex|mupdf-wasm/i.test(readFileSync(p, "utf8"))),
  );
const dependencyFiles = walk(target + "/node_modules/.pnpm").filter((p) =>
  p.endsWith("/package.json"),
);
const installedMupdf =
  dependencyFiles.some((p) => {
    try {
      return JSON.parse(readFileSync(p, "utf8")).name === "mupdf";
    } catch {
      return false;
    }
  }) || existsSync(target + "/engines/mupdf");
const report = {
  status: forbidden.length || installedMupdf ? "FAIL" : "PASS",
  subject: "clean_pdfjs_install_build_without_mupdf",
  root: target,
  forbidden,
  installedMupdf,
  artifactCount: artifacts.length,
  packageLockHasMupdf: /mupdf/i.test(
    readFileSync(target + "/pnpm-lock.yaml", "utf8"),
  ),
  artifacts: artifacts.map((p) => p.slice(target.length + 1)),
};
writeFileSync(
  "reports/pdfjs-independent-build.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync("reports/pdfjs-independent-build.log", log.join("\n"));
console.log({
  status: report.status,
  forbidden,
  installedMupdf,
  artifactCount: artifacts.length,
});
process.exitCode = report.status === "PASS" ? 0 : 1;
