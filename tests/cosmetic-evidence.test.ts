import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchema, type CompareResult } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Issue #2, round 6: every Cosmetic card needs concrete evidence that only the
// form changed: equal text, a confirmed page number, whitespace, an explicit
// label alias or a continuation heading. Lacking digits or keywords, or the
// role of the line, is not such evidence.
const run = (left: ReturnType<typeof textDoc>, right: ReturnType<typeof textDoc>) =>
  ResultSchema.parse(compare(left, right));
const both = (f: (added: boolean) => [ReturnType<typeof textDoc>, ReturnType<typeof textDoc>]) =>
  [true, false].map((added) => [added ? "added" : "removed", f(added)] as const);
const sourced = (r: CompareResult) =>
  r.differences.every((d) => (d.kind === "Added" || d.left.length > 0) && (d.kind === "Removed" || d.right.length > 0));

describe("a one-sided repeated line is cosmetic only when nothing but its page number is left", () => {
  // Four 600 x 850 pages; the repeated line sits in the top margin (y=120).
  const doc = (line: ((page: number) => string) | null) =>
    textDoc(
      Array.from({ length: 4 }, (_, page) => [
        ...(line ? [{ text: line(page), x: 40, y: 120, page }] : []),
        { text: `Clause ${page + 1} keeps the insured terms unchanged.`, x: 40, y: 400, page },
      ]).flat(),
    );
  const cases: [string, (page: number) => string, "Review" | "Material" | "Cosmetic"][] = [
    ["business wording", (p) => `War risks excluded Page ${p + 1}`, "Review"],
    ["a draft mark", (p) => `Draft Page ${p + 1}`, "Review"],
    ["an amount", (p) => `Limit USD 1,000,000 Page ${p + 1}`, "Material"],
    ["only Page n", (p) => `Page ${p + 1}`, "Cosmetic"],
    ["only - n -", (p) => `- ${p + 1} -`, "Cosmetic"],
  ];
  for (const [name, line, expected] of cases)
    for (const [direction, [left, right]] of both((added) => (added ? [doc(null), doc(line)] : [doc(line), doc(null)])))
      it(`${name}, ${direction}: ${expected}`, () => {
        const r = run(left, right);
        expect(r.differences.length).toBeGreaterThan(0);
        expect([...new Set(r.differences.map((d) => d.category))]).toEqual([expected]);
        expect(sourced(r)).toBe(true);
      });
});

describe("a label or table header is not cosmetic by its role alone", () => {
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
      it(`${name}, ${direction}: at least Review, with its source`, () => {
        const r = run(left, right);
        expect(r.differences.length).toBeGreaterThan(0);
        expect(r.differences.every((d) => d.category === "Review")).toBe(true);
        expect(sourced(r)).toBe(true);
      });
  it("a label that names another party (INSURED: -> REINSURED:) is at least Review", () => {
    const r = run(textDoc([{ text: "INSURED:", x: 40, y: 150 }]), textDoc([{ text: "REINSURED:", x: 40, y: 150 }]));
    expect(r.differences.length).toBeGreaterThan(0);
    expect(r.differences.some((d) => d.category === "Cosmetic")).toBe(false);
    expect(sourced(r)).toBe(true);
  });
  it("R11: an explicit alias of the same field (SUMS INSURED: -> SUM INSURED:) stays Cosmetic", () => {
    const line = (label: string) => textDoc([{ text: `${label} USD 5,000,000`, x: 40, y: 150 }]);
    const r = run(line("SUMS INSURED:"), line("SUM INSURED:"));
    expect(r.differences.map((d) => [d.category, d.oldText, d.newText])).toEqual([["Cosmetic", "SUMS INSURED:", "SUM INSURED:"]]);
  });
  it("an unchanged table header gives no card", () => {
    const doc = () => textDoc([kept, ...HEADERS.map((text, j) => ({ text, x: 40 + j * 100, y: 250 }))]);
    expect(run(doc(), doc()).differences).toHaveLength(0);
  });
});

describe("a one-sided mark at the top of a page keeps the content rule", () => {
  const doc = (mark: boolean) =>
    textDoc([
      ...(mark ? [{ text: "☑", x: 40, y: 40 }] : []),
      { text: "The insured confirms the declared operations.", x: 40, y: 300 },
    ]);
  for (const [direction, [left, right]] of both((added) => (added ? [doc(false), doc(true)] : [doc(true), doc(false)])))
    it(`☑ ${direction}: Material, as the substantive-symbol rule says`, () => {
      const r = run(left, right);
      expect(r.differences.map((d) => d.category)).toEqual(["Material"]);
      expect(sourced(r)).toBe(true);
    });
});

describe("cosmetic exits that keep their evidence", () => {
  const base = [{ text: "The insured confirms the declared operations.", x: 40, y: 300 }];
  it("a line of whitespace only is cosmetic", () => {
    const r = run(textDoc(base), textDoc([...base, { text: "   ", x: 40, y: 340 }]));
    expect(r.differences.map((d) => d.category)).toEqual(["Cosmetic"]);
  });
  it("an explicit page number alone at the top of one side is cosmetic", () => {
    const r = run(textDoc(base), textDoc([{ text: "Page 3", x: 40, y: 40 }, ...base]));
    expect(r.differences.map((d) => [d.kind, d.category])).toEqual([["Added", "Cosmetic"]]);
  });
});
