import assert from "node:assert/strict";
import type { CompareResultV2, SourceLocation } from "../../packages/contracts/index";

interface Source {
  page: number; // The independent answer key uses 1-based physical PDF page numbers.
  text: string;
  y_range_top_pt?: [number, number];
}
interface Case {
  id: string;
  kind: "replacement" | "table-value" | "addition" | "deletion" | "move"
      | "unchanged-repeated" | "reflow" | "column-reorder" | "unchanged-table";
  baseline: Source | null;
  revised: Source | null;
}
export interface FixtureTruth {
  sha256: Record<string, string>;
  exact_difference_count?: number;
  cases: Case[];
}

const words = (text: string) => text.trim().replace(/\s+/g, " ");

function onSource(loc: SourceLocation, target: Source): boolean {
  if (loc.pageIndex + 1 !== target.page) return false;
  if (!target.y_range_top_pt) return true;
  const y = loc.quads[0];
  const center = (y[1] + y[3] + y[5] + y[7]) / 4;
  const [top, bottom] = target.y_range_top_pt;
  return top <= center && center <= bottom;
}

function containsEvidence(locs: SourceLocation[], source: Source | null, kind: Case["kind"]): boolean {
  if (!source) return locs.length === 0;
  // The changed cell need not repeat the row title. The row coordinate is the ownership evidence.
  const expected = kind === "table-value" ? source.text.match(/USD [\d,]+/)?.[0] : source.text;
  assert.ok(expected, "Missing expected source text");
  const sourceText = locs.filter(loc => onSource(loc, source)).map(loc => loc.text).join(" ");
  return words(sourceText).includes(words(expected));
}

function touchesControl(locs: SourceLocation[], source: Source): boolean {
  const expected = words(source.text);
  return locs.some(loc => {
    if (!onSource(loc, source)) return false;
    if (source.y_range_top_pt) return true; // A table row or repeated deadline, bounded spatially.
    const text = words(loc.text);
    return text.length > 0 && (expected.includes(text) || text.includes(expected));
  });
}

/** Validate an exported result using the authored source key, independently of the matcher. */
export function assertFixtureResult(result: CompareResultV2, truth: FixtureTruth): void {
  assert.deepEqual(result.documentHashes, [truth.sha256["baseline.pdf"], truth.sha256["revised.pdf"]]);
  const faults: string[] = [];
  for (const check of truth.cases) {
    const { kind, baseline, revised } = check;
    if (kind === "unchanged-repeated" || kind === "reflow" || kind === "column-reorder" || kind === "unchanged-table") {
      assert.ok(baseline && revised);
      const related = result.differences.filter(d =>
        touchesControl(d.left, baseline) || touchesControl(d.right, revised));
      if (related.some(d => words(d.oldText) !== words(d.newText)
                          || !touchesControl(d.left, baseline) || !touchesControl(d.right, revised))) {
        faults.push(check.id + ": changed text or a mislocated correspondence on a control");
      }
      if (result.unresolved.some(u => touchesControl(u.left, baseline) || touchesControl(u.right, revised))) {
        faults.push(check.id + ": control remained unresolved");
      }
      continue;
    }
    const found = result.differences.some(d => {
      if (kind === "move" && (d.kind !== "Moved" || words(d.oldText) !== words(d.newText))) return false;
      if (kind === "addition" && d.kind !== "Added") return false;
      if (kind === "deletion" && d.kind !== "Removed") return false;
      if ((kind === "replacement" || kind === "table-value") && !d.hasTextChange) return false;
      return containsEvidence(d.left, baseline, kind) && containsEvidence(d.right, revised, kind);
    });
    if (!found) faults.push(check.id + ": expected change missing from its source location");
  }
  if (result.unresolved.some(u => u.reason === "budget" || u.reason === "word_diff_budget")) {
    faults.push("comparison exhausted a work budget");
  }
  if (truth.exact_difference_count !== undefined && result.differences.length !== truth.exact_difference_count) {
    faults.push(`expected ${truth.exact_difference_count} differences, received ${result.differences.length}`);
  }
  assert.deepEqual(faults, []);
}
