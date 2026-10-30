import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2 as ResultSchema } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Review of PR #9, third round: text that is not repeated page furniture is not
// cosmetic because of where it sits or because it is in capitals. Round 8
// retired the categories: such text states no fact. Pages are
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
    ["The insurer covers war risks.", "The insurer excludes war risks."],
    ["THE INSURER COVERS WAR RISKS.", "THE INSURER EXCLUDES WAR RISKS."],
    ["HULL LIMIT USD 1,000,000", "HULL LIMIT USD 2,000,000"],
  ] as const;
  for (const y of [72, 150, 815])
    for (const [old, now] of cases)
      it(`${old} -> ${now} at y=${y} is shown with its sources and no fact`, () => {
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
        for (const d of r.differences) expect([d.facts, d.defaultVisible]).toEqual([[], true]);
        for (const l of [...was[0].left, ...is[0].right]) {
          expect(l.pageIndex).toBe(0);
          expect(l.quads[0][0]).toBe(40);
          expect(l.quads[0][1]).toBe(y - 10);
        }
        expect(was[0].left.map((l) => l.text).join("")).toBe(old);
        expect(is[0].right.map((l) => l.text).join("")).toBe(now);
      });
  it("a heading added in capitals at the top of the page states no fact", () => {
    const r = ResultSchema.parse(
      compare(
        textDoc([{ text: "Ordinary unchanged body text.", x: 40, y: 300 }]),
        page("THE INSURER EXCLUDES WAR RISKS.", 72),
      ),
    );
    expect(r.differences.map((d) => [d.kind, d.facts, d.newText])).toEqual([
      ["Added", [], "THE INSURER EXCLUDES WAR RISKS."],
    ]);
  });
});

describe("layout-only margin and heading changes state their fact", () => {
  it("unchanged margin text gives no card", () => {
    expect(run("THE INSURER COVERS WAR RISKS.", "THE INSURER COVERS WAR RISKS.", 72).differences).toHaveLength(0);
  });
  it("a footer whose page number changed: page_number_only", () => {
    const r = run("Policy wording - Page 3", "Policy wording - Page 4", 815);
    expect(r.differences.map((d) => d.facts)).toEqual([["page_number_only"]]);
  });
  it("a percentage or amount after \"page\" is no page number (Codex r4421658769)", () => {
    for (const [old, now] of [
      ["Printing cost per page 100USD", "Printing cost per page 200USD"],
      ["Cost per page 100€", "Cost per page 200€"],
      ["Page 4%", "Page 5%"],
      ["Page 4 %", "Page 5 %"],
      ["Page 3 of 10%", "Page 3 of 11%"],
      ["Cost per page 100 USD", "Cost per page 200 USD"],
    ]) {
      const r = run(old, now, 815);
      expect(r.differences.map((d) => [d.oldText, d.newText, d.facts]), old).toEqual([[old, now, []]]);
    }
    // Control: a page counter beside an unchanged total.
    expect(run("Page 3 of 10", "Page 4 of 10", 815).differences.map((d) => d.facts)).toEqual([["page_number_only"]]);
  });
  it("a continuation heading of a schedule that both versions have: continued_heading", () => {
    const schedule = (pages: number) =>
      textDoc(
        Array.from({ length: pages }, (_, p) => [
          { text: p ? "SCHEDULE OF AIRCRAFT CONTINUED" : "SCHEDULE OF AIRCRAFT", x: 40, y: 81, page: p },
          { text: `Aircraft ${p + 1} remains insured on the agreed terms.`, x: 40, y: 300, page: p },
        ]).flat(),
      );
    const r = ResultSchema.parse(compare(schedule(1), schedule(2)));
    const heading = r.differences.filter((d) => d.newText === "SCHEDULE OF AIRCRAFT CONTINUED");
    expect(heading.map((d) => [d.kind, d.facts])).toEqual([["Added", ["continued_heading"]]]);
  });
  // Review of PR #9, fourth round: the place of a page title and the extra page
  // do not show that a new title has no business meaning, so a title added on
  // a page the other version does not have is shown for review, whatever its
  // wording. (The third round kept "POLICY WORDING" cosmetic here; that
  // exemption had no evidence and also hid "WAR EXCLUSION".)
  for (const title of ["POLICY WORDING", "WAR EXCLUSION", "POLICY CANCELLED"])
    it(`a title "${title}" added on a page of its own is shown, with no fact`, () => {
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
            [[title, 81], ["LOSS PAYMENT", 135], ["The insurer pays approved losses.", 155]],
            [["SCHEDULE OF AIRCRAFT", 81], ["Aircraft one remains insured.", 200]],
          ]),
        ),
      );
      expect(r.differences.map((d) => [d.kind, d.facts, d.newText])).toEqual([["Added", [], title]]);
      expect(r.differences[0].right.map((l) => [l.pageIndex, l.text])).toEqual([[1, title]]);
    });
});
