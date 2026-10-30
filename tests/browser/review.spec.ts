import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
const origin =
  process.env.POLICY_ENGINE === "pdfjs"
    ? "http://127.0.0.1:4174/"
    : "http://127.0.0.1:4175/";
async function load(page: Page, caseId: string) {
  await page
    .getByLabel("基准 PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases", caseId, "before.pdf"),
    );
  await page
    .getByLabel("待审 PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases", caseId, "after.pdf"),
    );
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    /complete_for_scope|partial/,
  );
  await expect(page.getByAltText(/基准原文第/)).toBeVisible();
  await expect(page.getByAltText(/待审原文第/)).toBeVisible();
}
test("P1 real PDF amount, search, source quads and JSON export", async ({
  page,
}) => {
  await page.goto("/");
  await load(page, "R02_amount");
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card")).toContainText("USD 4,000,000");
  await expect(page.locator("polygon").first()).toBeVisible();
  await page.getByLabel("搜索原文").fill("Office");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page.locator(".hits button")).toHaveCount(4);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  expect((await download).suggestedFilename()).toBe("policy-comparison.json");
  await page.screenshot({
    path: `reports/browser-review-${process.env.POLICY_ENGINE ?? "mupdf"}.png`,
    fullPage: true,
  });
});
test("P1 identical, ligature and scan status", async ({ page }) => {
  await page.goto("/");
  await load(page, "R01_identical");
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "可提取文本中未发现差异",
  );
  await load(page, "R18_ligature");
  await expect(page.locator("polygon").first()).toBeVisible();
  await load(page, "R27_mixed_scan_page");
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "partial",
  );
  await expect(page.locator(".gaps")).toContainText("第 2 页");
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
  await page.goto("/");
  await page
    .getByLabel("基准 PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R02_amount/before.pdf"),
    );
  await page
    .getByLabel("待审 PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R02_amount/after.pdf"),
    );
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
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
  await page.goto('/');await load(page,'R09_header_limit');await page.getByRole('button',{name:'出现位置 2',exact:true}).click();await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);await expect(page.locator('polygon').first()).toBeVisible();
  await load(page,'R28_inline_scan');await page.locator('.gaps button').first().click();await expect(page.locator('[data-coverage="true"]').first()).toBeVisible();
});
test('twenty complete tasks replace previous resources without refreshing the tab',async({page})=>{
  test.setTimeout(60000);await page.goto('/');const counts=[];
  for(let i=0;i<20;i++){await load(page,i%2?'R18_ligature':'R02_amount');await expect(page.locator('.card')).toHaveCount(1);await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);counts.push(page.workers().length);}
  expect(new Set(counts).size).toBe(1);await page.getByRole('button',{name:'关闭任务',exact:true}).click();await expect.poll(()=>page.workers().length).toBe(0);
});
test('manual swap updates both file controls and comparison direction',async({page})=>{
  await page.goto('/');await load(page,'R02_amount');await page.getByRole('button',{name:'交换方向',exact:true}).click();expect(await page.getByLabel('基准 PDF',{exact:true}).evaluate((e:HTMLInputElement)=>e.files?.[0].name)).toBe('after.pdf');await page.getByRole('button',{name:'开始比较',exact:true}).click();await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(page.locator('.old')).toContainText('USD 4,000,000');await expect(page.locator('.new')).toContainText('USD 2,000,000');
});
