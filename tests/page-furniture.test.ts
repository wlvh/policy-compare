import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2 as ResultSchema, type CompareResultV2 as CompareResult, type SourceLocation } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Pages are 600 x 850; the margin bands are above y=136 and below y=748.
type Line = { text: string; x?: number; y: number };
const pages = (count: number, each: (page: number) => Line[]) =>
  textDoc(
    Array.from({ length: count }, (_, page) =>
      each(page).map((l) => ({ ...l, page })),
    ).flat(),
  );
const body = (page: number): Line => ({
  text: `Clause ${page + 1} applies to all aircraft in the schedule`,
  x: 40,
  y: 300,
});
const furniture = (r: CompareResult) =>
  r.differences.filter((d) => d.structurePath?.section === "page_furniture");

describe("page furniture is compared once, with every occurrence", () => {
  it("page numbers give one page_number_only card, never one card per page", () => {
    const doc = (count: number) =>
      pages(count, (p) => [
        body(p),
        { text: `Page ${p + 1} of ${count}`, x: 480, y: 800 },
      ]);
    const r = compare(doc(4), doc(5));
    const cards = furniture(r);
    expect(cards).toHaveLength(1);
    expect(cards[0].facts).toEqual(["page_number_only"]);
    expect([cards[0].oldText, cards[0].newText]).toEqual(["Page 1 of 4", "Page 1 of 5"]);
    expect(cards[0].occurrences).toHaveLength(5);
    expect(cards[0].occurrences.flatMap((o) => o.right.map((l) => l.pageIndex))).toEqual([0, 1, 2, 3, 4]);
    expect(r.differences.filter((d) => d.facts.length === 0)).toHaveLength(1);
    expect(r.differences.some((d) => /Page \d/.test(d.oldText + d.newText) && !d.facts.includes("page_number_only"))).toBe(false);
  });
  it("an unchanged page number sequence produces no card", () => {
    const doc = () => pages(4, (p) => [body(p), { text: `Page ${p + 1}`, x: 480, y: 800 }]);
    expect(compare(doc(), doc()).differences).toHaveLength(0);
  });
  it("a watermark on one side only is one visible card with all sources", () => {
    const left = pages(5, (p) => [body(p)]),
      right = pages(5, (p) => [
        { text: "Draft", x: 450, y: 60 },
        body(p),
        { text: "Draft", x: 450, y: 820 },
      ]);
    const r = compare(left, right);
    expect(r.differences).toHaveLength(1);
    const [draft] = r.differences;
    expect([draft.kind, draft.facts, draft.newText]).toEqual(["Added", [], "Draft"]);
    expect(draft.defaultVisible).toBe(true);
    expect(draft.occurrences).toHaveLength(10);
    expect(new Set(draft.occurrences.flatMap((o) => o.right.map((l) => l.pageIndex))).size).toBe(5);
    expect(draft.repeat).toEqual({ left: 0, right: 10, leftPages: 5, rightPages: 5 });
    expect(draft.reviewReasons.join("")).toContain("这段文字出现次数：0 次 → 10 次；文档页数：5 页 → 5 页");
  });
  it("a repeated header carrying a limit is one card", () => {
    const doc = (limit: string) =>
      pages(4, (p) => [{ text: `Hull limit any one aircraft USD ${limit}`, x: 40, y: 60 }, body(p)]);
    const r = compare(doc("1,000,000"), doc("2,000,000"));
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].facts).toEqual([]);
    expect(r.differences[0].occurrences).toHaveLength(4);
    expect(r.differences[0].occurrences.every((o) => o.left.length && o.right.length)).toBe(true);
  });
  it("a repeated header limit written against its currency code is compared as content", () => {
    const doc = (limit: string) => pages(4, (p) => [{ text: `Hull limit USD${limit}`, x: 40, y: 60 }, body(p)]);
    const r = compare(doc("1000000"), doc("2000000"));
    expect(r.differences.map((d) => [d.kind, d.facts, d.oldText, d.newText])).toEqual([
      ["Replaced", [], "Hull limit USD1000000", "Hull limit USD2000000"],
    ]);
  });
  it("amounts that do not count with the pages are content, not furniture", () => {
    const totals = ["1,000", "2,500", "900", "4,000"];
    const doc = (second: string) =>
      pages(4, (p) => [body(p), { text: `Subtotal USD ${p === 1 ? second : totals[p]}`, x: 40, y: 800 }]);
    const r = compare(doc("2,500"), doc("2,600"));
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].oldText).toContain("Subtotal USD 2,500");
    expect(r.differences[0].newText).toContain("Subtotal USD 2,600");
    expect(r.differences[0].facts).toEqual([]);
    expect(r.differences[0].structurePath?.section).not.toBe("page_furniture");
  });
});

describe("a table header repeated on each page is not an identity conflict", () => {
  const doc = (value: string) =>
    pages(3, (p) => [
      ...["Registration", "Operator", "Agreed Value"].map((text, j) => ({ text, x: 40 + j * 150, y: 200 })),
      ...[0, 1].flatMap((k) =>
        [`G-AB${p}${k}`, `Operator ${"ABCDEF"[p * 2 + k]}`, p === 1 && k === 0 ? value : `USD ${p + 1},${k}00,000`].map(
          (text, j) => ({ text, x: 40 + j * 150, y: 230 + k * 30 }),
        ),
      ),
    ]);
  it("unchanged headers pair silently and a value change keeps its row", () => {
    const r = compare(doc("USD 2,000,000"), doc("USD 2,400,000"));
    expect(r.unresolved).toHaveLength(0);
    expect(r.status).toBe("complete_for_scope");
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].oldText).toBe("G-AB10 Operator C USD 2,000,000");
    expect(r.differences[0].newText).toBe("G-AB10 Operator C USD 2,400,000");
  });
});

// Review of PR #9: a repeated line whose text differs between occurrences
// must not be judged by its first occurrence, and only confirmed page-number
// parts are exempt from content classification.
describe("variants inside a repeated line stay visible", () => {
  const four = (header: (page: number) => string) =>
    pages(4, (p) => [
      { text: header(p), x: 40, y: 60 },
      { text: `Ordinary body on page ${p + 1}`, x: 40, y: 300 },
    ]);
  const pagesOf = (locs: { pageIndex: number }[]) => [...new Set(locs.map((l) => l.pageIndex))].sort();
  it("a limit changed on one page only is a change with both values located", () => {
    const r = compare(
      four(() => "Hull limit any one aircraft USD 1,000,000"),
      four((p) => `Hull limit any one aircraft USD ${p === 1 ? "2,000,000" : "1,000,000"}`),
    );
    const changed = r.differences.filter((d) => d.newText.includes("2,000,000"));
    expect(changed).toHaveLength(1);
    const [d] = changed;
    expect([d.kind, d.facts, d.defaultVisible]).toEqual(["Replaced", [], true]);
    expect(d.oldText).toContain("1,000,000");
    expect(pagesOf(d.right)).toEqual([1]);
    expect(d.left.length).toBeGreaterThan(0);
    const right = d.occurrences.flatMap((o) => o.right);
    expect(right.filter((l) => l.text.includes("2,000,000")).map((l) => l.pageIndex)).toEqual([1]);
    expect(d.textOps.some((o) => o.kind !== "equal" && o.right.some((l) => l.pageIndex === 1))).toBe(true);
    expect(r.differences.every((x) => x.facts.length === 0)).toBe(true);
  });
  it("a limit on the page-number line keeps its change", () => {
    const r = compare(
      four((p) => `Page ${p + 1} - Hull limit USD 1,000,000`),
      four((p) => `Page ${p + 1} - Hull limit USD 2,000,000`),
    );
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].facts).toEqual([]);
    expect(r.differences[0].oldText).toContain("1,000,000");
    expect(r.differences[0].newText).toContain("2,000,000");
    expect(r.differences[0].occurrences).toHaveLength(4);
  });
  it("only the page number changing on that line stays noise-free", () => {
    const doc = (count: number) =>
      pages(count, (p) => [
        { text: `Page ${p + 1} of ${count} - Hull limit USD 1,000,000`, x: 40, y: 60 },
        { text: `Ordinary body on page ${p + 1}.`, x: 40, y: 300 },
      ]);
    const r = compare(doc(4), doc(5));
    expect(r.differences.filter((d) => d.facts.length === 0)).toHaveLength(1);
    expect(r.differences.filter((d) => d.facts.length === 0)[0].newText).toBe("Ordinary body on page 5.");
    expect(furniture(r).map((d) => d.facts)).toEqual([["page_number_only"]]);
  });
  it("a page still carrying the old reference is named on the change card", () => {
    const r = compare(
      four(() => "UMR B1234AV2024"),
      four((p) => (p === 2 ? "UMR B1234AV2024" : "UMR B1234AV2025")),
    );
    expect(r.differences).toHaveLength(1);
    const [d] = r.differences;
    expect([d.kind, d.facts, d.oldText, d.newText]).toEqual(["Replaced", [], "UMR B1234AV2024", "UMR B1234AV2025"]);
    // The change itself points only at pages that changed ...
    expect(pagesOf(d.right)).not.toContain(2);
    const right = d.occurrences.flatMap((o) => o.right);
    expect(right.filter((l) => l.text === "UMR B1234AV2025").map((l) => l.pageIndex)).toEqual([0, 1, 3]);
    // ... while the page that kept the old text is named and reachable.
    expect(d.reviewReasons.join("")).toMatch(/待审版第 3 页仍为基准版文字“UMR B1234AV2024”/);
    expect(right.filter((l) => l.text === "UMR B1234AV2024").map((l) => l.pageIndex)).toEqual([2]);
    expect(d.occurrences.flatMap((o) => o.left).map((l) => l.pageIndex)).toEqual([0, 1, 2, 3]);
  });
});

// Review of PR #9, third round: a repeated line keeps its own horizontal place
// across versions, and only an actual page-number expression is exempt.
describe("a repeated line keeps its place, and only real page numbers are exempt", () => {
  const withBody = (count: number, rows: (page: number, count: number) => Line[]) =>
    pages(count, (p) => [...rows(p, count), { text: `Ordinary body on page ${p + 1}`, x: 40, y: 300 }]);
  const x = (l: SourceLocation) => l.quads[0][0];
  const about = (r: CompareResult, text: string) =>
    r.differences.filter((d) => (d.oldText + d.newText).includes(text));
  it("A: amounts swapped between two places are two changes, each at its own place", () => {
    const doc = (first: string, second: string) =>
      withBody(4, () => [
        { text: first, x: 40, y: 60 },
        { text: second, x: 300, y: 60 },
      ]);
    const r = ResultSchema.parse(compare(doc("USD 1000", "USD 2000"), doc("USD 2000", "USD 1000")));
    expect(r.status).toBe("complete_for_scope");
    expect(r.differences).toHaveLength(2);
    for (const [place, old, now] of [
      [40, "USD 1000", "USD 2000"],
      [300, "USD 2000", "USD 1000"],
    ] as const) {
      const d = r.differences.find((d) => d.oldText === old)!;
      expect([d.kind, d.facts, d.newText, d.defaultVisible]).toEqual(["Replaced", [], now, true]);
      expect(d.structurePath?.section).toBe("page_furniture");
      const sources = d.occurrences.flatMap((o) => [...o.left, ...o.right]);
      expect(sources).toHaveLength(8);
      expect(sources.every((l) => Math.abs(x(l) - place) < 1)).toBe(true);
      expect([...d.left, ...d.right].every((l) => Math.abs(x(l) - place) < 1)).toBe(true);
      expect(d.occurrences.flatMap((o) => o.right).map((l) => l.pageIndex)).toEqual([0, 1, 2, 3]);
    }
  });
  it("B: a rate equal to the page total stays content; only the page expression is exempt", () => {
    const doc = (count: number, rate: string) =>
      withBody(count, (p, n) => [{ text: `Premium rate ${rate} - Page ${p + 1} of ${n}`, x: 40, y: 60 }]);
    const r = ResultSchema.parse(compare(doc(4, "4%"), doc(5, "5%")));
    const rate = about(r, "Premium rate");
    expect(rate).toHaveLength(1);
    expect([rate[0].kind, rate[0].facts]).toEqual(["Replaced", []]);
    expect([rate[0].oldText, rate[0].newText]).toEqual(["Premium rate 4% - Page 1 of 4", "Premium rate 5% - Page 1 of 5"]);
    expect(rate[0].occurrences.flatMap((o) => o.left).map((l) => l.pageIndex)).toEqual([0, 1, 2, 3]);
    expect(rate[0].occurrences.flatMap((o) => o.right).map((l) => l.pageIndex)).toEqual([0, 1, 2, 3, 4]);
    // Control: the same rate with only the page numbers changing is noise-free.
    const same = ResultSchema.parse(compare(doc(4, "4%"), doc(5, "4%")));
    expect(about(same, "Premium rate").map((d) => d.facts)).toEqual([["page_number_only"]]);
  });
  it("C: business numbers that count with the pages are compared as content", () => {
    const doc = (first: number) => withBody(4, (p) => [{ text: `Aircraft MSN ${first + p}`, x: 40, y: 120 }]);
    const r = ResultSchema.parse(compare(doc(101), doc(201)));
    const msn = about(r, "Aircraft MSN");
    expect(msn.some((d) => d.facts.length > 0)).toBe(false);
    // The body line above continues across the page break onto the next
    // line, so a card may hold both; each MSN is still changed on its page.
    expect(msn).toHaveLength(4);
    for (let p = 0; p < 4; p++) {
      const d = msn.find((d) => d.oldText.endsWith(`Aircraft MSN ${101 + p}`))!;
      expect([d.kind, d.facts]).toEqual(["Replaced", []]);
      expect(d.newText).toBe(d.oldText.replace(`MSN ${101 + p}`, `MSN ${201 + p}`));
      for (const [side, value] of [[d.left, 101 + p], [d.right, 201 + p]] as const) {
        const at = side.filter((l) => l.text.includes(`MSN ${value}`));
        expect(at.map((l) => [l.pageIndex, Math.round(x(l))])).toEqual([[p, 40]]);
      }
    }
    // Control: a page number at the same place is still exempt.
    const numbered = ResultSchema.parse(
      compare(
        withBody(4, (p) => [{ text: `Page ${p + 1}`, x: 40, y: 120 }]),
        withBody(5, (p) => [{ text: `Page ${p + 1}`, x: 40, y: 120 }]),
      ),
    );
    // Round 8: the extra page's occurrence is reported as a count change, not
    // explained by the page count.
    expect(about(numbered, "Page ").map((d) => [d.hasTextChange, d.facts, d.repeat])).toEqual([
      [false, [], { left: 4, right: 5, leftPages: 4, rightPages: 5 }],
    ]);
  });
});
