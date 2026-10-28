import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import type { CompareResult } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Lines are listed in extraction order. A wrapped cell's second line is
// extracted right after its first line, before the rest of the row, as both
// engines do for the renewal samples (e.g. "De Havilland Dash" / "8-400").
type Cell = string | [string, string];
const rows = (title: string, data: Cell[][], top = 150, pitch = 30) => [
  { text: title, y: top },
  ...data.flatMap((row, i) =>
    row.flatMap((cell, j) => {
      const x = 40 + j * 130,
        y = top + 30 + i * pitch;
      return typeof cell === "string"
        ? [{ text: cell, x, y }]
        : [
            { text: cell[0], x, y },
            { text: cell[1], x, y: y + 11 },
          ];
    }),
  ),
];
const card = (r: CompareResult, text: string) =>
  r.differences.filter((d) => (d.oldText + "\n" + d.newText).includes(text));

describe("wrapped table cells stay with their row", () => {
  it("a wrapped list cell does not become a heading that splits the table", () => {
    const doc = (iom: string, dubai: string) =>
      textDoc(
        rows("SCHEDULE OF BASES", [
          ["Isle of Man (EGNS)", "Ronaldsway Aviation", ["M-FNKA, M-FNKD,", iom], "Shared"],
          ["Dubai (OMDW)", dubai, "M-CHLS", "Shared"],
        ]),
      );
    const r = compare(
      doc("M-HELI", "Al Maktoum Hangars"),
      doc("M-FNKE, M-HELI", "Desert Falcon Hangars"),
    );
    const dubai = card(r, "Dubai (OMDW)");
    expect(dubai).toHaveLength(1);
    expect(dubai[0].kind).toBe("Replaced");
    expect(dubai[0].oldText).toContain("Al Maktoum Hangars");
    expect(dubai[0].newText).toContain("Desert Falcon Hangars");
    expect(dubai[0].structurePath?.rowKey).toBe("Dubai (OMDW)");
    const iom = card(r, "Isle of Man (EGNS)");
    expect(iom).toHaveLength(1);
    expect(iom[0].oldText).toContain("M-HELI");
    expect(iom[0].newText).toContain("M-FNKE, M-HELI");
    expect(r.differences.some((d) => d.category === "Cosmetic")).toBe(false);
  });
  it("an amount after a wrapped cell is compared on its own record", () => {
    const doc = (value: string) =>
      textDoc(
        rows("SPARE ENGINES", [
          ["CF34-10E5", "9995860", ["Hamburg Engine", "Works"], value],
          ["CF34-8C5", "1949020", ["Tallinn Aero", "Technics"], "3,620,000"],
        ]),
      );
    const r = compare(doc("6,980,000"), doc("7,100,000"));
    const changed = card(r, "6,980,000");
    expect(changed).toHaveLength(1);
    expect(changed[0].matchEvidence.method).toBe("row-identity");
    expect(changed[0].oldText).toBe("CF34-10E5 9995860 Hamburg Engine Works 6,980,000");
    expect(changed[0].newText).toBe("CF34-10E5 9995860 Hamburg Engine Works 7,100,000");
    expect(r.differences).toHaveLength(1);
  });
  it("in a compact table the next row is never taken for a wrapped line", () => {
    const doc = (beta: string) =>
      textDoc(
        rows(
          "SCHEDULE",
          [
            ["G-ALFA", "Alpha Air", "USD 1,000"],
            ["G-BETA", "Beta Air", beta],
            ["G-GAMA", "Gamma Air", "USD 3,000"],
          ],
          150,
          13,
        ),
      );
    const r = compare(doc("USD 2,000"), doc("USD 2,500"));
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].oldText).toBe("G-BETA Beta Air USD 2,000");
    expect(r.differences[0].newText).toBe("G-BETA Beta Air USD 2,500");
    expect(r.differences[0].structurePath?.rowKey).toBe("G-BETA");
  });
});

describe("identical text does not consume a record from another table", () => {
  const doc = (a: Cell[][], b: Cell[][]) =>
    textDoc([...rows("SCHEDULE A", a, 150), ...rows("SCHEDULE B", b, 400)]);
  it("an unchanged copy added to another schedule does not hide a value change", () => {
    const r = compare(
      doc(
        [
          ["MSN 1001", "Alpha Air", "USD 100,000"],
          ["MSN 2002", "Beta Air", "USD 200,000"],
        ],
        [["MSN 3003", "Gamma Air", "USD 300,000"]],
      ),
      doc(
        [
          ["MSN 1001", "Alpha Air", "USD 150,000"],
          ["MSN 2002", "Beta Air", "USD 200,000"],
        ],
        [
          ["MSN 3003", "Gamma Air", "USD 300,000"],
          ["MSN 1001", "Alpha Air", "USD 100,000"],
        ],
      ),
    );
    const changed = r.differences.find((d) => d.kind === "Replaced")!;
    expect(changed.oldText).toBe("MSN 1001 Alpha Air USD 100,000");
    expect(changed.newText).toBe("MSN 1001 Alpha Air USD 150,000");
    expect(changed.matchEvidence.method).toBe("row-identity");
    const added = r.differences.find((d) => d.kind === "Added")!;
    expect(added.newText).toBe("MSN 1001 Alpha Air USD 100,000");
    expect(added.category).toBe("Material");
    expect(r.differences).toHaveLength(2);
  });
  it("exact split/merge cannot take a row that identity evidence binds", () => {
    const r = compare(
      textDoc(
        rows("SCHEDULE A", [
          ["MSN 1001", "Alpha Air", "USD 100,000"],
          ["MSN 2002", "Beta Air", "USD 200,000"],
        ]),
      ),
      textDoc([
        ...rows("SCHEDULE A", [
          ["MSN 1001", "Alpha Air", "USD 150,000"],
          ["MSN 2002", "Beta Air", "USD 200,000"],
        ]),
        { text: "NOTES", y: 400 },
        { text: "MSN 1001 Alpha Air", y: 430 },
        { text: "USD 100,000", y: 470 },
      ]),
    );
    const changed = r.differences.find((d) => d.kind === "Replaced")!;
    expect(changed.oldText).toBe("MSN 1001 Alpha Air USD 100,000");
    expect(changed.newText).toBe("MSN 1001 Alpha Air USD 150,000");
    const added = r.differences.filter((d) => d.kind === "Added").map((d) => d.newText);
    expect(added).toEqual(expect.arrayContaining(["MSN 1001 Alpha Air", "USD 100,000"]));
  });
});
