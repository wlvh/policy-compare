import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import type { CompareResult } from "../packages/contracts/index";
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
  it("page numbers give one cosmetic card, never one card per page", () => {
    const doc = (count: number) =>
      pages(count, (p) => [
        body(p),
        { text: `Page ${p + 1} of ${count}`, x: 480, y: 800 },
      ]);
    const r = compare(doc(4), doc(5));
    const cards = furniture(r);
    expect(cards).toHaveLength(1);
    expect(cards[0].category).toBe("Cosmetic");
    expect([cards[0].oldText, cards[0].newText]).toEqual(["Page 1 of 4", "Page 1 of 5"]);
    expect(cards[0].occurrences).toHaveLength(5);
    expect(cards[0].occurrences.flatMap((o) => o.right.map((l) => l.pageIndex))).toEqual([0, 1, 2, 3, 4]);
    expect(r.differences.filter((d) => d.category === "Material")).toHaveLength(1);
    expect(r.differences.some((d) => /Page \d/.test(d.oldText + d.newText) && d.category !== "Cosmetic")).toBe(false);
  });
  it("an unchanged page number sequence produces no card", () => {
    const doc = () => pages(4, (p) => [body(p), { text: `Page ${p + 1}`, x: 480, y: 800 }]);
    expect(compare(doc(), doc()).differences).toHaveLength(0);
  });
  it("a watermark on one side only is one visible Review card with all sources", () => {
    const left = pages(5, (p) => [body(p)]),
      right = pages(5, (p) => [
        { text: "Draft", x: 450, y: 60 },
        body(p),
        { text: "Draft", x: 450, y: 820 },
      ]);
    const r = compare(left, right);
    expect(r.differences).toHaveLength(1);
    const [draft] = r.differences;
    expect([draft.kind, draft.category, draft.newText]).toEqual(["Added", "Review", "Draft"]);
    expect(draft.defaultVisible).toBe(true);
    expect(draft.occurrences).toHaveLength(10);
    expect(new Set(draft.occurrences.flatMap((o) => o.right.map((l) => l.pageIndex))).size).toBe(5);
    expect(draft.reviewReasons.join("")).toContain("待审 5 页");
    expect(draft.reviewReasons.join("")).toContain("仅待审版有");
  });
  it("a repeated header carrying a limit stays Material on one card", () => {
    const doc = (limit: string) =>
      pages(4, (p) => [{ text: `Hull limit any one aircraft USD ${limit}`, x: 40, y: 60 }, body(p)]);
    const r = compare(doc("1,000,000"), doc("2,000,000"));
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].category).toBe("Material");
    expect(r.differences[0].occurrences).toHaveLength(4);
    expect(r.differences[0].occurrences.every((o) => o.left.length && o.right.length)).toBe(true);
  });
  it("amounts that do not count with the pages are content, not furniture", () => {
    const totals = ["1,000", "2,500", "900", "4,000"];
    const doc = (second: string) =>
      pages(4, (p) => [body(p), { text: `Subtotal USD ${p === 1 ? second : totals[p]}`, x: 40, y: 800 }]);
    const r = compare(doc("2,500"), doc("2,600"));
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].oldText).toContain("Subtotal USD 2,500");
    expect(r.differences[0].newText).toContain("Subtotal USD 2,600");
    expect(r.differences[0].category).toBe("Material");
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
  it("a limit changed on one page only is a Material change with both values located", () => {
    const r = compare(
      four(() => "Hull limit any one aircraft USD 1,000,000"),
      four((p) => `Hull limit any one aircraft USD ${p === 1 ? "2,000,000" : "1,000,000"}`),
    );
    const changed = r.differences.filter((d) => d.newText.includes("2,000,000"));
    expect(changed).toHaveLength(1);
    const [d] = changed;
    expect([d.kind, d.category, d.defaultVisible]).toEqual(["Replaced", "Material", true]);
    expect(d.oldText).toContain("1,000,000");
    expect(pagesOf(d.right)).toEqual([1]);
    expect(d.left.length).toBeGreaterThan(0);
    const right = d.occurrences.flatMap((o) => o.right);
    expect(right.filter((l) => l.text.includes("2,000,000")).map((l) => l.pageIndex)).toEqual([1]);
    expect(d.textOps.some((o) => o.kind !== "equal" && o.right.some((l) => l.pageIndex === 1))).toBe(true);
    expect(r.differences.every((x) => x.category !== "Cosmetic")).toBe(true);
  });
  it("a limit on the page-number line keeps its Material change", () => {
    const r = compare(
      four((p) => `Page ${p + 1} - Hull limit USD 1,000,000`),
      four((p) => `Page ${p + 1} - Hull limit USD 2,000,000`),
    );
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].category).toBe("Material");
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
    expect(r.differences.filter((d) => d.category === "Material")).toHaveLength(1);
    expect(r.differences.filter((d) => d.category === "Material")[0].newText).toBe("Ordinary body on page 5.");
    expect(furniture(r).map((d) => d.category)).toEqual(["Cosmetic"]);
  });
  it("a page still carrying the old reference is named on the change card", () => {
    const r = compare(
      four(() => "UMR B1234AV2024"),
      four((p) => (p === 2 ? "UMR B1234AV2024" : "UMR B1234AV2025")),
    );
    expect(r.differences).toHaveLength(1);
    const [d] = r.differences;
    expect([d.kind, d.category, d.oldText, d.newText]).toEqual(["Replaced", "Review", "UMR B1234AV2024", "UMR B1234AV2025"]);
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
