import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
test("twenty cancellation cycles leave no workers and allow a complete subsequent result", async ({
  page,
}) => {
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
  const timings = [];
  // A small task can finish between Playwright's check that "Cancel" is enabled
  // and the click itself, which then lands on the disabled button. That
  // attempt cancelled nothing: the finished task keeps its two workers for
  // rendering and search, as any completed task does. It is recorded and not
  // counted; twenty attempts must still really cancel.
  let finishedBeforeCancel = 0;
  const status = page.locator("[data-status]");
  while (timings.length < 20) {
    expect(timings.length + finishedBeforeCancel).toBeLessThan(40);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    const start = performance.now();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(status).toHaveAttribute("data-status", /^(cancelled|complete_for_scope)$/);
    if ((await status.getAttribute("data-status")) === "complete_for_scope") {
      finishedBeforeCancel++;
      expect(page.workers().length).toBe(2);
      continue;
    }
    await expect.poll(() => page.workers().length).toBe(0);
    timings.push(performance.now() - start);
    await expect(status).toHaveAttribute("data-status", "cancelled");
  }
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await expect(page.locator(".card")).toContainText("USD 4,000,000");
  writeFileSync(
    `${process.env.POLICY_REPORT_DIR || 'reports'}/cancellation-${process.env.POLICY_ENGINE ?? "mupdf"}.json`,
    JSON.stringify(
      {
        status: Math.max(...timings) <= 1000 ? "PASS" : "FAIL",
        attempts: 20,
        finishedBeforeCancel,
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
test("a cancel click that lands after the task finished changes nothing", async ({
  page,
}) => {
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
  const status = page.locator("[data-status]");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(status).toHaveAttribute("data-status", "complete_for_scope");
  // As when Playwright validated the button just before the task finished.
  await page.getByRole("button", { name: "Cancel", exact: true }).click({ force: true });
  await expect(status).toHaveAttribute("data-status", "complete_for_scope");
  await expect(page.locator(".card")).toContainText("USD 4,000,000");
  expect(page.workers().length).toBe(2);
});
test("moved text jumps both sides; identity remains with displayed PDF after next selection", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("Baseline PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R12_exact_move/before.pdf"),
    );
  await page
    .getByLabel("Revised PDF", { exact: true })
    .setInputFiles(
      path.resolve("validation/dataset/cases/R12_exact_move/after.pdf"),
    );
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await page.locator(".card").filter({ hasText: "Moved" }).first().click();
  await expect(page.getByAltText("Baseline source page 1")).toBeVisible();
  await expect(page.getByAltText("Revised source page 2")).toBeVisible();
  await page
    .getByLabel("Revised PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/unicode.pdf"));
  await expect(page.locator(".document-head").nth(1)).toContainText(
    "after.pdf",
  );
});
test("corrupt input fails and password is handled locally", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("Baseline PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/corrupt.pdf"));
  await page
    .getByLabel("Revised PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/unicode.pdf"));
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "failed",
  );
  await expect(page.locator(".card")).toHaveCount(0);
  await page
    .getByLabel("Baseline PDF", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/mechanisms/encrypted.pdf"));
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("PASSWORD_REQUIRED");
  await page
    .getByLabel("Baseline PDF password", { exact: true })
    .fill("fixture-secret");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await expect(page.locator(".card")).toHaveCount(0);
});
test("non-BMP scalar maps to its visible rotated glyph with CropBox and UserUnit", async ({
  page,
}) => {
  await page.goto("./");
  const file = path.resolve(
    "tests/fixtures/mechanisms/crop-rotate-userunit.pdf",
  );
  await page.getByLabel("Baseline PDF", { exact: true }).setInputFiles(file);
  await page.getByLabel("Revised PDF", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("[data-status]")).toHaveAttribute(
    "data-status",
    "complete_for_scope",
  );
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  await page.getByLabel("Search source text").fill("😀");
  await page.getByRole("button", { name: "Search", exact: true }).click();
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
    path: `${process.env.POLICY_REPORT_DIR || 'reports'}/rotated-location-${process.env.POLICY_ENGINE ?? "mupdf"}.png`,
  });
});
