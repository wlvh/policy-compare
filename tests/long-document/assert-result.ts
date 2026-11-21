import assert from "node:assert/strict";
import type { CompareResultV2, DifferenceV2, SourceLocation } from "../../packages/contracts/index";
import { noticeMessage, reviewNotices } from "../../apps/web/review-notices";

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
  moved_cells?: string[];
  column_notice_text?: string | string[];
}
export interface FixtureTruth {
  sha256: Record<string, string>;
  exact_difference_count?: number;
  cases: Case[];
}

const words = (text: string) => text.trim().replace(/\s+/g, " ");
const withoutSpace = (text: string) => text.replace(/\s/g, "");
const standardColumnNotices = [
  "The correspondence between these table fields could not be determined. Both source rows are retained.",
  "Column correspondence is unresolved.", // Wording from the original C03 regression.
];

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
  card: DifferenceV2, side: "left" | "right", target: Source | null, kind: Case["kind"],
): string | undefined {
  const removed = side === "left" ? "insert" : "delete";
  const ops = card.textOps.filter(op => op.kind !== removed);
  const body = side === "left" ? card.oldText : card.newText;
  if (!target) {
    return body === "" && !ops.length && !card.textOps.some(op => op[side].length) ? "" : undefined;
  }
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

function showsMovedText(
  card: DifferenceV2, baseline: Source, revised: Source, expected: string,
): boolean {
  if (card.kind !== "Moved" || card.hasTextChange ||
      words(card.oldText) !== expected || words(card.newText) !== expected) return false;
  return (["left", "right"] as const).every(side => {
    const target = side === "left" ? baseline : revised;
    return card[side].every(loc => loc.side === side && onSource(loc, target)) &&
      withoutSpace(card[side].map(loc => loc.text).join("")) === withoutSpace(expected);
  });
}

function showsExpectedChange(card: DifferenceV2, { kind, baseline, revised }: Case): boolean {
  if (!card.hasTextChange || card.oldText === card.newText) return false;
  const leftEqual = unchangedTargetText(card, "left", baseline, kind);
  const rightEqual = unchangedTargetText(card, "right", revised, kind);
  return leftEqual !== undefined && leftEqual === rightEqual;
}

/** Validate an exported result using the authored source key, independently of the matcher. */
export function assertFixtureResult(result: CompareResultV2, truth: FixtureTruth): void {
  assert.deepEqual(result.documentHashes, [truth.sha256["baseline.pdf"], truth.sha256["revised.pdf"]]);
  const faults: string[] = [];
  for (const check of truth.cases) {
    const { kind, baseline, revised } = check;
    if (kind === "column-reorder") {
      assert.ok(baseline && revised);
      // The original C03 key recorded these values in its expectation
      // before moved_cells was added. Limit the fallback to those source rows.
      const legacyC03 = check.id === "C03" &&
        words(baseline.text) === "Delta desk 48 hours Written notice" &&
        words(revised.text) === "Delta desk Written notice 48 hours";
      const expectedCells = check.moved_cells ?? (legacyC03 ? ["48 hours", "Written notice"] : []);
      const touchesRow = (item: Pick<DifferenceV2, "left" | "right">) =>
        touchesControl(item.left, baseline) || touchesControl(item.right, revised);
      const moves = result.differences.filter(touchesRow);
      const notices = result.unresolved.filter(touchesRow);
      const validMoves = moves.filter(d => expectedCells.some(text => showsMovedText(d, baseline, revised, text)));
      const movedCells = new Set(validMoves
        .map(d => words(d.oldText)));
      // Older keys also accept the standard visible notice. A key can
      // additionally author equivalent wording for generic notices.
      const acceptedWording = [...standardColumnNotices, ...[check.column_notice_text ?? []].flat()].map(words);
      const visibleNotices = reviewNotices({ coverage: [], unresolved: notices }).uncertain;
      const validNotices = visibleNotices.filter(u =>
        acceptedWording.includes(words(noticeMessage(u))) &&
        u.left.every(loc => loc.side === "left") && u.right.every(loc => loc.side === "right") &&
        containsEvidence(u.left, baseline, kind) && containsEvidence(u.right, revised, kind));
      if (validMoves.length !== moves.length) {
        faults.push(check.id + ": a moved cell does not match its source on both sides");
      }
      const completeMoves = expectedCells.length > 0 && expectedCells.every(text => movedCells.has(text));
      if (!validNotices.length && !completeMoves) {
        faults.push(check.id + ": expected cell relocations or a column correspondence notice with both rows");
      }
      if (validNotices.length !== notices.length) {
        faults.push(check.id + ": control remained unresolved without a valid column correspondence notice");
      }
      continue;
    }
    if (kind === "unchanged-repeated" || kind === "reflow" || kind === "unchanged-table") {
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
    const located = result.differences.filter(d => {
      if (kind === "move" && d.kind !== "Moved") return false;
      if (kind === "addition" && d.kind !== "Added") return false;
      if (kind === "deletion" && d.kind !== "Removed") return false;
      return containsEvidence(d.left, baseline, kind) && containsEvidence(d.right, revised, kind);
    });
    if (!located.length) {
      faults.push(check.id + ": expected change missing from its source location");
    } else if (kind === "move") {
      assert.ok(baseline && revised && words(baseline.text) === words(revised.text));
      if (!located.some(d => showsMovedText(d, baseline, revised, words(baseline.text)))) {
        faults.push(check.id + ": card lacks the source-backed moved text");
      }
    } else if (!located.some(d => showsExpectedChange(d, check))) {
      faults.push(check.id + ": card lacks a source-backed edit for the expected text");
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
