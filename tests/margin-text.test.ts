import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchema } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Review of PR #9, third round: text that is not repeated page furniture is not
// cosmetic because of where it sits or because it is in capitals. Pages are
// 600 x 850: y=72 is a page heading, y=815 a footer, y=150 the page body.
const page = (text: string, y: number) =>
  textDoc([
    { text, x: 40, y },
    { text: "Ordinary unchanged body text.", x: 40, y: 300 },
  ]);
const run = (old: string, now: string, y: number) =>
  ResultSchema.parse(compare(page(old, y), page(now, y)));

describe("a changed margin or heading line is compared as content", () => {
  const cases = [
    ["The insurer covers war risks.", "The insurer excludes war risks.", "Review"],
    ["THE INSURER COVERS WAR RISKS.", "THE INSURER EXCLUDES WAR RISKS.", "Review"],
    ["HULL LIMIT USD 1,000,000", "HULL LIMIT USD 2,000,000", "Material"],
  ] as const;
  for (const y of [72, 150, 815])
    for (const [old, now, expected] of cases)
      it(`${old} -> ${now} at y=${y} is ${expected}`, () => {
        const r = run(old, now, y);
        expect(r.status).toBe("complete_for_scope");
        // A changed heading is its own title context, so it may be shown as
        // removed and added rather than replaced; either way both texts are.
        const was = r.differences.filter((d) => d.oldText === old),
          is = r.differences.filter((d) => d.newText === now);
        expect([was.length, is.length]).toEqual([1, 1]);
        expect(r.differences).toHaveLength(was[0] === is[0] ? 1 : 2);
        expect(
          was[0] === is[0] ? [was[0].kind] : [was[0].kind, is[0].kind],
        ).toEqual(was[0] === is[0] ? ["Replaced"] : ["Removed", "Added"]);
        for (const d of r.differences) expect([d.category, d.defaultVisible]).toEqual([expected, true]);
        for (const l of [...was[0].left, ...is[0].right]) {
          expect(l.pageIndex).toBe(0);
          expect(l.quads[0][0]).toBe(40);
          expect(l.quads[0][1]).toBe(y - 10);
        }
        expect(was[0].left.map((l) => l.text).join("")).toBe(old);
        expect(is[0].right.map((l) => l.text).join("")).toBe(now);
      });
  it("a heading added in capitals at the top of the page is not cosmetic", () => {
    const r = ResultSchema.parse(
      compare(
        textDoc([{ text: "Ordinary unchanged body text.", x: 40, y: 300 }]),
        page("THE INSURER EXCLUDES WAR RISKS.", 72),
      ),
    );
    expect(r.differences.map((d) => [d.kind, d.category, d.newText])).toEqual([
      ["Added", "Review", "THE INSURER EXCLUDES WAR RISKS."],
    ]);
  });
});

describe("layout-only margin and heading changes stay cosmetic", () => {
  it("unchanged margin text gives no card", () => {
    expect(run("THE INSURER COVERS WAR RISKS.", "THE INSURER COVERS WAR RISKS.", 72).differences).toHaveLength(0);
  });
  it("a footer whose page number changed is cosmetic", () => {
    const r = run("Policy wording - Page 3", "Policy wording - Page 4", 815);
    expect(r.differences.map((d) => d.category)).toEqual(["Cosmetic"]);
  });
  it("a continuation heading of a schedule that both versions have is cosmetic", () => {
    const schedule = (pages: number) =>
      textDoc(
        Array.from({ length: pages }, (_, p) => [
          { text: p ? "SCHEDULE OF AIRCRAFT CONTINUED" : "SCHEDULE OF AIRCRAFT", x: 40, y: 81, page: p },
          { text: `Aircraft ${p + 1} remains insured on the agreed terms.`, x: 40, y: 300, page: p },
        ]).flat(),
      );
    const r = ResultSchema.parse(compare(schedule(1), schedule(2)));
    const heading = r.differences.filter((d) => d.newText === "SCHEDULE OF AIRCRAFT CONTINUED");
    expect(heading.map((d) => [d.kind, d.category])).toEqual([["Added", "Cosmetic"]]);
  });
  it("the title of a page added by repagination is cosmetic only with running-title evidence", () => {
    // Every page of both versions has its title at the same place; the new
    // version moves the wording to a page of its own.
    const doc = (pages: [string, number][][]) =>
      textDoc(pages.flatMap((lines, page) => lines.map(([text, y]) => ({ text, x: 40, y, page }))));
    const r = ResultSchema.parse(
      compare(
        doc([
          [["POLICY SCHEDULE", 81], ["The schedule lists the insured aircraft.", 200], ["LOSS PAYMENT", 400], ["The insurer pays approved losses.", 420]],
          [["SCHEDULE OF AIRCRAFT", 81], ["Aircraft one remains insured.", 200]],
        ]),
        doc([
          [["POLICY SCHEDULE", 81], ["The schedule lists the insured aircraft.", 200]],
          [["POLICY WORDING", 81], ["LOSS PAYMENT", 135], ["The insurer pays approved losses.", 155]],
          [["SCHEDULE OF AIRCRAFT", 81], ["Aircraft one remains insured.", 200]],
        ]),
      ),
    );
    const title = r.differences.filter((d) => d.newText === "POLICY WORDING");
    expect(title.map((d) => [d.kind, d.category])).toEqual([["Added", "Cosmetic"]]);
    // Without a title on every page, the same added line is shown for review.
    const loose = ResultSchema.parse(
      compare(
        doc([[["The insurer pays approved losses.", 400]]]),
        doc([[["The insurer pays approved losses.", 400]], [["POLICY WORDING", 81], ["Aircraft one remains insured.", 200]]]),
      ),
    );
    expect(loose.differences.find((d) => d.newText === "POLICY WORDING")?.category).toBe("Review");
  });
});
