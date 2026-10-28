import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEngine, type EngineName } from "../../packages/pdf-adapter/node";
import { grade, summarize } from "../evaluation/scorer";
import { parseDoc, type DocInput } from "../../packages/contracts/index";
const engine = (process.env.POLICY_ENGINE ?? "mupdf") as EngineName;
const manifest = JSON.parse(
  readFileSync("validation/dataset/manifest.json", "utf8"),
);
test("all 32 pairs independently satisfy business and browser fine-location requirements", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { extractPdf } = await loadEngine(engine);
  const records: ReturnType<typeof grade>[] = [];
  await page.goto("/");
  for (const meta of manifest.cases) {
    const dir = path.resolve("validation/dataset/cases", meta.case_id);
    await page
      .getByLabel("基准 PDF", { exact: true })
      .setInputFiles(dir + "/before.pdf");
    await page
      .getByLabel("待审 PDF", { exact: true })
      .setInputFiles(dir + "/after.pdf");
    await page.getByRole("button", { name: "开始比较", exact: true }).click();
    await expect(page.locator("[data-status]")).toHaveAttribute(
      "data-status",
      /complete_for_scope|partial/,
      { timeout: 20_000 },
    );
    for (const side of [0, 1]) {
      const doc = page.locator(".document").nth(side);
      for (let p = 0; p < meta.page_counts[side ? "after" : "before"]; p++) {
        // Reset from the automatically selected difference page, then inspect all pages.
        if (p === 0) {
          while (
            await doc
              .getByRole("button", {
                name: (side ? "待审" : "基准") + "上一页",
              })
              .isEnabled()
          )
            await doc
              .getByRole("button", {
                name: (side ? "待审" : "基准") + "上一页",
              })
              .click();
        } else
          await doc
            .getByRole("button", { name: (side ? "待审" : "基准") + "下一页" })
            .click();
        await expect(doc.locator(`[data-ready-page="${p}"]`)).toBeVisible({
          timeout: 20_000,
        });
      }
    }
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出 JSON" }).click();
    const download = await pending;
    const result = JSON.parse(readFileSync((await download.path())!, "utf8"));
    const docs = (await Promise.all(
      ["before", "after"].map(async (s) =>
        parseDoc(await extractPdf(readFileSync(dir + "/" + s + ".pdf"))),
      ),
    )) as [DocInput, DocInput];
    const score = grade(
      result,
      JSON.parse(readFileSync(dir + "/expected.json", "utf8")),
      JSON.parse(readFileSync(dir + "/layout.json", "utf8")),
      docs,
      true,
    );
    records.push(score);
    if (score.status !== "PASS")
      writeFileSync(
        `reports/failures/browser-${engine}-${meta.case_id}.json`,
        JSON.stringify({ score, result }, null, 2),
      );
  }
  writeFileSync(
    `reports/browser-rules-${engine}.json`,
    JSON.stringify(
      {
        engine,
        subject: "all_rules_with_real_browser_geometry",
        ...summarize(records),
        records,
      },
      null,
      2,
    ) + "\n",
  );
  expect(
    records
      .filter((r) => r.status !== "PASS")
      .map((r) => ({
        case: r.caseId,
        status: r.status,
        faults: r.faults,
        notEvaluated: r.notEvaluated,
        events: r.events,
      })),
  ).toEqual([]);
});
