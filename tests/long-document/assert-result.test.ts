import { expect, it } from "vitest";
import { compare } from "../../packages/compare-core/index";
import { textDoc } from "../helpers";
import { assertFixtureResult, type FixtureTruth } from "./assert-result";
import { assertFixtureLocations } from "./mupdf-sources";

function compareLines(kind: "replacement" | "column-reorder", oldText: string, newText: string) {
  const oldDoc = textDoc([{ text: oldText }]);
  const newDoc = textDoc([{ text: newText }]);
  const result = compare(oldDoc, newDoc);
  const truth: FixtureTruth = {
    sha256: { "baseline.pdf": oldDoc.contentHash, "revised.pdf": newDoc.contentHash },
    cases: [{
      id: kind === "replacement" ? "year" : kind,
      kind,
      baseline: { page: 1, text: oldText },
      revised: { page: 1, text: newText },
    }],
  };
  return { result, truth, card: result.differences[0], oldDoc, newDoc };
}

it("accepts a last-digit edit and rejects a card that hides the year change", () => {
  const { result, truth, card } = compareLines("replacement", "Policy year: 2022", "Policy year: 2023");
  expect(card.textOps.filter(op => op.kind !== "equal").map(op => op.text)).toEqual(["2", "3"]);
  expect(() => assertFixtureResult(result, truth)).not.toThrow();

  const { left, right } = card.textOps[0];
  card.oldText = card.newText = "Policy year:";
  card.textOps = [{ kind: "equal", text: card.oldText, left, right }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/year: card lacks a source-backed edit/);
});

it("rejects a highlighted digit pointing to a different occurrence of the same digit", () => {
  const { result, truth, card } = compareLines("replacement", "Policy year: 2022", "Policy year: 2023");
  const [equal, deleted] = card.textOps;
  const ref = equal.left[0];
  const firstTwo = ref.text.indexOf("2");
  deleted.left = [{
    ...ref,
    text: "2",
    charIds: [ref.charIds[firstTwo]],
    quads: [ref.quads[firstTwo]],
    rawRange: [ref.rawRange[0] + firstTwo, ref.rawRange[0] + firstTwo + 1],
  }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/year: card lacks a source-backed edit/);
});

it("accepts a column correspondence notice only with the source rows on both sides", () => {
  const { result, truth, card } = compareLines(
    "column-reorder", "Delta desk 48 hours Written notice", "Delta desk Written notice 48 hours",
  );
  truth.cases[0].moved_cells = ["48 hours", "Written notice"];
  result.differences = [];
  const notice = {
    reason: "ambiguous_column_mapping",
    message: "The two fields could not be reliably aligned.",
    left: card.left,
    right: card.right,
    defaultVisible: true,
  } as const;
  result.unresolved = [notice];
  expect(() => assertFixtureResult(result, truth)).not.toThrow();

  result.unresolved = [{ ...notice, right: [] }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/column correspondence notice with both rows/);

  result.unresolved = [{ ...notice, reason: "ambiguous_match", message: "Column order has been verified." }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/control remained unresolved/);

  result.unresolved = [{ ...notice, reason: "budget" }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/comparison exhausted a work budget/);
});

it("rejects a moved value attached to a different cell on the same row", () => {
  const make = (reordered: boolean) => textDoc([
    reordered ? ["Desk", "Contact method", "Stage window"] : ["Desk", "Stage window", "Contact method"],
    reordered ? ["Delta desk", "Written notice", "48 hours"] : ["Delta desk", "48 hours", "Written notice"],
  ].flatMap((row, i) => row.map((text, j) => ({ text, x: 40 + j * 170, y: 100 + i * 24 }))));
  const left = make(false);
  const right = make(true);
  const result = compare(left, right);
  const truth: FixtureTruth = {
    sha256: { "baseline.pdf": left.contentHash, "revised.pdf": right.contentHash },
    cases: [{
      id: "C03",
      kind: "column-reorder",
      moved_cells: ["48 hours", "Written notice"],
      baseline: { page: 1, text: "Delta desk 48 hours Written notice", y_range_top_pt: [117, 129] },
      revised: { page: 1, text: "Delta desk Written notice 48 hours", y_range_top_pt: [117, 129] },
    }],
  };
  expect(() => assertFixtureResult(result, truth)).not.toThrow();
  const [first, second] = result.differences.filter(d => truth.cases[0].moved_cells!.includes(d.oldText));
  [first.right, second.right] = [second.right, first.right];
  expect(() => assertFixtureLocations(result, [left, right])).not.toThrow();
  expect(() => assertFixtureResult(result, truth)).toThrow(/C03: a moved cell does not match its source/);
});

it.each(["addition", "deletion"] as const)("rejects an %s card that hides its clause", kind => {
  const clause = "A temporary dust monitor is required.";
  const common = "Shared heading";
  const oldDoc = textDoc([{ text: common }, ...(kind === "deletion" ? [{ text: clause }] : [])]);
  const newDoc = textDoc([{ text: common }, ...(kind === "addition" ? [{ text: clause }] : [])]);
  const result = compare(oldDoc, newDoc);
  const truth: FixtureTruth = {
    sha256: { "baseline.pdf": oldDoc.contentHash, "revised.pdf": newDoc.contentHash },
    cases: [{
      id: kind,
      kind,
      baseline: kind === "deletion" ? { page: 1, text: clause } : null,
      revised: kind === "addition" ? { page: 1, text: clause } : null,
    }],
  };
  expect(() => assertFixtureResult(result, truth)).not.toThrow();
  const [card] = result.differences;
  card.oldText = card.newText = "";
  card.textOps = [];
  expect(() => assertFixtureResult(result, truth)).toThrow(/card lacks a source-backed edit/);
});

it("resolves the highlighted glyph independently of the exported text and character range", () => {
  const { result, truth, card, oldDoc, newDoc } = compareLines("replacement", "Policy year: 2022", "Policy year: 2023");
  const [equal, deleted] = card.textOps;
  expect(() => assertFixtureLocations(result, [oldDoc, newDoc])).not.toThrow();
  deleted.left[0].quads = [equal.left[0].quads[equal.text.indexOf("2")]];
  expect(() => assertFixtureResult(result, truth)).not.toThrow();
  expect(() => assertFixtureLocations(result, [oldDoc, newDoc])).toThrow(/Invalid original-PDF reference/);
});
