import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2 as ResultSchema, type CompareResultV2 as CompareResult } from "../packages/contracts/index";
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
  for (const columns of [3, 4])
    it(`all ${columns} cells wrapping leaves the local row boundary unresolved`, () => {
      const data: Cell[][] = columns === 3
        ? [["MSN", "Operator", "Value"], [["123", "(a)"], ["Alpha Air", "Holdings"], ["USD 1000", "per annum"]], ["456", "Beta", "USD 2000"]]
        : [["MSN", "Operator", "Cover", "Value"], [["123", "(a)"], ["Alpha Air", "Holdings"], ["Hull and", "war risks"], ["USD 1000", "per annum"]], ["456", "Beta", "Hull", "USD 2000"]];
      const a = textDoc(rows("SCHEDULE", data));
      const revised = structuredClone(data);
      revised[1][columns - 1] = ["USD 1000", "per month"];
      // A normal independent row still gets a definite identity.
      revised[2][columns - 1] = "USD 2500";
      for (const [l, r] of [[a, textDoc(rows("SCHEDULE", revised))], [textDoc(rows("SCHEDULE", revised)), a]]) {
        const result = ResultSchema.parse(compare(l, r));
        expect(result.status).toBe("partial");
        const open = result.unresolved.filter((u) => u.reason === "ambiguous_identity");
        expect(open.length).toBeGreaterThan(0);
        expect(JSON.stringify(open)).toContain("(a)");
        expect(card(result, "per annum").length).toBeGreaterThan(0);
        expect(card(result, "per annum").every((d) => !d.structurePath?.rowKey && d.structurePath?.confidence === "unresolved")).toBe(true);
        expect(card(result, "USD 2000").map((d) => d.structurePath?.rowKey)).toEqual(["456"]);
      }
    });
  for (const label of ["2026 Share %", "2026 Value USD", "2026 Value €"])
    it(`a unit-bearing heading closes the prior table: ${label}`, () => {
      const doc = (first: string[], second: string[]) => textDoc(rows("SCHEDULE", [
        ["MSN", "Operator", "Value"], first,
        ["Registration", "Model", label], second,
      ]));
      const result = compare(doc(["123", "Alpha", "USD 100"], ["456", "Beta", "10%"]),
        doc(["789", "Gamma", "USD 300"], ["123", "Delta", "20%"]));
      expect(result.differences.some((d) => d.oldText.includes("Alpha") && d.newText.includes("Delta"))).toBe(false);
      expect(result.differences.map((d) => d.oldText + d.newText).join(" ")).toContain("Delta");
    });
  // A bases table names no identifier column, so its rows pair only by equal
  // text (round 8); each changed row is shown whole on its own side.
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
    expect(r.differences.map((d) => [d.kind, d.oldText, d.newText]).sort()).toEqual([
      ["Added", "", "Dubai (OMDW) Desert Falcon Hangars M-CHLS Shared"],
      ["Added", "", "Isle of Man (EGNS) Ronaldsway Aviation M-FNKA, M-FNKD, M-FNKE, M-HELI Shared"],
      ["Removed", "Dubai (OMDW) Al Maktoum Hangars M-CHLS Shared", ""],
      ["Removed", "Isle of Man (EGNS) Ronaldsway Aviation M-FNKA, M-FNKD, M-HELI Shared", ""],
    ]);
    expect(r.differences.some((d) => d.facts.length > 0)).toBe(false);
  });
  it("an amount after a wrapped cell is compared on its own record", () => {
    const doc = (value: string) =>
      textDoc(
        rows("SPARE ENGINES", [
          ["Engine Type", "ESN", "Location", "Value"],
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
            ["Registration", "Operator", "Value"],
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
  it("a compact table extracted column by column gives the same rows (r4421114827)", () => {
    // MSN | Operator | Value over 123 | Alpha | USD 1000 and 456 | Beta | USD 2000, baselines
    // 13 apart: listed column by column, each record's cell follows the cell above it.
    const data = [
      ["MSN", "Operator", "Value"],
      ["123", "Alpha", "USD 1000"],
      ["456", "Beta", "USD 2000"],
    ];
    const at = (i: number, k: number) => ({ text: data[i][k], x: 40 + k * 150, y: 180 + i * 13 });
    const byRow = textDoc([{ text: "SCHEDULE", y: 150 }, ...data.flatMap((row, i) => row.map((_, k) => at(i, k)))]),
      byColumn = textDoc([{ text: "SCHEDULE", y: 150 }, ...data[0].flatMap((_, k) => data.map((_, i) => at(i, k)))]);
    expect(compare(byColumn, byRow).differences).toEqual([]);
    expect(compare(byRow, byColumn).differences).toEqual([]);
    // A changed value is reported on its own record whichever order the lines come in.
    const changed = textDoc([{ text: "SCHEDULE", y: 150 }, ...data.flatMap((row, i) => row.map((_, k) => (i === 2 && k === 2 ? { ...at(i, k), text: "USD 2500" } : at(i, k))))]);
    const r = compare(byColumn, changed);
    expect(r.differences.map((d) => [d.oldText, d.newText])).toEqual([["456 Beta USD 2000", "456 Beta USD 2500"]]);
  });
  it("a record wrapping three of its four cells keeps the wrapped line (#11 README 0.58, regression of r4421114827)", () => {
    // MSN | Operator | Cover | Value; record 123 wraps Operator, Cover and Value 11 below, each
    // cell's two lines extracted together. The wrapped line has three clusters but no MSN cell.
    const doc = (last: string) =>
      textDoc([
        ...["MSN", "Operator", "Cover", "Value"].map((text, k) => ({ text, x: [40, 150, 290, 430][k], y: 180 })),
        { text: "123", x: 40, y: 195 },
        { text: "Alpha Air", x: 150, y: 195 }, { text: "Holdings", x: 150, y: 206 },
        { text: "Hull and", x: 290, y: 195 }, { text: "war risks", x: 290, y: 206 },
        { text: "USD 1000", x: 430, y: 195 }, { text: last, x: 430, y: 206 },
        ...["456", "Beta", "Hull", "USD 2000"].map((text, k) => ({ text, x: [40, 150, 290, 430][k], y: 225 })),
      ]);
    const r = compare(doc("per annum"), doc("per month"));
    expect(r.differences.map((d) => [d.kind, d.structurePath?.rowKey])).toEqual([["Replaced", "123"]]);
    expect(r.differences[0].newText).toBe("123 Alpha Air Holdings Hull and war risks USD 1000 per month");
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
    expect(added.facts).toEqual([]);
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

describe("cells centred on their row (LibreOffice, spreadsheets)", () => {
  // A two-line cell centred on the row has one line above and one below the
  // baseline of the single-line cells; lines are in extraction order.
  const row = (y: number, cells: (string | [string, string])[]) =>
    cells.flatMap((cell, j) => {
      const x = 40 + j * 110;
      return typeof cell === "string"
        ? [{ text: cell, x, y }]
        : [
            { text: cell[0], x, y: y - 5 },
            { text: cell[1], x, y: y + 6 },
          ];
    });
  const doc = (lessee: [string, string], insurer: [string, string]) =>
    textDoc([
      { text: "SCHEDULE OF AIRCRAFT", y: 150 },
      ...row(165, ["Aircraft Type", "MSN", "Registration", "Agreed Value", "Lessee"]),
      ...row(190, [["De Havilland", "Dash 8-400"], "4370", "CC-LUV", "10,270,000", "Lumen Air"]),
      ...row(225, [["De Havilland", "Dash 8-400"], "4551", "C-MRP", "12,680,000", lessee]),
      ...row(260, [["De Havilland", "Dash 8-400"], "4582", "C-YVR", "12,880,000", "Kestrel Air"]),
      { text: "WRITTEN LINES", y: 320 },
      ...row(335, ["Insurer", "Reference", "Line", "Stamp Date"]),
      ...row(360, [["Halberd Specialty", "Insurance Ltd"], ["HSI-AV-24-", "0117"], "15.0%", "08/10/2024"]),
      ...row(395, [insurer, ["CIA-AV-25-", "0311"], "10.0%", "04/10/2024"]),
    ]);
  it("a change in a centred cell stays on its record and nothing else changes", () => {
    const r = compare(
      doc(["Kestrel", "Connect"], ["Corvane", "Insurance AG"]),
      doc(["Coral Bay", "Regional Airways"], ["Corvane", "Insurance AG"]),
    );
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].oldText).toBe("De Havilland Dash 8-400 4551 C-MRP 12,680,000 Kestrel Connect");
    expect(r.differences[0].newText).toBe("De Havilland Dash 8-400 4551 C-MRP 12,680,000 Coral Bay Regional Airways");
    expect(r.differences[0].matchEvidence.method).toBe("row-identity");
  });
  it("adjacent centred cells join the row through each other", () => {
    const r = compare(
      doc(["Kestrel", "Connect"], ["Corvane", "Insurance AG"]),
      doc(["Kestrel", "Connect"], ["Corvane", "Re AG"]),
    );
    // The insurer is the identity of a written line, and it changed: the
    // whole row is shown on each side, nothing else changes.
    expect(r.differences.map((d) => [d.kind, d.oldText, d.newText])).toEqual([
      ["Removed", "Corvane Insurance AG CIA-AV-25- 0311 10.0% 04/10/2024", ""],
      ["Added", "", "Corvane Re AG CIA-AV-25- 0311 10.0% 04/10/2024"],
    ]);
  });
});

describe("identity cells keep their recovered column (review of PR #9)", () => {
  const row = (cells: string[]) =>
    textDoc([
      { text: "SCHEDULE", x: 40, y: 150 },
      ...cells.map((text, j) => ({ text, x: 40 + j * 170, y: 200 })),
    ]);
  it("a name that moved to another column does not make two records one", () => {
    const r = compare(row(["MSN 100", "10%", "Beta Air"]), row(["MSN 300", "Beta Air", "20%"]));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect(
      r.differences.some(
        (d) => d.oldText.includes("MSN 100") && d.newText.includes("MSN 300") && d.structurePath?.confidence !== "unresolved",
      ),
    ).toBe(false);
    const removed = r.differences.find((d) => d.kind === "Removed" && d.oldText.includes("MSN 100"));
    const added = r.differences.find((d) => d.kind === "Added" && d.newText.includes("MSN 300"));
    expect(Boolean((removed && added) || r.unresolved.length)).toBe(true);
  });
});

// Review of PR #11 (owned by issue #2): an amount, or a bare number without a
// local identity header, does not make two records one.
describe("amounts and unexplained bare numbers are not record identity", () => {
  const table = (header: string[] | null, cells: string[]) =>
    textDoc([
      { text: "SCHEDULE", x: 40, y: 150 },
      ...(header ?? []).map((text, j) => ({ text, x: 40 + j * 180, y: 180 })),
      ...cells.map((text, j) => ({ text, x: 40 + j * 180, y: 220 })),
    ]);
  const separate = (r: CompareResult, old: string, now: string) => {
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect(
      r.differences.some(
        (d) => d.oldText.includes(old) && d.newText.includes(now) && d.structurePath?.confidence !== "unresolved",
      ),
    ).toBe(false);
    const removed = r.differences.find((d) => d.kind === "Removed" && d.oldText.includes(old)),
      added = r.differences.find((d) => d.kind === "Added" && d.newText.includes(now));
    if (removed && added) {
      expect(removed.left.map((l) => l.text).join(" ")).toContain(old);
      expect(added.right.map((l) => l.text).join(" ")).toContain(now);
      expect([removed.facts, added.facts]).toEqual([[], []]);
    } else expect(r.unresolved.some((u) => u.reason === "ambiguous_identity")).toBe(true);
  };
  for (const header of [null, ["Insured", "Reference", "Limit"]])
    for (const amount of ["100000", "JPY 100000"])
      it(`an equal ${amount} does not bind two companies${header ? " under a header" : ""}`, () => {
        const r = ResultSchema.parse(
          compare(table(header, ["Alpha Air", "A-1", amount]), table(header, ["Delta Air", "D-1", amount])),
        );
        separate(r, "Alpha Air", "Delta Air");
        expect(r.differences.some((d) => d.structurePath?.rowKey?.includes("100000"))).toBe(false);
      });
  it("an equal value does not bind two different MSNs in an all-number row", () => {
    const header = ["MSN", "Agreed Value", "Rate"];
    const r = ResultSchema.parse(
      compare(table(header, ["1315", "100000", "0.38%"]), table(header, ["2156", "100000", "0.40%"])),
    );
    separate(r, "1315", "2156");
  });
  // Review of PR #9, fourth round: an amount written against its currency code
  // and a date are values, never identity.
  for (const header of [null, ["Insured", "Reference", "Limit"]])
    for (const value of ["USD100000", "100000JPY", "2025-01-01", "1 January 2025"])
      it(`an equal ${value} does not bind two companies${header ? " under a header" : ""}`, () => {
        const r = ResultSchema.parse(
          compare(table(header, ["Alpha Air", "A-1", value]), table(header, ["Delta Air", "D-1", value])),
        );
        separate(r, "Alpha Air", "Delta Air");
        expect(r.differences.some((d) => d.structurePath?.rowKey === value)).toBe(false);
      });
  it("a registration that contains a currency code still identifies the record", () => {
    const header = ["Registration", "Operator", "Agreed Value"];
    const r = ResultSchema.parse(
      compare(
        table(header, ["VH-AUD", "Alpha Air", "USD 100,000"]),
        table(header, ["VH-AUD", "Delta Air", "USD 200,000"]),
      ),
    );
    expect(r.differences).toHaveLength(1);
    expect([r.differences[0].matchEvidence.method, r.differences[0].structurePath?.rowKey]).toEqual(["row-identity", "VH-AUD"]);
  });
  it("a bare MSN under its local MSN header still identifies the record", () => {
    const header = ["MSN", "Operator", "Agreed Value"];
    const r = ResultSchema.parse(
      compare(table(header, ["1315", "Alpha Air", "100000"]), table(header, ["1315", "Delta Air", "200000"])),
    );
    expect(r.status).toBe("complete_for_scope");
    expect(r.differences).toHaveLength(1);
    const [d] = r.differences;
    expect([d.kind, d.facts, d.matchEvidence.method]).toEqual(["Replaced", [], "row-identity"]);
    expect([d.oldText, d.newText]).toEqual(["1315 Alpha Air 100000", "1315 Delta Air 200000"]);
    expect(d.structurePath?.rowKey).toBe("1315");
  });
});

// Review of PR #9, fourth round: a first column counting 01, 02 is a row number
// only when its local heading does not name it as the record's own number.
// Round 8: only identity columns pair rows, so the MSN pairs its row and the
// operator name is a changed cell of that record, never a link across MSNs.
describe("an explicitly headed MSN column is not a row counter", () => {
  const table = (header: string[], data: string[][]) =>
    textDoc([
      { text: "SCHEDULE", x: 40, y: 150 },
      ...header.map((text, j) => ({ text, x: 40 + j * 180, y: 180 })),
      ...data.flatMap((cells, i) => cells.map((text, j) => ({ text, x: 40 + j * 180, y: 220 + i * 35 }))),
    ]);
  for (const [one, two] of [["01", "02"], ["1", "2"]])
    it(`MSN ${one} and ${two} kept while the names swap: each row stays on its MSN`, () => {
      const header = ["MSN", "Operator", "Share"];
      const r = ResultSchema.parse(
        compare(
          table(header, [[one, "Alpha", "10%"], [two, "Beta", "20%"]]),
          table(header, [[one, "Beta", "10%"], [two, "Alpha", "20%"]]),
        ),
      );
      expect(r.differences.map((d) => [d.matchEvidence.method, d.structurePath?.rowKey, d.oldText, d.newText])).toEqual([
        ["row-identity", one, `${one} Alpha 10%`, `${one} Beta 10%`],
        ["row-identity", two, `${two} Beta 20%`, `${two} Alpha 20%`],
      ]);
      expect(r.status).toBe("complete_for_scope");
    });
  it("a No. column counting 1..n is still a row number when a row is inserted", () => {
    const header = ["No.", "Hangar", "Value"];
    const r = ResultSchema.parse(
      compare(
        table(header, [["1", "Alpha Hangar", "USD 100,000"], ["2", "Beta Hangar", "USD 200,000"]]),
        table(header, [["1", "Alpha Hangar", "USD 100,000"], ["2", "Delta Hangar", "USD 250,000"], ["3", "Beta Hangar", "USD 200,000"]]),
      ),
    );
    const added = r.differences.find((d) => d.kind === "Added" && d.newText.includes("Delta Hangar"));
    expect(added?.facts).toEqual([]);
    expect(r.differences.some((d) => d.oldText.includes("Beta") && d.newText.includes("Delta") && d.structurePath?.confidence !== "unresolved")).toBe(false);
  });
});
