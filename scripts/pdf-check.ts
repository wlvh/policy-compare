import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { loadEngine, type EngineName } from "../packages/pdf-adapter/node";
const engine = (process.argv[2] ?? "mupdf") as EngineName;
const { openSession, extractPdf } = await loadEngine(engine);
import { parseDoc } from "../packages/contracts/index";
const dir = "tests/fixtures/mechanisms",
  checks: { name: string; status: string; error?: string }[] = [];
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    checks.push({ name, status: "PASS" });
  } catch (e) {
    checks.push({ name, status: "FAIL", error: String(e) });
  }
}
await check(
  "actual PDF non-BMP, combining mark and ligature preserved",
  async () => {
    const d = parseDoc(await extractPdf(readFileSync(dir + "/unicode.pdf")));
    assert.equal(
      d.pages[0].chars
        .filter((c) => c.provenance !== "inferred")
        .map((c) => c.text)
        .join(""),
      "A😀éﬁSYNTHETIC TEST",
    );
    assert.equal(
      d.pages[0].chars[1].rawRange[1] - d.pages[0].chars[1].rawRange[0],
      1,
    );
  },
);
await check(
  "rotation + nonzero CropBox + UserUnit use one display transform",
  async () => {
    const s = await openSession(
      readFileSync(dir + "/crop-rotate-userunit.pdf"),
    );
    try {
      const p = await s.extractPage(0);
      assert.equal(p.width, 600);
      assert.equal(p.height, 480);
      assert.ok(Math.abs(p.chars[0].origin[0] - 440) < 0.01);
      assert.ok(Math.abs(p.chars[0].origin[1] - 60) < 0.01);
      assert.deepEqual(p.lines[0].direction, [0, 1]);
      if (engine === "pdfjs") return;
      const image = await s.render(0, 1);
      assert.equal(image.width, 600);
      assert.equal(image.height, 480);
      mkdirSync("reports", { recursive: true });
      writeFileSync(`reports/coordinate-page-${engine}.png`, image.png);
    } finally {
      await s.destroy();
    }
  },
);
await check(
  "password failures and successful local authentication",
  async () => {
    await assert.rejects(
      () => extractPdf(readFileSync(dir + "/encrypted.pdf")),
      /PASSWORD_REQUIRED/,
    );
    const d = await extractPdf(
      readFileSync(dir + "/encrypted.pdf"),
      "fixture-secret",
    );
    assert.equal(d.pageCount, 1);
    assert.ok(!JSON.stringify(d).includes("fixture-secret"));
  },
);
await check("corrupt PDF is failed, not empty complete", async () => {
  await assert.rejects(() => extractPdf(readFileSync(dir + "/corrupt.pdf")));
});
await check("page failure retains other real extracted pages", async () => {
  const s = await openSession(
    readFileSync("validation/dataset/cases/R01_identical/before.pdf"),
  );
  const original = s.extractPage.bind(s);
  s.extractPage = (i) => {
    if (i === 1) throw new Error("controlled page fault");
    return original(i);
  };
  try {
    const d = await s.extract();
    assert.ok(d.pages[0].chars.length);
    assert.equal(d.pages[1].coverageState, "failed");
    assert.equal(d.pages[1].issues[0].reason, "page_failed");
  } finally {
    await s.destroy();
  }
});
await check(
  "destroy invalidates document and repeated cleanup is safe",
  async () => {
    const s = await openSession(readFileSync(dir + "/unicode.pdf"));
    await s.destroy();
    await s.destroy();
    await assert.rejects(async () => s.extractPage(0), /关闭/);
  },
);
const report = {
  subject: "real_pdf_adapter_mechanisms",
  engine,
  nodeFineRender: engine === "pdfjs" ? "NOT_RUN_BROWSER_REQUIRED" : "PASS",
  status: checks.every((x) => x.status === "PASS") ? "PASS" : "FAIL",
  checks,
};
writeFileSync(
  `reports/pdf-checks-${engine}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
process.exitCode = report.status === "PASS" ? 0 : 1;
