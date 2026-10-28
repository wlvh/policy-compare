// Prints left/right HTML to PDF by two independent routes:
//   chromium:    Chromium "print to PDF" with a repeated header (UMR) and a
//                "Page n of N" footer, i.e. page furniture from the browser;
//   libreoffice: LibreOffice Writer HTML import and PDF export.
// Also prints furniture-{left,right}.html and margin-{left,right}.html, when
// present, to OUT_DIR/furniture and OUT_DIR/margin.
// usage: pnpm exec tsx reports/issue-2-validation/generators/print.ts HTML_DIR OUT_DIR
// Set CHROMIUM_PATH to use a locally installed Chromium instead of Playwright's.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import path from "node:path";
const [htmlDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const versions: Record<string, string> = { chromium: browser.version() };
for (const [side, umr] of [
  ["left", "B4417K240093"],
  ["right", "B4417K250093"],
]) {
  const page = await browser.newPage();
  await page.goto("file://" + path.join(htmlDir, side + ".html"));
  mkdirSync(path.join(outDir, "chromium"), { recursive: true });
  await page.pdf({
    path: path.join(outDir, "chromium", side + ".pdf"),
    format: "A4",
    displayHeaderFooter: true,
    margin: { top: "22mm", bottom: "20mm", left: "16mm", right: "16mm" },
    headerTemplate: `<div style="font-size:8pt;width:100%;padding:0 16mm">UMR: ${umr}</div>`,
    footerTemplate:
      '<div style="font-size:8pt;width:100%;text-align:right;padding:0 16mm">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });
  await page.close();
}
// Repeated margin lines that vary inside one version, and margin lines of the
// third review of PR #9, Chromium print only.
for (const pair of ["furniture", "margin"]) {
  if (!existsSync(path.join(htmlDir, `${pair}-left.html`))) continue;
  mkdirSync(path.join(outDir, pair), { recursive: true });
  for (const side of ["left", "right"]) {
    const page = await browser.newPage();
    await page.goto("file://" + path.join(htmlDir, `${pair}-${side}.html`));
    await page.pdf({ path: path.join(outDir, pair, side + ".pdf"), format: "A4", margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    await page.close();
  }
  copyFileSync(path.join(htmlDir, `${pair}-expected.json`), path.join(outDir, pair, "expected.json"));
}
await browser.close();
// LibreOffice writes <name>.pdf next to --outdir; convert from a private
// profile so no user settings leak into the output.
const profile = mkdtempSync(path.join(outDir, ".lo-profile-"));
mkdirSync(path.join(outDir, "libreoffice"), { recursive: true });
for (const side of ["left", "right"])
  execFileSync("soffice", [
    `-env:UserInstallation=file://${profile}`,
    "--headless",
    "--convert-to",
    "pdf:writer_web_pdf_Export",
    "--outdir",
    path.join(outDir, "libreoffice"),
    path.join(htmlDir, side + ".html"),
  ]);
versions.libreoffice = execFileSync("soffice", ["--version"], { encoding: "utf8" }).trim();
execFileSync("rm", ["-rf", profile]);
copyFileSync(path.join(htmlDir, "expected.json"), path.join(outDir, "expected.json"));
console.log(JSON.stringify({ versions, files: readdirSync(outDir, { recursive: true }) }, null, 1));
