import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
test("twenty cancellation cycles leave no workers and allow a complete subsequent result", async ({
  page,
}) => {
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
  const timings = [];
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "开始比较", exact: true }).click();
    const start = performance.now();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    timings.push(performance.now() - start);
    await expect(page.locator("[data-status]")).toHaveAttribute(
      "data-status",
      "cancelled",
    );
  }
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await expect(page.locator(".card")).toContainText("USD 4,000,000");
  writeFileSync(
    `reports/cancellation-${process.env.POLICY_ENGINE ?? "mupdf"}.json`,
    JSON.stringify(
      {
        status: Math.max(...timings) <= 1000 ? "PASS" : "FAIL",
        attempts: 20,
        timingsMs: timings,
        maxMs: Math.max(...timings),
        remainingWorkersAfterCancel: 0,
      },
      null,
      2,
    ) + "\n",
  );
  expect(Math.max(...timings)).toBeLessThanOrEqual(1000);
});
test("moved text jumps both sides; identity remains with displayed PDF after next selection", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("基准 PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R12_exact_move/before.pdf"),
    );
  await page
    .getByLabel("待审 PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R12_exact_move/after.pdf"),
    );
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await page.locator(".card").filter({ hasText: "移动" }).first().click();
  await expect(page.getByAltText("基准原文第 1 页")).toBeVisible();
  await expect(page.getByAltText("待审原文第 2 页")).toBeVisible();
  await page
    .getByLabel("待审 PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/unicode.pdf"));
  await expect(page.locator(".document-head").nth(1)).toContainText(
    "after.pdf",
  );
});
test("corrupt input fails and password is handled locally", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("基准 PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/corrupt.pdf"));
  await page
    .getByLabel("待审 PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/unicode.pdf"));
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "failed",
  );
  await expect(page.locator(".card")).toHaveCount(0);
  await page
    .getByLabel("基准 PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/encrypted.pdf"));
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("PASSWORD_REQUIRED");
  await page
    .getByLabel("基准 PDF 密码", { exact: true })
    .fill("fixture-secret");
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await expect(page.locator(".card")).toHaveCount(0);
});
test("non-BMP scalar maps to its visible rotated glyph with CropBox and UserUnit", async ({
  page,
}) => {
  await page.goto("/");
  const file = path.resolve(
    "tests/fixtures/mechanisms/crop-rotate-userunit.pdf",
  );
  await page.getByLabel("基准 PDF", { exact: true }).setInputFiles(file);
  await page.getByLabel("待审 PDF", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "开始比较", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  await page.getByLabel("搜索原文").fill("😀");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.locator(".hits button").first().click();
  await expect(page.locator("polygon").first()).toBeVisible();
  const points = await page.locator("polygon").first().getAttribute("points");
  const numbers = points!.split(/[ ,]/).map(Number);
  const expected = JSON.parse(
    readFileSync("tests/fixtures/mechanisms/layout.json", "utf8"),
  ).emoji_region;
  const actual = [
    Math.min(numbers[0], numbers[2], numbers[4], numbers[6]),
    Math.min(numbers[1], numbers[3], numbers[5], numbers[7]),
    Math.max(numbers[0], numbers[2], numbers[4], numbers[6]),
    Math.max(numbers[1], numbers[3], numbers[5], numbers[7]),
  ];
  const area = (b: number[]) => (b[2] - b[0]) * (b[3] - b[1]);
  const intersection =
    Math.max(
      0,
      Math.min(actual[2], expected[2]) - Math.max(actual[0], expected[0]),
    ) *
    Math.max(
      0,
      Math.min(actual[3], expected[3]) - Math.max(actual[1], expected[1]),
    );
  expect(intersection / area(expected)).toBeGreaterThan(0.55);
  expect(area(actual) / area(expected)).toBeLessThan(2.5);
  await page.screenshot({
    path: `reports/rotated-location-${process.env.POLICY_ENGINE ?? "mupdf"}.png`,
  });
});
