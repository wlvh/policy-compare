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
  // PR #11 r4414375279: two consecutive annual periods are not the stated fact
  // when an end date does not move exactly one year (29 February -> 28 February).
  it("consecutive annual periods across a leap day: no fact, the date edit shown", () => {
    const d = one(
      "PERIOD: 1 March 2023 to 29 February 2024 coverage includes war risks",
      "PERIOD: 1 March 2024 to 28 February 2025 coverage includes war risks",
    );
    expect(d.facts).toEqual([]);
    // The card holds the field value as written, both dates included.
    expect([d.oldText.trim(), d.newText.trim()]).toEqual([
      "1 March 2023 to 29 February 2024 coverage includes war risks",
      "1 March 2024 to 28 February 2025 coverage includes war risks",
    ]);
    expect(edits(d).length).toBeGreaterThan(0);
  });
  it("each date one year later, same day and month, whatever the period's length: the fact", () => {
    const d = one(
      "PERIOD: 1 April 2024 to 30 September 2024 coverage includes war risks",
      "PERIOD: 1 April 2025 to 30 September 2025 coverage includes war risks",
    );
    expect(d.facts).toEqual(["dates_rolled_forward_one_year"]);
  });
  it("a day or year inside a longer number is no date: no fact (as the scorer reads dates, #10 4a12cd0)", () => {
    for (const [from, to] of [
      ["PERIOD: 121 April 2024 to 30 September 2024 coverage includes war risks", "PERIOD: 121 April 2025 to 30 September 2025 coverage includes war risks"],
      ["PERIOD: 1 April 20240 to 30 September 2024 coverage includes war risks", "PERIOD: 1 April 20250 to 30 September 2025 coverage includes war risks"],
    ])
      expect(one(from, to).facts).toEqual([]);
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

// Issue #2, round 11 (review r4415913728 and the real row ZJ-FLX): text
// operations pair characters only inside corresponding words and numbers. A
// character-level diff over a whole row paired the comma of 7,400 with the comma
// of 71,600, so its "unchanged" characters crossed from one value to another and
// no operation showed 7,400 -> 7,750 at its place.
describe("text operations pair characters only within corresponding tokens", () => {
  // Equal pairs (old index, new index) of a card's operations.
  const pairs = (d: CompareResultV2["differences"][number]) => {
    const out: [number, number][] = [];
    let i = 0,
      j = 0;
    for (const o of d.textOps) {
      const n = Array.from(o.text).length;
      if (o.kind === "equal") for (let k = 0; k < n; k++) out.push([i + k, j + k]);
      if (o.kind !== "insert") i += n;
      if (o.kind !== "delete") j += n;
    }
    return out;
  };
  // No equal pair links a character inside one span to a character outside the other.
  const aligned = (d: CompareResultV2["differences"][number], old: string, now: string) => {
    const l0 = Array.from(d.oldText).length - Array.from(d.oldText.slice(d.oldText.indexOf(old))).length,
      r0 = Array.from(d.newText).length - Array.from(d.newText.slice(d.newText.indexOf(now))).length,
      [l1, r1] = [l0 + Array.from(old).length, r0 + Array.from(now).length];
    return pairs(d).every(([i, j]) => (i < l0) === (j < r0) && (i >= l1) === (j >= r1));
  };
  it("a row of amounts: each changed amount is paired with its own new value", () => {
    const row = (v: string) => `The agreed premium schedule for aircraft ZJ-FLX as signed by both parties reads ${v} for the period`;
    const d = one(row("0.38% 73,150 7,400 5,775 86,325"), row("0.40% 71,600 7,750 6,265 85,615"));
    for (const [old, now] of [["0.38%", "0.40%"], ["73,150", "71,600"], ["7,400", "7,750"], ["5,775", "6,265"], ["86,325", "85,615"]])
      expect(aligned(d, old, now), old).toBe(true);
  });
  it("controls: an edit inside one amount, a changed word, an insertion", () => {
    const amount = one("Limit USD 12,500 in full", "Limit USD 13,750 in full");
    expect(aligned(amount, "12,500", "13,750")).toBe(true);
    expect(edits(amount).map(([, t]) => t).join("")).toMatch(/^[\d,]+$/u);
    expect(edits(one("The deductible is USD 1,000,000 each and every loss.", "The deductible is USD 1,000,000 each and any loss."))).toEqual([["delete", "ever"], ["insert", "an"]]);
    const d = one("Cuba, Democratic People's Republic", "Cuba, Haiti, Democratic People's Republic");
    expect(edits(d)).toEqual([["insert", "Haiti, "]]);
  });
  it("spaces and stray letters do not pair unrelated words", () => {
    // Real card bizav #26 (round 11): the whole-token alignment paired the
    // spaces of an appended clause with the spaces of a deleted paragraph, and
    // the characters between with letters of unrelated words ("No li" deleted,
    // "a" kept, "bility claims" deleted). Words, numbers and punctuation anchor
    // the alignment; a space alone does not.
    const lead =
      "Loss record (five years to 31 March 2024): two hull claims, being a hangar rash incident to M-FNKD (USD 186,000) and a bird strike to M-CHLS (USD 412,500)";
    const d = one(
      `${lead}. No liability claims. Estimated annual utilisation is 5,400 flight hours across the fleet, of which approximately 35% is Charter.`,
      `${lead} and a tail strike on landing to ZJ-FLX (USD 1,260,000). No liability claims.`,
    );
    expect(edits(d)).toEqual([
      ["insert", " and a tail strike on landing to ZJ-FLX (USD 1,260,000)"],
      ["delete", ". Estimated annual utilisation is 5,400 flight hours across the fleet, of which approximately 35% is Charter"],
    ]);
  });
  it("two different words in the same place share only their common start and end", () => {
    // Real card (aviation, round 11): "Baltic Aero Technics" -> "Changi Engine
    // Centre" kept an "e" and an "n" of Technics as those of Centre.
    expect(edits(one("Maintenance is performed by Baltic Aero Technics under contract.", "Maintenance is performed by Changi Engine Centre under contract."))).toEqual([
      ["delete", "Baltic"],
      ["insert", "Changi"],
      ["delete", "Aero"],
      ["insert", "Engine"],
      ["delete", "Technics"],
      ["insert", "Centre"],
    ]);
    expect(edits(one("The limit is USD 73,150 per aircraft.", "The limit is USD 71,600 per aircraft."))).toEqual([["delete", "3,15"], ["insert", "1,60"]]);
  });
  it("the unchanged start and end of a text stop at a word boundary", () => {
    // A character-level common start paired the S of Sudan with the S of South
    // and showed "outh S" as inserted.
    expect(edits(one("Sudan, Chad and Iran are listed", "South Sudan, Chad and Iran are listed"))).toEqual([["insert", "South "]]);
    expect(edits(one("Listed are Iran, Chad and Sudan", "Listed are Iran, Chad and Sudan Republic"))).toEqual([["insert", " Republic"]]);
  });
});
