import { defineConfig } from "@playwright/test";
const engine = process.env.POLICY_ENGINE ?? "mupdf";
const port = engine === "pdfjs" ? 4174 : 4175;
export default defineConfig({
  testDir: "tests/browser",
  outputDir: `test-results/${engine}`,
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.POLICY_BROWSER_CHANNEL === "bundled" ? undefined : "chrome",
    headless: true,
    viewport: { width: 1500, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm preview:${engine} --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
  reporter: [
    ["list"],
    ["json", { outputFile: `reports/browser-tests-${engine}.json` }],
  ],
});
