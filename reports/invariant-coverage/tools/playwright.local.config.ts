// Local-only: the preinstalled Chromium differs from the revision @playwright/test 1.64.1 expects.
import base from "../playwright.config";
export default {
  ...base,
  testDir: "../tests/browser",
  outputDir: "../" + base.outputDir,
  use: { ...base.use, launchOptions: { executablePath: "/opt/pw-browsers/chromium" } },
  webServer: { ...base.webServer, cwd: ".." },
  reporter: [["list"]],
};
