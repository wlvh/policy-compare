import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveLocation, type DocInput, type Page } from "../../packages/contracts/index";
import { loadEngine } from "../../packages/pdf-adapter/node";
import { CoreSession, loadCore } from "../../packages/rust-core/index";
import { assertFixtureResult, type FixtureTruth } from "./assert-result";

const { openSession } = await loadEngine("mupdf");
const module = await loadCore();

export async function checkLongDocument(directory: string) {
  const truth: FixtureTruth = JSON.parse(await readFile(join(directory, "truth.json"), "utf8"));
  const core = new CoreSession(module);
  const sources: DocInput[] = [];
  try {
    for (const [side, name] of (["baseline", "revised"] as const).entries()) {
      const pdf = await openSession(await readFile(join(directory, name + ".pdf")));
      try {
        const expectedPages = new Set(truth.cases.map(c => c[name]?.page));
        const pages: Page[] = [];
        core.meta(side, pdf.metadata());
        // Use the web worker's page-at-a-time protocol. Only retain answer-key pages for source verification.
        await pdf.extract(page => {
          core.page(side, page);
          if (expectedPages.has(page.pageIndex + 1)) pages[page.pageIndex] = page;
        }, undefined, false);
        core.done(side);
        sources.push({ ...pdf.metadata(), pages });
      } finally {
        await pdf.destroy();
      }
    }
    const result = core.compare();
    assertFixtureResult(result, truth);
    const docs: [DocInput, DocInput] = [sources[0], sources[1]];
    for (const d of result.differences) {
      for (const loc of [...d.left, ...d.right]) {
        if (docs[loc.side === "left" ? 0 : 1].pages[loc.pageIndex]) {
          assert.ok(resolveLocation(loc, docs), `Invalid original-PDF reference in ${d.id}`);
        }
      }
    }
    console.log(`PASS ${directory} (${truth.cases.length} source checks, ${result.differences.length} reported differences)`);
  } finally {
    core.dispose();
  }
}

export const longDocumentFixtures = ["admission", "complex-30"].map(name => join("tests/fixtures/long-document", name));

if (import.meta.main) {
  const directories = process.argv.length > 2 ? process.argv.slice(2) : longDocumentFixtures;
  for (const dir of directories) {
    try {
      await checkLongDocument(dir);
    } catch (error) {
      console.error("FAIL", dir, error);
      process.exitCode = 1;
    }
  }
}
