# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lifecycle.spec.ts >> twenty cancellation cycles leave no workers and allow a complete subsequent result
- Location: tests/browser/lifecycle.spec.ts:4:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 2

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: POLICY COMPARE / 本地审阅 · mupdf
      - heading "让每处变化，都有原文依据。" [level=1] [ref=e7]
      - paragraph [ref=e8]: 基准 → 待审 · PDF 在此浏览器内处理
    - generic [ref=e9]:
      - text: 本地处理
      - generic [ref=e10]: 不上传文档 · 无 OCR
  - region "文档选择" [ref=e11]:
    - generic [ref=e12]:
      - generic [ref=e13]: 01 基准版
      - button "基准 PDF" [ref=e14]
      - generic [ref=e15]: before.pdf
      - textbox "基准 PDF 密码" [ref=e16]:
        - /placeholder: 受保护文件密码（可选）
    - generic [ref=e17]:
      - generic [ref=e18]: 02 待审版
      - button "待审 PDF" [ref=e19]
      - generic [ref=e20]: after.pdf
      - textbox "待审 PDF 密码" [ref=e21]:
        - /placeholder: 受保护文件密码（可选）
    - generic [ref=e22]:
      - button "开始比较" [ref=e23] [cursor=pointer]
      - button "交换方向" [ref=e24] [cursor=pointer]
      - button "取消" [disabled] [ref=e25]
  - status [ref=e26]:
    - strong [ref=e27]: 比较完成
    - generic [ref=e28]: 可提取文本比较完成，所有变化默认可见。
    - button "导出 JSON" [ref=e29] [cursor=pointer]
    - button "关闭任务" [ref=e30] [cursor=pointer]
  - generic [ref=e31]:
    - complementary [ref=e32]:
      - generic [ref=e33]:
        - heading "变化清单 1" [level=2] [ref=e34]
        - combobox "差异分类" [ref=e35] [cursor=pointer]:
          - option "全部变化" [selected]
          - option "重要变化"
          - option "需要复核"
          - option "期间顺延"
          - option "形式变化"
      - paragraph [ref=e36]: 默认展示所有变化 · 当前筛选隐藏 0 项
      - generic [ref=e37]:
        - textbox "搜索原文" [ref=e38]:
          - /placeholder: 搜索词语或短语
        - combobox "搜索范围" [ref=e39] [cursor=pointer]:
          - option "两侧" [selected]
          - option "基准"
          - option "待审"
        - button "搜索" [ref=e40] [cursor=pointer]
      - button "重要变化 修改 sum_insured USD 2,000,000 USD 4,000,000 主体与字段身份一致" [ref=e42] [cursor=pointer]:
        - generic [ref=e43]:
          - generic [ref=e44]: 重要变化
          - generic [ref=e45]: 修改
        - heading "sum_insured" [level=3] [ref=e46]
        - generic [ref=e47]: USD 2,000,000
        - generic [ref=e48]: USD 4,000,000
        - generic [ref=e49]: 主体与字段身份一致
    - generic [ref=e50]:
      - generic [ref=e51]:
        - generic [ref=e52]: 原文定位 · 原生字符四边形
        - generic [ref=e53]:
          - checkbox "同步滚动" [checked] [ref=e54]
          - text: 同步滚动
      - generic [ref=e55]:
        - generic [ref=e56]:
          - generic [ref=e57]:
            - strong [ref=e58]: 基准版
            - generic "before.pdf" [ref=e59]
            - navigation [ref=e60]:
              - button "基准上一页" [disabled] [ref=e61]: ‹
              - generic [ref=e62]: 1 / 2
              - button "基准下一页" [ref=e63] [cursor=pointer]: ›
          - generic [ref=e65]:
            - img "基准原文第 1 页" [ref=e66]
            - img "基准字符高亮"
        - generic [ref=e67]:
          - generic [ref=e68]:
            - strong [ref=e69]: 待审版
            - generic "after.pdf" [ref=e70]
            - navigation [ref=e71]:
              - button "待审上一页" [disabled] [ref=e72]: ‹
              - generic [ref=e73]: 1 / 2
              - button "待审下一页" [ref=e74] [cursor=pointer]: ›
          - generic [ref=e76]:
            - img "待审原文第 1 页" [ref=e77]
            - img "待审字符高亮"
  - generic [ref=e78]:
    - text: 完整仅指可提取文本范围。分类辅助人工审阅，不输出法律解释。
    - generic [ref=e79]: 开发验证版 · 正式许可与业务留出验收尚未完成
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import path from "node:path";
  3   | import { readFileSync, writeFileSync } from "node:fs";
  4   | test("twenty cancellation cycles leave no workers and allow a complete subsequent result", async ({
  5   |   page,
  6   | }) => {
  7   |   await page.goto("/");
  8   |   await page
  9   |     .getByLabel("基准 PDF", { exact: true })
  10  |     .setInputFiles(
  11  |       path.resolve("validation/dataset/cases/R02_amount/before.pdf"),
  12  |     );
  13  |   await page
  14  |     .getByLabel("待审 PDF", { exact: true })
  15  |     .setInputFiles(
  16  |       path.resolve("validation/dataset/cases/R02_amount/after.pdf"),
  17  |     );
  18  |   const timings = [];
  19  |   for (let i = 0; i < 20; i++) {
  20  |     await page.getByRole("button", { name: "开始比较", exact: true }).click();
  21  |     const start = performance.now();
  22  |     await page.getByRole("button", { name: "取消", exact: true }).click();
> 23  |     await expect.poll(() => page.workers().length).toBe(0);
      |                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  24  |     timings.push(performance.now() - start);
  25  |     await expect(page.locator("[data-status]")).toHaveAttribute(
  26  |       "data-status",
  27  |       "cancelled",
  28  |     );
  29  |   }
  30  |   await page.getByRole("button", { name: "开始比较", exact: true }).click();
  31  |   await expect(page.locator("[data-status]")).toHaveAttribute(
  32  |     "data-status",
  33  |     "complete_for_scope",
  34  |   );
  35  |   await expect(page.locator(".card")).toContainText("USD 4,000,000");
  36  |   writeFileSync(
  37  |     `reports/cancellation-${process.env.POLICY_ENGINE ?? "mupdf"}.json`,
  38  |     JSON.stringify(
  39  |       {
  40  |         status: Math.max(...timings) <= 1000 ? "PASS" : "FAIL",
  41  |         attempts: 20,
  42  |         timingsMs: timings,
  43  |         maxMs: Math.max(...timings),
  44  |         remainingWorkersAfterCancel: 0,
  45  |       },
  46  |       null,
  47  |       2,
  48  |     ) + "\n",
  49  |   );
  50  |   expect(Math.max(...timings)).toBeLessThanOrEqual(1000);
  51  | });
  52  | test("moved text jumps both sides; identity remains with displayed PDF after next selection", async ({
  53  |   page,
  54  | }) => {
  55  |   await page.goto("/");
  56  |   await page
  57  |     .getByLabel("基准 PDF", { exact: true })
  58  |     .setInputFiles(
  59  |       path.resolve("validation/dataset/cases/R12_exact_move/before.pdf"),
  60  |     );
  61  |   await page
  62  |     .getByLabel("待审 PDF", { exact: true })
  63  |     .setInputFiles(
  64  |       path.resolve("validation/dataset/cases/R12_exact_move/after.pdf"),
  65  |     );
  66  |   await page.getByRole("button", { name: "开始比较", exact: true }).click();
  67  |   await expect(page.locator("[data-status]")).toHaveAttribute(
  68  |     "data-status",
  69  |     "complete_for_scope",
  70  |   );
  71  |   await page.locator(".card").filter({ hasText: "移动" }).first().click();
  72  |   await expect(page.getByAltText("基准原文第 1 页")).toBeVisible();
  73  |   await expect(page.getByAltText("待审原文第 2 页")).toBeVisible();
  74  |   await page
  75  |     .getByLabel("待审 PDF", { exact: true })
  76  |     .setInputFiles(path.resolve("tests/fixtures/mechanisms/unicode.pdf"));
  77  |   await expect(page.locator(".document-head").nth(1)).toContainText(
  78  |     "after.pdf",
  79  |   );
  80  | });
  81  | test("corrupt input fails and password is handled locally", async ({
  82  |   page,
  83  | }) => {
  84  |   await page.goto("/");
  85  |   await page
  86  |     .getByLabel("基准 PDF", { exact: true })
  87  |     .setInputFiles(path.resolve("tests/fixtures/mechanisms/corrupt.pdf"));
  88  |   await page
  89  |     .getByLabel("待审 PDF", { exact: true })
  90  |     .setInputFiles(path.resolve("tests/fixtures/mechanisms/unicode.pdf"));
  91  |   await page.getByRole("button", { name: "开始比较", exact: true }).click();
  92  |   await expect(page.locator("[data-status]")).toHaveAttribute(
  93  |     "data-status",
  94  |     "failed",
  95  |   );
  96  |   await expect(page.locator(".card")).toHaveCount(0);
  97  |   await page
  98  |     .getByLabel("基准 PDF", { exact: true })
  99  |     .setInputFiles(path.resolve("tests/fixtures/mechanisms/encrypted.pdf"));
  100 |   await page.getByRole("button", { name: "开始比较", exact: true }).click();
  101 |   await expect(page.getByRole("status")).toContainText("PASSWORD_REQUIRED");
  102 |   await page
  103 |     .getByLabel("基准 PDF 密码", { exact: true })
  104 |     .fill("fixture-secret");
  105 |   await page.getByRole("button", { name: "开始比较", exact: true }).click();
  106 |   await expect(page.locator("[data-status]")).toHaveAttribute(
  107 |     "data-status",
  108 |     "complete_for_scope",
  109 |   );
  110 |   await expect(page.locator(".card")).toHaveCount(0);
  111 | });
  112 | test("non-BMP scalar maps to its visible rotated glyph with CropBox and UserUnit", async ({
  113 |   page,
  114 | }) => {
  115 |   await page.goto("/");
  116 |   const file = path.resolve(
  117 |     "tests/fixtures/mechanisms/crop-rotate-userunit.pdf",
  118 |   );
  119 |   await page.getByLabel("基准 PDF", { exact: true }).setInputFiles(file);
  120 |   await page.getByLabel("待审 PDF", { exact: true }).setInputFiles(file);
  121 |   await page.getByRole("button", { name: "开始比较", exact: true }).click();
  122 |   await expect(page.locator("[data-status]")).toHaveAttribute(
  123 |     "data-status",
```