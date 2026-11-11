#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2).filter((x) => x !== "--");
if (args.includes("--help")) {
  console.log(
    "pnpm compare -- --left a.pdf --right b.pdf --out result.json\nExit: complete 0, partial 2, failed 3, cancelled 130. Passwords: POLICY_LEFT_PASSWORD / POLICY_RIGHT_PASSWORD environment variables (never logged).",
  );
  process.exit(0);
}
const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    fileURLToPath(new URL("./run.ts", import.meta.url)),
    ...args,
  ],
  { stdio: "inherit" },
);
process.on("SIGINT", () => {
  child.kill("SIGKILL");
  console.error("cancelled: PDF and comparison processes terminated");
  process.exit(130);
});
child.on("exit", (code) => {
  process.exitCode = code ?? 3;
});
child.on("error", () => {
  console.error("failed: Unable to start the local comparison process");
  process.exitCode = 3;
});
