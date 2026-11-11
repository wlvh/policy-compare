import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
const origin = process.env.POLICY_BASE_URL ? new URL(process.env.POLICY_BASE_URL).origin + '/' :
  process.env.POLICY_ENGINE === "pdfjs"
    ? "http://127.0.0.1:4174/"
    : "http://127.0.0.1:4175/";
async function load(page: Page, caseId: string) {
  await page
    .getByLabel("Baseline PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases", caseId, "before.pdf"),
    );
  await page
    .getByLabel("Revised PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases", caseId, "after.pdf"),
    );
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    /complete_for_scope|partial/,
  );
  await expect(page.locator('.document').nth(0).locator('[data-ready-page] img')).toBeVisible();
  await expect(page.locator('.document').nth(1).locator('[data-ready-page] img')).toBeVisible();
}
test("P1 real PDF amount, search, source quads and JSON export", async ({
  page,
}) => {
  await page.goto("./");
  await load(page, "R02_amount");
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card")).toContainText("USD 4,000,000");
  await expect(page.locator("polygon").first()).toBeVisible();
  await page.getByLabel("Search source text").fill("Office");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".hits button")).toHaveCount(4);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("policy-comparison.json");
  await page.screenshot({
    path: `${process.env.POLICY_REPORT_DIR || 'reports'}/browser-review-${process.env.POLICY_ENGINE ?? "mupdf"}.png`,
    fullPage: true,
  });
});
test("P1 identical, ligature and scan status", async ({ page }) => {
  await page.goto("./");
  await load(page, "R01_identical");
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "No differences found in extractable text",
  );
  await load(page, "R18_ligature");
  await expect(page.locator("polygon").first()).toBeVisible();
  await load(page, "R27_mixed_scan_page");
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "partial",
  );
  await expect(page.locator(".gaps")).toContainText("Page 2");
});
test("cancel stops workers, old results cannot replace next task; no document upload", async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on("request", (req) => {
    if (
      !req.url().startsWith("blob:" + origin) &&
      (req.method() !== "GET" || !req.url().startsWith(origin))
    )
      outgoing.push(req.url());
  });
  await page.goto("./");
  await page
    .getByLabel("Baseline PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R02_amount/before.pdf"),
    );
  await page
    .getByLabel("Revised PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R02_amount/after.pdf"),
    );
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "cancelled",
  );
  expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(
    0,
  );
  await load(page, "R01_identical");
  await expect(page.locator(".card")).toHaveCount(0);
  expect(outgoing).toEqual([]);
});
test('repeated occurrences and uncovered image regions are navigable',async({page})=>{
  await page.goto('./');await load(page,'R09_header_limit');await page.getByRole('button',{name:'Source location 2',exact:true}).click();await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);await expect(page.locator('polygon').first()).toBeVisible();
  await load(page,'R28_inline_scan');await page.locator('.gaps button').first().click();await expect(page.locator('[data-coverage="true"]').first()).toBeVisible();
});
test('twenty complete tasks replace previous resources without refreshing the tab',async({page})=>{
  test.setTimeout(60000);await page.goto('./');const counts=[];
  for(let i=0;i<20;i++){await load(page,i%2?'R18_ligature':'R02_amount');await expect(page.locator('.card')).toHaveCount(1);await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);counts.push(page.workers().length);}
  expect(new Set(counts).size).toBe(1);await page.getByRole('button',{name:'Close task',exact:true}).click();await expect.poll(()=>page.workers().length).toBe(0);
});
test('manual swap updates both file controls and comparison direction',async({page})=>{
  await page.goto('./');await load(page,'R02_amount');await page.getByRole('button',{name:'Swap files',exact:true}).click();expect(await page.getByLabel('Baseline PDF',{exact:true}).evaluate((e:HTMLInputElement)=>e.files?.[0].name)).toBe('after.pdf');await page.getByRole('button',{name:'Compare',exact:true}).click();await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(page.locator('.old')).toContainText('USD 4,000,000');await expect(page.locator('.new')).toContainText('USD 2,000,000');
});
