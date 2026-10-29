import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 as CompareResult } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Issue #2, round 6: every Cosmetic card needed concrete evidence that only the
// form changed. Round 8 retired the categories; the same evidence now decides
// the facts a card states (a confirmed page number, whitespace, a continuation
// heading). Lacking digits or keywords, or the role of the line, is no fact;
// a label alias is shown as its character edit.
const run = (left: ReturnType<typeof textDoc>, right: ReturnType<typeof textDoc>) =>
  ResultSchemaV2.parse(compare(left, right));
const both = (f: (added: boolean) => [ReturnType<typeof textDoc>, ReturnType<typeof textDoc>]) =>
  [true, false].map((added) => [added ? "added" : "removed", f(added)] as const);
const sourced = (r: CompareResult) =>
  r.differences.every((d) => (d.kind === "Added" || d.left.length > 0) && (d.kind === "Removed" || d.right.length > 0));

describe("a one-sided repeated line is page_number_only only when nothing but its page number is left", () => {
  // Four 600 x 850 pages; the repeated line sits in the top margin (y=120).
  const doc = (line: ((page: number) => string) | null) =>
    textDoc(
      Array.from({ length: 4 }, (_, page) => [
        ...(line ? [{ text: line(page), x: 40, y: 120, page }] : []),
        { text: `Clause ${page + 1} keeps the insured terms unchanged.`, x: 40, y: 400, page },
      ]).flat(),
    );
  const cases: [string, (page: number) => string, string[]][] = [
    ["business wording", (p) => `War risks excluded Page ${p + 1}`, []],
    ["a draft mark", (p) => `Draft Page ${p + 1}`, []],
    ["an amount", (p) => `Limit USD 1,000,000 Page ${p + 1}`, []],
    ["only Page n", (p) => `Page ${p + 1}`, ["page_number_only"]],
    // Round 8: a number alone on its line is content, even when it counts
    // with the pages; only explicit "Page n" expressions are page numbers.
    ["only - n -", (p) => `- ${p + 1} -`, []],
  ];
  for (const [name, line, expected] of cases)
    for (const [direction, [left, right]] of both((added) => (added ? [doc(null), doc(line)] : [doc(line), doc(null)])))
      it(`${name}, ${direction}: facts ${JSON.stringify(expected)}`, () => {
        const r = run(left, right);
        expect(r.differences.length).toBeGreaterThan(0);
        expect(r.differences.map((d) => d.facts)).toEqual(r.differences.map(() => expected));
        expect(sourced(r)).toBe(true);
      });
});

describe("a label or table header states no fact by its role alone", () => {
  const HEADERS = ["REGISTRATION", "SERIAL", "MODEL", "CCY", "AGREED VALUE"];
  const kept = { text: "INSURED: Alpha Air Ltd", x: 40, y: 150 };
  const cases: [string, ReturnType<typeof textDoc>, ReturnType<typeof textDoc>][] = [
    ["a label alone", textDoc([kept]), textDoc([kept, { text: "DEDUCTIBLE:", x: 40, y: 200 }])],
    [
      "a profile table header",
      textDoc([kept]),
      textDoc([kept, ...HEADERS.map((text, j) => ({ text, x: 40 + j * 100, y: 250 }))]),
    ],
  ];
  for (const [name, without, withIt] of cases)
    for (const [direction, [left, right]] of both((added) => (added ? [without, withIt] : [withIt, without])))
      it(`${name}, ${direction}: no fact, with its source`, () => {
        const r = run(left, right);
        expect(r.differences.length).toBeGreaterThan(0);
        expect(r.differences.every((d) => d.facts.length === 0)).toBe(true);
        expect(sourced(r)).toBe(true);
      });
  it("a label that names another party (INSURED: -> REINSURED:): its edit, no fact", () => {
    const r = run(textDoc([{ text: "INSURED:", x: 40, y: 150 }]), textDoc([{ text: "REINSURED:", x: 40, y: 150 }]));
    expect(r.differences.length).toBeGreaterThan(0);
    expect(r.differences.some((d) => d.facts.length > 0)).toBe(false);
    expect(sourced(r)).toBe(true);
  });
  it("R11: an alias of the same field (SUMS INSURED: -> SUM INSURED:) shows its character edit, no fact", () => {
    const line = (label: string) => textDoc([{ text: `${label} USD 5,000,000`, x: 40, y: 150 }]);
    const r = run(line("SUMS INSURED:"), line("SUM INSURED:"));
    expect(r.differences.map((d) => [d.oldText, d.newText, d.facts, d.textOps.filter((o) => o.kind !== "equal").map((o) => [o.kind, o.text])])).toEqual([
      ["SUMS INSURED:", "SUM INSURED:", [], [["delete", "S"]]],
    ]);
  });
  it("an unchanged table header gives no card", () => {
    const doc = () => textDoc([kept, ...HEADERS.map((text, j) => ({ text, x: 40 + j * 100, y: 250 }))]);
    expect(run(doc(), doc()).differences).toHaveLength(0);
  });
});

describe("a one-sided mark at the top of a page is shown as content", () => {
  const doc = (mark: boolean) =>
    textDoc([
      ...(mark ? [{ text: "☑", x: 40, y: 40 }] : []),
      { text: "The insured confirms the declared operations.", x: 40, y: 300 },
    ]);
  for (const [direction, [left, right]] of both((added) => (added ? [doc(false), doc(true)] : [doc(true), doc(false)])))
    it(`☑ ${direction}: a one-sided card with its source, no fact`, () => {
      const r = run(left, right);
      expect(r.differences.map((d) => [d.kind, d.facts])).toEqual([[left.pages[0].chars.length > right.pages[0].chars.length ? "Removed" : "Added", []]]);
      expect(sourced(r)).toBe(true);
    });
});

describe("facts that keep their evidence", () => {
  const base = [{ text: "The insured confirms the declared operations.", x: 40, y: 300 }];
  it("a line of whitespace only: whitespace_only", () => {
    const r = run(textDoc(base), textDoc([...base, { text: "   ", x: 40, y: 340 }]));
    expect(r.differences.map((d) => d.facts)).toEqual([["whitespace_only"]]);
  });
  it("an explicit page number alone at the top of one side: page_number_only", () => {
    const r = run(textDoc(base), textDoc([{ text: "Page 3", x: 40, y: 40 }, ...base]));
    expect(r.differences.map((d) => [d.kind, d.facts])).toEqual([["Added", ["page_number_only"]]]);
  });
});
