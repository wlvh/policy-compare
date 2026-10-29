import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Issue #2, round 8: results no longer rank differences by importance. A
// difference states its edit, whether it moved, what it was paired by and its
// sources; `facts` only state what the two texts prove; differences follow the
// document. Unchanged numbers or words elsewhere in the text, its role or a
// normalised match say nothing about the edit.
// The raw result is checked: parsing strips keys the schema does not name.
const run = (left: ReturnType<typeof textDoc>, right: ReturnType<typeof textDoc>) => {
  const r = compare(left, right) as unknown as CompareResultV2;
  for (const d of r.differences) expect((d as { category?: unknown }).category).toBeUndefined();
  ResultSchemaV2.parse(r);
  return r;
};
const edits = (d: CompareResultV2["differences"][number]) =>
  d.textOps.filter((o) => o.kind !== "equal").map((o) => [o.kind, o.text]);
const one = (old: string, now: string) => {
  const r = run(textDoc([{ text: old }]), textDoc([{ text: now }]));
  expect(r.differences).toHaveLength(1);
  return r.differences[0];
};

describe("an unchanged amount does not describe an edit beside it", () => {
  const amount = "The deductible is USD 1,000,000 each and every loss";
  for (const [name, now, ops] of [
    ["a punctuation change", `${amount};`, [["delete", "."], ["insert", ";"]]],
    ["a word change", amount.replace("every", "any") + ".", [["delete", "ever"], ["insert", "an"]]],
  ] as const)
    it(`${name}: the edit, its sources, and no importance statement`, () => {
      const d = one(`${amount}.`, now);
      expect([d.kind, d.hasTextChange, d.facts]).toEqual(["Replaced", true, []]);
      expect(edits(d)).toEqual(ops);
      expect(d.textOps.filter((o) => o.kind !== "equal").every((o) => o.left.length + o.right.length > 0)).toBe(true);
    });
});

describe("a normalised match is not evidence that only the form changed", () => {
  for (const [old, now, ops] of [
    ["Limit 10² units", "Limit 102 units", [["delete", "²"], ["insert", "2"]]],
    ["Limit １００ units", "Limit 100 units", [["delete", "１００"], ["insert", "100"]]],
    ["Office", "Ofﬁce", [["delete", "fi"], ["insert", "ﬁ"]]],
  ] as const)
    it(`${old} -> ${now}: the character edit is kept and no fact is stated`, () => {
      const d = one(old, now);
      expect([d.oldText, d.newText, d.hasTextChange, d.facts]).toEqual([old, now, true, []]);
      expect(edits(d)).toEqual(ops);
    });
});

describe("whitespace_only is stated only when the words are the same", () => {
  it("a doubled space: whitespace_only", () => {
    expect(one("Limit USD 5,000", "Limit  USD 5,000").facts).toEqual(["whitespace_only"]);
  });
  it("a removed space joins two words: no fact", () => {
    const d = one("Limit USD 5,000 per aircraft", "Limit USD 5,000 peraircraft");
    expect([d.hasTextChange, d.facts]).toEqual([true, []]);
  });
  it("a line of whitespace on one side only: whitespace_only", () => {
    const base = [{ text: "The insured confirms the declared operations.", x: 40, y: 300 }];
    const r = run(textDoc(base), textDoc([...base, { text: "   ", x: 40, y: 340 }]));
    expect(r.differences.map((d) => [d.kind, d.facts])).toEqual([["Added", ["whitespace_only"]]]);
  });
});

describe("a moved and edited paragraph keeps both statements", () => {
  const paragraphs = [
    "The insurer covers approved operations within the territorial limits.",
    "Separate conditions remain in force throughout the policy year.",
    "Notice of any claim must be given within thirty days of discovery.",
    "The insured shall maintain the aircraft in an airworthy condition.",
  ];
  it("kind Moved, the word edit, sources on both sides", () => {
    const moved = paragraphs[0].replace("approved", "scheduled");
    const r = run(
      textDoc(paragraphs.map((text) => ({ text }))),
      textDoc([...paragraphs.slice(1), moved].map((text) => ({ text }))),
    );
    const d = r.differences.find((x) => x.oldText === paragraphs[0])!;
    expect(d).toBeDefined();
    expect([d.kind, d.newText, d.hasTextChange, d.facts]).toEqual(["Moved", moved, true, []]);
    expect(edits(d)).toEqual([["delete", "approv"], ["insert", "schedul"]]);
    expect(d.left.length && d.right.length).toBeTruthy();
  });
});

describe("differences follow the document, whatever they change", () => {
  it("a wording change above an amount change comes first", () => {
    const doc = (word: string, amount: string) =>
      textDoc([
        { text: `Note: the insured confirms the declared ${word}.`, y: 150 },
        { text: "Unchanged wording keeps the two edits apart.", y: 200 },
        { text: `HULL LIMIT: USD ${amount}`, y: 250 },
      ]);
    const r = run(doc("operations", "1,000,000"), doc("operation", "2,000,000"));
    expect(r.differences.map((d) => d.newText)).toEqual([
      "Note: the insured confirms the declared operation.",
      "HULL LIMIT: USD 2,000,000",
    ]);
  });
});

describe("other facts the texts prove", () => {
  it("a period whose two dates each move one year: dates_rolled_forward_one_year", () => {
    const d = one(
      "PERIOD: 01 April 2024 to 31 March 2025 coverage includes war risks",
      "PERIOD: 01 April 2025 to 31 March 2026 coverage includes war risks",
    );
    expect(d.facts).toEqual(["dates_rolled_forward_one_year"]);
  });
  it("the same period with a changed word: no fact", () => {
    const d = one(
      "PERIOD: 01 April 2024 to 31 March 2025 coverage includes war risks",
      "PERIOD: 01 April 2025 to 31 March 2026 coverage excludes war risks",
    );
    expect(d.facts).toEqual([]);
  });
  it("an explicit page number alone on one side: page_number_only", () => {
    const base = [{ text: "The insured confirms the declared operations.", x: 40, y: 300 }];
    const r = run(textDoc(base), textDoc([{ text: "Page 3", x: 40, y: 40 }, ...base]));
    expect(r.differences.map((d) => [d.kind, d.facts])).toEqual([["Added", ["page_number_only"]]]);
  });
  it("page_number_only covers the page numbers of a margin line and nothing else", () => {
    const base = [{ text: "The insured confirms the declared operations.", x: 40, y: 300 }];
    const line = (text: string, y: number) => textDoc([{ text, x: 40, y }, ...base]);
    const facts = (old: string, now: string, y: number) =>
      run(line(old, y), line(now, y)).differences.map((d) => [d.oldText, d.newText, d.facts]);
    expect(facts("Schedule Page 3 of 10", "Schedule Page 3 of 11", 40)).toEqual([
      ["Schedule Page 3 of 10", "Schedule Page 3 of 11", ["page_number_only"]],
    ]);
    expect(facts("Schedule Page 3 of 10", "SCHEDULE Page 3 of 11", 40)).toEqual([
      ["Schedule Page 3 of 10", "SCHEDULE Page 3 of 11", []],
    ]);
    // In the body, "Page n" refers to a page; it is not this page's number.
    const body = facts("See Page 3 of 10", "See Page 4 of 10", 400);
    expect(body.map(([, now, facts]) => [String(now).includes("See Page 4 of 10"), facts])).toEqual([[true, []]]);
  });
  it("a page total changed in a repeated page line: page_number_only, with both occurrence counts", () => {
    const doc = (total: number) =>
      textDoc(
        Array.from({ length: 4 }, (_, page) => [
          { text: `Page ${page + 1} of ${total}`, x: 40, y: 820, page },
          { text: `Clause ${page + 1} keeps the insured terms unchanged.`, x: 40, y: 400, page },
        ]).flat(),
      );
    const r = run(doc(4), doc(5));
    expect(r.differences.map((d) => [d.kind, d.facts, d.repeat, d.occurrences.length])).toEqual([
      ["Replaced", ["page_number_only"], { left: 4, right: 4, leftPages: 4, rightPages: 4 }, 4],
    ]);
  });
  it("a continuation heading of a heading both versions have: continued_heading", () => {
    const doc = (continued: boolean) =>
      textDoc([
        { text: "SCHEDULE OF AIRCRAFT", x: 40, y: 150, page: 0 },
        { text: "The insured aircraft are listed in this schedule.", x: 40, y: 300, page: 0 },
        ...(continued ? [{ text: "SCHEDULE OF AIRCRAFT CONTINUED", x: 40, y: 150, page: 1 }] : []),
        { text: "The agreed values apply to each listed aircraft.", x: 40, y: 300, page: 1 },
      ]);
    const r = run(doc(false), doc(true));
    expect(r.differences.map((d) => [d.kind, d.newText, d.facts])).toEqual([
      ["Added", "SCHEDULE OF AIRCRAFT CONTINUED", ["continued_heading"]],
    ]);
  });
});

describe("result format 2", () => {
  it("names its version and has no category on any difference", () => {
    const r = run(textDoc([{ text: "INSURED: Alpha Air Ltd" }]), textDoc([{ text: "REINSURED: Alpha Air Ltd" }]));
    expect(r.schemaVersion).toBe("policy-compare-result/2");
    expect(r.differences.length).toBeGreaterThan(0);
  });
});
