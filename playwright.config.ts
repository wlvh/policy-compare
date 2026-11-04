import { defineConfig } from "@playwright/test";
import { mkdirSync } from 'node:fs';
const engine = process.env.POLICY_ENGINE ?? "mupdf";
const port = engine === "pdfjs" ? 4174 : 4175;
const external = process.env.POLICY_BASE_URL;
const reportDir = process.env.POLICY_REPORT_DIR || 'reports';
mkdirSync(`${reportDir}/failures`,{recursive:true});
if (external) {
  const target = new URL(external);
  if (!['http:','https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || !target.pathname.endsWith('/')) throw new Error('POLICY_BASE_URL must be an HTTP(S) URL ending in /, without credentials, query or fragment');
  if (!process.env.POLICY_RELEASE_ID || !process.env.POLICY_MANIFEST_SHA256) throw new Error('External verification requires POLICY_RELEASE_ID and POLICY_MANIFEST_SHA256');
}
export default defineConfig({
  globalSetup: external ? './scripts/deployment-preflight.ts' : undefined,
  testDir: "tests/browser",
  outputDir: process.env.POLICY_REPORT_DIR ? `${reportDir}/test-results` : `test-results/${engine}`,
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: external || `http://127.0.0.1:${port}/`,
    channel: process.env.POLICY_BROWSER_CHANNEL === "bundled" ? undefined : "chrome",
    headless: true,
    viewport: { width: 1500, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: external ? undefined : {
    command: `pnpm preview:${engine} --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  reporter: [
    ["list"],
    ["json", { outputFile: `${reportDir}/browser-tests-${engine}.json` }],
  ],
});
