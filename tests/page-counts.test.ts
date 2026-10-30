import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Issue #2, round 8. A repeated line whose number of occurrences changes is
// reported with both counts and both page counts; the page-count difference
// never explains it away, and nothing says which page lost or gained it. Only
// confirmed numbers of explicit page expressions ("Page n") are page numbers:
// a whole-line number counting with the pages, or one written with % or a
// currency sign, is content.
// Pages are 600 x 850; y=120 lies in the top margin band.
const run = (left: ReturnType<typeof textDoc>, right: ReturnType<typeof textDoc>): CompareResultV2 =>
  ResultSchemaV2.parse(compare(left, right));
const doc = (count: number, line: (page: number) => string | null) =>
  textDoc(
    Array.from({ length: count }, (_, page) => [
      ...(line(page) === null ? [] : [{ text: line(page)!, x: 40, y: 120, page }]),
      { text: `Clause ${page + 1} keeps the insured terms unchanged.`, x: 40, y: 400, page },
    ]).flat(),
  );
const header = (r: CompareResultV2, text: string) =>
  r.differences.filter((d) => d.oldText === text || d.newText === text);
const pagesOf = (d: CompareResultV2["differences"][number], side: "left" | "right") =>
  d.occurrences.flatMap((o) => o[side].map((l) => l.pageIndex));

describe("a change in occurrences is reported, not offset by the page count", () => {
  it("4 of 4 pages -> 3 of 5 pages: one card with both counts and every source", () => {
    const r = run(doc(4, () => "War risks excluded"), doc(5, (p) => (p < 3 ? "War risks excluded" : null)));
    const cards = header(r, "War risks excluded");
    expect(cards).toHaveLength(1);
    const [d] = cards;
    expect([d.oldText, d.newText, d.hasTextChange, d.facts]).toEqual(["War risks excluded", "War risks excluded", false, []]);
    expect(d.repeat).toEqual({ left: 4, right: 3, leftPages: 4, rightPages: 5 });
    expect([pagesOf(d, "left"), pagesOf(d, "right")]).toEqual([[0, 1, 2, 3], [0, 1, 2]]);
    expect(d.reviewReasons.join("")).toContain("这段文字出现次数：4 次 → 3 次；文档页数：4 页 → 5 页");
  });
  it("a repaginated line, 4 of 4 -> 5 of 5 pages, states its counts without a page mapping", () => {
    const r = run(doc(4, () => "War risks excluded"), doc(5, () => "War risks excluded"));
    const cards = header(r, "War risks excluded");
    expect(cards.map((d) => [d.hasTextChange, d.repeat])).toEqual([[false, { left: 4, right: 5, leftPages: 4, rightPages: 5 }]]);
    expect([pagesOf(cards[0], "left"), pagesOf(cards[0], "right")]).toEqual([[0, 1, 2, 3], [0, 1, 2, 3, 4]]);
    expect(cards[0].reviewReasons.join("")).toContain("这段文字出现次数：4 次 → 5 次；文档页数：4 页 → 5 页");
  });
  it("the same count on both sides gives no card", () => {
    const r = run(doc(4, () => "War risks excluded"), doc(4, () => "War risks excluded"));
    expect(r.differences).toHaveLength(0);
  });
});

describe("only explicit page expressions are page numbers", () => {
  for (const [name, old, now] of [
    ["percentages", (p: number) => `${p + 1}%`, (p: number) => `${p + 5}%`],
    ["currency amounts", (p: number) => `$${p + 1}`, (p: number) => `$${p + 5}`],
  ] as const)
    it(`${name} counting with the pages are content: every value shown, none a page number`, () => {
      const r = run(doc(4, old), doc(4, now));
      expect(r.differences.some((d) => d.facts.includes("page_number_only"))).toBe(false);
      for (let p = 0; p < 4; p++) {
        const was = r.differences.find((d) => d.left.some((l) => l.pageIndex === p && l.text.includes(old(p))));
        const is = r.differences.find((d) => d.right.some((l) => l.pageIndex === p && l.text.includes(now(p))));
        expect([!!was, !!is]).toEqual([true, true]);
      }
    });
  it("a whole-line number counting with the pages is content, even when it equals the page", () => {
    const r = run(doc(4, (p) => `- ${p + 1} -`), doc(5, (p) => `- ${p + 1} -`));
    expect(r.differences.some((d) => d.facts.includes("page_number_only"))).toBe(false);
    expect(r.differences.some((d) => d.kind === "Added" && d.newText.includes("- 5 -"))).toBe(true);
  });
  it("control: Page n is still a page number", () => {
    const r = run(doc(4, (p) => `Page ${p + 1} of 4`), doc(4, (p) => `Page ${p + 1} of 5`));
    expect(r.differences.map((d) => [d.facts, d.repeat])).toEqual([[["page_number_only"], { left: 4, right: 4, leftPages: 4, rightPages: 4 }]]);
  });
});
