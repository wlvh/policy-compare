import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveLocation, type CompareResultV2, type DocInput, type Page, type SourceLocation } from "../../packages/contracts/index";
import { loadEngine } from "../../packages/pdf-adapter/node";
import type { FixtureTruth } from "./assert-result";

export const fixtureSides = ["baseline", "revised"] as const;
type FixtureSide = typeof fixtureSides[number];

export function fixturePages(truth: FixtureTruth, side: FixtureSide): Set<number> {
  return new Set(truth.cases.flatMap(check => check[side] ? [check[side].page - 1] : []));
}

export async function readFixtureSources(directory: string, truth: FixtureTruth): Promise<[DocInput, DocInput]> {
  const { openSession } = await loadEngine("mupdf");
  async function readSide(side: FixtureSide): Promise<DocInput> {
    const pdf = await openSession(await readFile(join(directory, side + ".pdf")));
    try {
      const pages: Page[] = [];
      for (const index of fixturePages(truth, side)) pages[index] = await pdf.extractPage(index);
      return { ...pdf.metadata(), pages };
    } finally {
      await pdf.destroy();
    }
  }
  return Promise.all([readSide("baseline"), readSide("revised")]);
}

export function assertFixtureLocations(result: CompareResultV2, docs: [DocInput, DocInput]): void {
  function verify(item: { left: SourceLocation[]; right: SourceLocation[] }, context: string) {
    for (const [i, side] of (["left", "right"] as const).entries()) {
      for (const loc of item[side]) {
        assert.equal(loc.side, side, `Invalid source side in ${context}`);
        if (docs[i].pages[loc.pageIndex]) {
          assert.ok(resolveLocation(loc, docs), `Invalid original-PDF reference in ${context}`);
        }
      }
    }
  }
  for (const card of result.differences) {
    verify(card, card.id);
    for (const op of card.textOps) verify(op, `${card.id} ${op.kind}`);
  }
  for (const notice of result.unresolved) verify(notice, notice.reason);
}
