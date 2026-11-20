import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DocInput, Page } from "../../packages/contracts/index";
import { loadEngine } from "../../packages/pdf-adapter/node";
import { CoreSession, loadCore } from "../../packages/rust-core/index";
import { assertFixtureResult, type FixtureTruth } from "./assert-result";
import { assertFixtureLocations, fixturePages, fixtureSides } from "./mupdf-sources";

const { openSession } = await loadEngine("mupdf");
const module = await loadCore();

export async function checkLongDocument(directory: string) {
  const truth: FixtureTruth = JSON.parse(await readFile(join(directory, "truth.json"), "utf8"));
  const core = new CoreSession(module);
  const sources: DocInput[] = [];
  try {
    for (const [side, name] of fixtureSides.entries()) {
      const pdf = await openSession(await readFile(join(directory, name + ".pdf")));
      try {
        const expectedPages = fixturePages(truth, name);
        const pages: Page[] = [];
        core.meta(side, pdf.metadata());
        // Use the web worker's page-at-a-time protocol. Only retain answer-key pages for source verification.
        await pdf.extract(page => {
          core.page(side, page);
          if (expectedPages.has(page.pageIndex)) pages[page.pageIndex] = page;
        }, undefined, false);
        core.done(side);
        sources.push({ ...pdf.metadata(), pages });
      } finally {
        await pdf.destroy();
      }
    }
    const result = core.compare();
    assertFixtureResult(result, truth);
    assertFixtureLocations(result, [sources[0], sources[1]]);
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
