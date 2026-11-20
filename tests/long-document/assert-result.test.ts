import { expect, it } from "vitest";
import { compare } from "../../packages/compare-core/index";
import { textDoc } from "../helpers";
import { assertFixtureResult, type FixtureTruth } from "./assert-result";

function compareLines(kind: "replacement" | "column-reorder", oldText: string, newText: string) {
  const oldDoc = textDoc([{ text: oldText }]);
  const newDoc = textDoc([{ text: newText }]);
  const result = compare(oldDoc, newDoc);
  const truth: FixtureTruth = {
    sha256: { "baseline.pdf": oldDoc.contentHash, "revised.pdf": newDoc.contentHash },
    cases: [{
      id: kind === "replacement" ? "year" : "C03",
      kind,
      baseline: { page: 1, text: oldText },
      revised: { page: 1, text: newText },
    }],
  };
  return { result, truth, card: result.differences[0] };
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
  result.differences = [];
  const notice = {
    reason: "ambiguous_match",
    message: "Column correspondence is unresolved.",
    left: card.left,
    right: card.right,
    defaultVisible: true,
  } as const;
  result.unresolved = [notice];
  expect(() => assertFixtureResult(result, truth)).not.toThrow();

  result.unresolved = [{ ...notice, right: [] }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/C03: control remained unresolved/);

  result.unresolved = [{ ...notice, message: "Several possible matches." }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/C03: control remained unresolved/);

  result.unresolved = [{ ...notice, reason: "budget" }];
  expect(() => assertFixtureResult(result, truth)).toThrow(/comparison exhausted a work budget/);
});
