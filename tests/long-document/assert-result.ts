import assert from "node:assert/strict";
import type { CompareResultV2, DifferenceV2, SourceLocation } from "../../packages/contracts/index";

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
const withoutSpace = (text: string) => text.replace(/\s/g, "");

function onSource(loc: SourceLocation, target: Source): boolean {
  if (loc.pageIndex + 1 !== target.page) return false;
  if (!target.y_range_top_pt) return true;
  const y = loc.quads[0];
  const center = (y[1] + y[3] + y[5] + y[7]) / 4;
  const [top, bottom] = target.y_range_top_pt;
  return top <= center && center <= bottom;
}

function expectedText(source: Source, kind: Case["kind"]): string {
  // The changed cell need not repeat the row title. The row coordinate is the ownership evidence.
  const expected = kind === "table-value" ? source.text.match(/USD [\d,]+/)?.[0] : source.text;
  assert.ok(expected, "Missing expected source text");
  return expected;
}

function containsEvidence(locs: SourceLocation[], source: Source | null, kind: Case["kind"]): boolean {
  if (!source) return locs.length === 0;
  const sourceText = locs.filter(loc => onSource(loc, source)).map(loc => loc.text).join(" ");
  return words(sourceText).includes(words(expectedText(source, kind)));
}

function sourceCharacters(locs: SourceLocation[]) {
  // The PDF ranges use Unicode scalar offsets. Ignore whitespace because the
  // card may include layout separators with no source glyph of their own.
  return locs.flatMap(loc => Array.from(loc.text).flatMap((char, i) =>
    withoutSpace(char).split("").map(text => ({
      text, side: loc.side, page: loc.pageIndex, offset: loc.rawRange[0] + i,
    }))));
}

function unchangedTargetText(
  card: DifferenceV2, side: "left" | "right", target: Source, kind: Case["kind"],
): string | undefined {
  const removed = side === "left" ? "insert" : "delete";
  const ops = card.textOps.filter(op => op.kind !== removed);
  const body = side === "left" ? card.oldText : card.newText;
  if (ops.map(op => op.text).join("") !== body) return undefined;

  const expected = expectedText(target, kind);
  if (!words(body).includes(words(expected))) return undefined;
  const display = withoutSpace(body);
  const source = sourceCharacters(card[side]);
  if (source.map(c => c.text).join("") !== display) return undefined;
  const start = display.indexOf(withoutSpace(expected));
  const end = start + withoutSpace(expected).length;
  let offset = 0;
  let unchanged = "";
  for (const op of ops) {
    const text = withoutSpace(op.text);
    const next = offset + text.length;
    const from = Math.max(start, offset);
    const to = Math.min(end, next);
    if (from < to) {
      if (op.kind === "equal") {
        unchanged += text.slice(from - offset, to - offset);
      } else {
        const edit = sourceCharacters(op[side]);
        if (edit.length !== text.length || edit.some((c, i) => {
          const original = source[offset + i];
          return c.text !== original.text || c.side !== side ||
            c.page !== original.page || c.offset !== original.offset;
        })) return undefined;
        if (op[side].some(loc => !onSource(loc, target))) return undefined;
      }
    }
    offset = next;
  }
  return unchanged;
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
      if (result.unresolved.some(u => {
        if (!touchesControl(u.left, baseline) && !touchesControl(u.right, revised)) return false;
        // C03 allows a notice about column correspondence with the two
        // complete rows. A generic match warning or unfinished work is insufficient.
        return !(kind === "column-reorder" && u.reason === "ambiguous_match" &&
          /\bcolumns?\b/i.test(u.message) &&
          u.left.every(loc => loc.side === "left") && u.right.every(loc => loc.side === "right") &&
          containsEvidence(u.left, baseline, kind) && containsEvidence(u.right, revised, kind));
      })) {
        faults.push(check.id + ": control remained unresolved");
      }
      continue;
    }
    const located = result.differences.filter(d => {
      if (kind === "move" && (d.kind !== "Moved" || words(d.oldText) !== words(d.newText))) return false;
      if (kind === "addition" && d.kind !== "Added") return false;
      if (kind === "deletion" && d.kind !== "Removed") return false;
      return containsEvidence(d.left, baseline, kind) && containsEvidence(d.right, revised, kind);
    });
    if (!located.length) {
      faults.push(check.id + ": expected change missing from its source location");
    } else if (kind === "replacement" || kind === "table-value") {
      assert.ok(baseline && revised);
      const shown = located.some(d => {
        if (!d.hasTextChange || d.oldText === d.newText) return false;
        const oldEqual = unchangedTargetText(d, "left", baseline, kind);
        const newEqual = unchangedTargetText(d, "right", revised, kind);
        return oldEqual !== undefined && oldEqual === newEqual;
      });
      if (!shown) faults.push(check.id + ": card lacks a source-backed edit for the expected text");
    }
  }
  if (result.unresolved.some(u => u.reason === "budget" || u.reason === "word_diff_budget")) {
    faults.push("comparison exhausted a work budget");
  }
  if (truth.exact_difference_count !== undefined && result.differences.length !== truth.exact_difference_count) {
    faults.push(`expected ${truth.exact_difference_count} differences, received ${result.differences.length}`);
  }
  assert.deepEqual(faults, []);
}
