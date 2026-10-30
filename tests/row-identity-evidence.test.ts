import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import { ResultSchemaV2, type CompareResultV2 } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Issue #2, round 8: recovered table rows are paired only through positive
// identity evidence: a cell under its local column heading naming an
// identifier (MSN, ESN, serial, registration, insurer), or a cell that itself
// starts with such a name ("MSN 1"). Uniqueness only checks a candidate; a
// model, status, amount, date or a description that happens to be unique binds
// nothing. Identity is scoped to one table: the same title above two tables
// with different heading rows does not make them one table.
type Rows = string[][];
const lines = (rows: Rows, y0: number) =>
  rows.flatMap((row, i) => row.map((text, j) => ({ text, x: 40 + j * 130, y: y0 + i * 20 })));
const table = (rows: Rows, title = "SCHEDULE") => textDoc([{ text: title, y: 150 }, ...lines(rows, 180)]);
const run = (before: Rows, after: Rows) => ResultSchemaV2.parse(compare(table(before), table(after)));
// A confident card that turns one record into another.
const crossPaired = (r: CompareResultV2, from: string, to: string) =>
  r.differences.some(
    (d) =>
      d.oldText.includes(from) &&
      d.newText.includes(to) &&
      !d.oldText.includes(to) &&
      d.structurePath?.confidence !== "unresolved",
  );
const visible = (r: CompareResultV2, text: string, side: "left" | "right") =>
  r.differences.some((d) => d[side].map((l) => l.text).join(" ").includes(text)) ||
  r.unresolved.some((u) => u[side].map((l) => l.text).join(" ").includes(text));

describe("a descriptive cell does not bind two records", () => {
  it("Registration | MSN | Model: G-AAAA/123/A320 -> G-BBBB/456/A320 is not one record", () => {
    const r = run(
      [["Registration", "MSN", "Model"], ["G-AAAA", "123", "A320"], ["G-CCCC", "789", "B737"]],
      [["Registration", "MSN", "Model"], ["G-BBBB", "456", "A320"], ["G-CCCC", "789", "B737"]],
    );
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect(crossPaired(r, "G-AAAA", "G-BBBB")).toBe(false);
    expect([visible(r, "G-AAAA", "left"), visible(r, "G-BBBB", "right")]).toEqual([true, true]);
  });
  it("without a heading row, unique names bind nothing; every change stays visible", () => {
    const r = run(
      [["Alpha Air", "A-1", "USD 100,000"], ["Beta Air", "B-2", "USD 200,000"]],
      [["Alpha Air", "A-1", "USD 200,000"], ["Beta Air", "B-2", "USD 100,000"]],
    );
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    for (const [text, side] of [["USD 100,000", "left"], ["USD 200,000", "right"], ["USD 200,000", "left"], ["USD 100,000", "right"]] as const)
      expect(visible(r, text, side)).toBe(true);
  });
});

describe("an identifier written in the cell is identity evidence", () => {
  it("MSN 1 / MSN 2 without a heading row: the rows pair by MSN, never across MSNs", () => {
    const r = run(
      [["MSN 1", "Alpha", "10%"], ["MSN 2", "Beta", "20%"]],
      [["MSN 1", "Beta", "10%"], ["MSN 2", "Alpha", "20%"]],
    );
    expect(crossPaired(r, "MSN 1", "MSN 2")).toBe(false);
    expect(crossPaired(r, "MSN 2", "MSN 1")).toBe(false);
    expect(
      r.differences.map((d) => [d.matchEvidence.method, d.structurePath?.rowKey, d.oldText, d.newText]),
    ).toEqual([
      ["row-identity", "MSN 1", "MSN 1 Alpha 10%", "MSN 1 Beta 10%"],
      ["row-identity", "MSN 2", "MSN 2 Beta 20%", "MSN 2 Alpha 20%"],
    ]);
  });
  it("control: a No. column counting 1..n is not identity, so an inserted row shifts nothing", () => {
    const r = run(
      [["No.", "Hangar", "Value"], ["1", "Alpha Hangar", "USD 100,000"], ["2", "Beta Hangar", "USD 200,000"]],
      [["No.", "Hangar", "Value"], ["1", "Alpha Hangar", "USD 100,000"], ["2", "Delta Hangar", "USD 250,000"], ["3", "Beta Hangar", "USD 200,000"]],
    );
    expect(crossPaired(r, "Beta", "Delta")).toBe(false);
    expect(visible(r, "Delta Hangar", "right")).toBe(true);
  });
  it("control: an insurer code under its Insurer heading pairs the insurer's line", () => {
    const r = run(
      [["Insurer", "Reference", "Line"], ["HPX 0624", "HX-AV-2210", "12.5%"], ["MKV 1426", "24AV0381", "15.0%"]],
      [["Insurer", "Reference", "Line"], ["HPX 0624", "HX-AV-2587", "10.0%"], ["MKV 1426", "25AV0412", "15.0%"]],
    );
    const hpx = r.differences.find((d) => d.oldText.startsWith("HPX 0624"))!;
    expect([hpx.kind, hpx.matchEvidence.method, hpx.structurePath?.rowKey, hpx.newText]).toEqual([
      "Replaced", "row-identity", "HPX 0624", "HPX 0624 HX-AV-2587 10.0%",
    ]);
  });
});

describe("explicit identity evidence that conflicts stays unresolved", () => {
  it("MSN and registration pointing to different rows: one unresolved group", () => {
    const r = run(
      [["MSN", "Registration", "Value"], ["1315", "G-AAAA", "USD 1,000"], ["1316", "G-BBBB", "USD 2,000"]],
      [["MSN", "Registration", "Value"], ["1315", "G-BBBB", "USD 1,000"], ["1316", "G-AAAA", "USD 2,000"]],
    );
    expect(r.unresolved.some((u) => u.reason === "ambiguous_identity")).toBe(true);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
  });
  it("the same MSN with another registration: the identifiers disagree, so unresolved", () => {
    const r = run(
      [["MSN", "Registration", "Value"], ["1315", "G-AAAA", "USD 1,000"], ["1316", "G-BBBB", "USD 2,000"]],
      [["MSN", "Registration", "Value"], ["1315", "G-ZZZZ", "USD 1,000"], ["1316", "G-BBBB", "USD 2,000"]],
    );
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect(r.unresolved.some((u) => u.reason === "ambiguous_identity")).toBe(true);
    expect([visible(r, "G-AAAA", "left"), visible(r, "G-ZZZZ", "right")]).toEqual([true, true]);
  });
});

describe("the same title above two tables is not one table", () => {
  // Under one title, an aircraft table and a contract-party table, each with
  // its own heading row. G-AAAA leaves the first table and enters the second.
  const doc = (aircraft: Rows, parties: Rows) =>
    textDoc([
      { text: "SCHEDULE", y: 150 },
      ...lines([["Registration", "Operator", "Value"], ...aircraft], 180),
      ...lines([["Registration", "Contract Party", "Since"], ...parties], 300),
    ]);
  it("a registration in each table, on different sides, binds nothing", () => {
    const r = ResultSchemaV2.parse(
      compare(
        doc([["G-AAAA", "Alpha Air", "USD 1,000"]], [["G-BBBB", "North Bank plc", "2019"]]),
        doc([["G-CCCC", "Gamma Air", "USD 3,000"]], [["G-AAAA", "South Bank plc", "2021"]]),
      ),
    );
    expect(crossPaired(r, "Alpha Air", "South Bank")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
  });
});

// Issue #2, round 11 (reviews r4412115000, r4414059357): identity evidence
// belongs to the actual table and column. A missing cell does not shift a
// value into another identifier column, and two tables with the same title
// and heading row are two tables unless each version has only one of them.
describe("identity belongs to its own column and its own table", () => {
  type Cells = (string | null)[];
  const place = (rows: Cells[], y0: number, page = 0, dx = 130) =>
    rows.flatMap((row, i) =>
      row.flatMap((text, j) => (text === null ? [] : [{ text, x: 40 + j * dx, y: y0 + i * 20, page }])),
    );
  it("MSN | ESN | Serial | Share: 123/456 under MSN/ESN vs ESN/Serial is not one record", () => {
    const head: Cells = ["MSN", "ESN", "Serial", "Share"];
    const doc = (row: Cells) => textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, row, ["900", "901", "902", "5%"]], 180)]);
    const r = ResultSchemaV2.parse(compare(doc(["123", "456", null, "10%"]), doc([null, "123", "456", "20%"])));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity" && d.oldText.includes("10%"))).toBe(false);
    expect(crossPaired(r, "10%", "20%")).toBe(false);
    expect([visible(r, "10%", "left"), visible(r, "20%", "right")]).toEqual([true, true]);
    // Control: the identifiers stay in their columns and another cell is missing.
    const ok = ResultSchemaV2.parse(compare(doc(["123", "456", null, "10%"]), doc(["123", "456", "789", "20%"])));
    const d = ok.differences.find((d) => d.oldText.includes("10%"))!;
    expect([d.matchEvidence.method, d.newText]).toEqual(["row-identity", "123 456 789 20%"]);
  });
  it("two tables with the same title and heading row, a paragraph between, are not one table", () => {
    const head: Cells = ["Registration", "Operator", "Value"];
    const doc = (first: Cells, second: Cells) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([head, first], 180),
        { text: "The second table lists the reserve fleet.", y: 260 },
        ...place([head, second], 300),
      ]);
    const r = ResultSchemaV2.parse(
      compare(doc(["G-AAAA", "Alpha Air", "USD 1000"], ["G-BBBB", "Beta Air", "USD 2000"]), doc(["G-CCCC", "Gamma Air", "USD 3000"], ["G-AAAA", "Delta Air", "USD 4000"])),
    );
    expect(crossPaired(r, "Alpha Air", "Delta Air")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "Alpha Air", "left"), visible(r, "Delta Air", "right")]).toEqual([true, true]);
  });
  it("two tables with one heading on the same page, nothing between, are not one table (r4417493798)", () => {
    const head: Cells = ["Registration", "Operator", "Value"];
    const doc = (first: Cells, second: Cells) => textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, first, head, second], 180)]);
    const r = ResultSchemaV2.parse(
      compare(doc(["G-AAAA", "Alpha Air", "USD 1000"], ["G-BBBB", "Beta Air", "USD 2000"]), doc(["G-CCCC", "Gamma Air", "USD 3000"], ["G-AAAA", "Delta Air", "USD 4000"])),
    );
    expect(crossPaired(r, "Alpha Air", "Delta Air")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "Alpha Air", "left"), visible(r, "Delta Air", "right")]).toEqual([true, true]);
  });
  it("digit-free data rows (r4415822173): two tables with one heading, a paragraph between, are not one table", () => {
    const head: Cells = ["Registration", "Operator", "Status"];
    const doc = (first: Cells, second: Cells) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([head, first], 180),
        { text: "The second table lists the reserve fleet.", y: 260 },
        ...place([head, second], 300),
      ]);
    const r = ResultSchemaV2.parse(
      compare(
        doc(["Registration G-AAAA", "Alpha Air", "Lead"], ["Registration G-BBBB", "Beta Air", "Lead"]),
        doc(["Registration G-CCCC", "Gamma Air", "Lead"], ["Registration G-AAAA", "Delta Air", "Lead"]),
      ),
    );
    expect(crossPaired(r, "Alpha Air", "Delta Air")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "Alpha Air", "left"), visible(r, "Delta Air", "right")]).toEqual([true, true]);
  });
  it("a digit-free record that moves to the other table on every page is shown (r4416744444)", () => {
    // Repeated on two pages, the record was aggregated as a repeated table
    // header across both tables and its move disappeared.
    const head: Cells = ["Registration", "Operator", "Status"];
    const A: Cells = ["Registration G-AAAA", "Alpha Air", "Lead"],
      C: Cells = ["Registration G-CCCC", "Gamma Air", "Follow"];
    const doc = (first: Cells[], second: Cells[]) =>
      textDoc([0, 1].flatMap((page) => [
        { text: "SCHEDULE", y: 150, page },
        ...place([head, ...first], 180, page),
        { text: "The second table lists the reserve fleet.", y: 300, page },
        ...place([head, ...second], 340, page),
      ]));
    const r = ResultSchemaV2.parse(compare(doc([A], [C]), doc([], [A, C])));
    expect([visible(r, "Alpha Air", "left"), visible(r, "Alpha Air", "right")]).toEqual([true, true]);
    expect(r.differences.some((d) => d.matchEvidence.method === "repeated-table-header" && d.oldText.includes("G-AAAA"))).toBe(false);
  });
  it("a digit-free record does not become the heading of the rows below it (r4416878288)", () => {
    // "Registration pending" in a record's status was read as an identity
    // heading for the next row, which then bound G-111 -> G-222 by its status.
    const head: Cells = ["Registration", "Operator", "Status"];
    const doc = (reg: string, operator: string) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([head, ["G-AAAA", "Alpha Air", "Registration pending"], [reg, operator, "Active"]], 180),
      ]);
    const r = ResultSchemaV2.parse(compare(doc("G-111", "Beta Air"), doc("G-222", "Gamma Air")));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "G-111", "left"), visible(r, "G-222", "right")]).toEqual([true, true]);
  });
  it("a digit-free record is read under its table's heading row (r4416942407)", () => {
    // The record had no heading, so only "Insurer Alpha" (named by its prefix)
    // was identity and G-AAAA -> G-BBBB bound by it.
    const head: Cells = ["Registration", "Insurer", "Status"];
    const doc = (reg: string) =>
      textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, [reg, "Insurer Alpha", "Active"]], 180)]);
    const r = ResultSchemaV2.parse(compare(doc("G-AAAA"), doc("G-BBBB")));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "G-AAAA", "left"), visible(r, "G-BBBB", "right")]).toEqual([true, true]);
  });
  it("a qualified identifier heading (Serial No.) starts a table of its own (r4417210539)", () => {
    // "Serial No." was not an exact identifier name, so the second table's
    // heading was taken for a record of the first and 123 bound across them.
    const doc = (first: Cells[], second: Cells[]) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([["MSN", "Operator", "Value"], ...first, ["Serial No.", "Model", "Value"], ...second], 180),
      ]);
    const r = ResultSchemaV2.parse(
      compare(doc([["123", "Alpha", "USD 100"]], [["456", "Beta", "USD 200"]]), doc([["789", "Gamma", "USD 300"]], [["123", "Delta", "USD 400"]])),
    );
    expect(crossPaired(r, "Alpha", "Delta")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
  });
  it("a qualified identifier heading inside a table (Aircraft Registration) ends that table (r4417587174)", () => {
    // It may head another table or be a record's value: the rows after it are
    // read under neither table's heading, so 123 binds nothing across them.
    const doc = (first: Cells[], second: Cells[]) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([["MSN", "Operator", "Value"], ...first, ["Aircraft Registration", "Model", "Value"], ...second], 180, 0, 220),
      ]);
    const r = ResultSchemaV2.parse(
      compare(doc([["123", "Alpha", "USD 100"]], [["456", "Beta", "USD 200"]]), doc([["789", "Gamma", "USD 300"]], [["123", "Delta", "USD 400"]])),
    );
    expect(crossPaired(r, "Alpha", "Delta")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "Alpha", "left"), visible(r, "Delta", "right")]).toEqual([true, true]);
  });
  it("control: a record whose status ends with an identifier (Pending Registration) heads no rows (r4417587174)", () => {
    const doc = (last: Cells) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([["Registration", "Operator", "Status"], ["G-AAAA", "Alpha Air", "Pending Registration"], last], 180, 0, 220),
      ]);
    const r = ResultSchemaV2.parse(compare(doc(["G-BBBB", "Beta Air", "Registered"]), doc(["G-CCCC", "Gamma Air", "Registered"])));
    expect(crossPaired(r, "Beta Air", "Gamma Air")).toBe(false);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "Beta Air", "left"), visible(r, "Gamma Air", "right")]).toEqual([true, true]);
  });
  it("rows with the same text but identifiers in other columns are not the same record (r4417643759)", () => {
    const head: Cells = ["MSN", "ESN", "Serial", "Share"];
    const doc = (row: Cells) => textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, row, ["900", "901", "902", "5%"]], 180)]);
    const r = ResultSchemaV2.parse(compare(doc(["123", "456", null, "10%"]), doc([null, "123", "456", "10%"])));
    expect(r.differences.some((d) => d.matchEvidence.method === "unique-exact")).toBe(false);
    expect([visible(r, "10%", "left"), visible(r, "10%", "right")]).toEqual([true, true]);
    // Control: the same row in the same columns is unchanged.
    expect(ResultSchemaV2.parse(compare(doc(["123", "456", null, "10%"]), doc(["123", "456", null, "10%"]))).differences).toEqual([]);
  });
  it("a heading row with a year in another cell (2026 Limit) still names its identity columns (r4418068282)", () => {
    const run2 = (head: Cells, a: Cells, b: Cells) =>
      ResultSchemaV2.parse(
        compare(textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, a], 180, 0, 160)]), textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, b], 180, 0, 160)])),
      );
    const head: Cells = ["Registration", "Insurer", "2026 Limit"];
    // Different registrations: the insurer named in a cell does not make them one record.
    const r = run2(head, ["G-AAAA", "Insurer Alpha", "USD 1000"], ["G-BBBB", "Insurer Alpha", "USD 2000"]);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "G-AAAA", "left"), visible(r, "G-BBBB", "right")]).toEqual([true, true]);
    // Control: the same registration pairs under that heading.
    const c = run2(head, ["G-AAAA", "Insurer Alpha", "USD 1000"], ["G-AAAA", "Insurer Alpha", "USD 2000"]);
    expect(c.differences.map((d) => d.matchEvidence.method)).toEqual(["row-identity"]);
  });
  it("control: a record with an amount is no heading, though a cell names an identifier (Reinsurer)", () => {
    const doc = (share: string) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([["Registration", "Role", "Share"], ["G-AAAA", "Reinsurer", "25%"], ["G-BBBB", "Lead", share]], 180, 0, 160),
      ]);
    const r = ResultSchemaV2.parse(compare(doc("30%"), doc("35%")));
    expect(r.differences.map((d) => [d.matchEvidence.method, d.oldText, d.newText])).toEqual([["row-identity", "G-BBBB Lead 30%", "G-BBBB Lead 35%"]]);
  });
  it("records repeated on every page are grouped only with the same identifier columns (r4418369390)", () => {
    const head: Cells = ["MSN", "ESN", "Serial", "Status"];
    const doc = (row: Cells) =>
      textDoc([0, 1].flatMap((page) => [{ text: "SCHEDULE", y: 150, page }, ...place([head, row], 180, page)]));
    const r = ResultSchemaV2.parse(compare(doc(["AAA", "BBB", null, "Active"]), doc([null, "AAA", "BBB", "Active"])));
    expect(r.differences.some((d) => d.matchEvidence.method === "repeated-table-header" && d.oldText.includes("AAA"))).toBe(false);
    expect([visible(r, "AAA", "left"), visible(r, "AAA", "right")]).toEqual([true, true]);
    // Control: the same record in the same columns on every page is unchanged.
    expect(ResultSchemaV2.parse(compare(doc(["AAA", "BBB", null, "Active"]), doc(["AAA", "BBB", null, "Active"]))).differences).toEqual([]);
  });
  it("a value-like cell under an identity heading (Serial AB12.34) still keeps two records apart (r4418369400)", () => {
    const run2 = (a: Cells, b: Cells) =>
      ResultSchemaV2.parse(
        compare(
          textDoc([{ text: "SCHEDULE", y: 150 }, ...place([["Serial", "Insurer", "Value"], a], 180, 0, 160)]),
          textDoc([{ text: "SCHEDULE", y: 150 }, ...place([["Serial", "Insurer", "Value"], b], 180, 0, 160)]),
        ),
      );
    const r = run2(["AB12.34", "Insurer Alpha", "USD 1000"], ["AB56.78", "Insurer Alpha", "USD 2000"]);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "AB12.34", "left"), visible(r, "AB56.78", "right")]).toEqual([true, true]);
    // A plain serial against a dotted one, either way, is a conflict too (r4418461107).
    for (const [a, b] of [["AB1234", "AB56.78"], ["AB56.78", "AB1234"]]) {
      const m = run2([a, "Insurer Alpha", "USD 1000"], [b, "Insurer Alpha", "USD 2000"]);
      expect(m.differences.some((d) => d.matchEvidence.method === "row-identity"), `${a} -> ${b}`).toBe(false);
    }
    // Control: the same serial pairs (through the insurer the cell names).
    const c = run2(["AB12.34", "Insurer Alpha", "USD 1000"], ["AB12.34", "Insurer Alpha", "USD 2000"]);
    expect(c.differences.map((d) => d.matchEvidence.method)).toEqual(["row-identity"]);
  });
  it("a full-width identity heading (Ｒｅｇｉｓｔｒａｔｉｏｎ) still names its column (PR #9 comment 6508095436)", () => {
    const run2 = (a: Cells, b: Cells) =>
      ResultSchemaV2.parse(
        compare(
          textDoc([{ text: "SCHEDULE", y: 150 }, ...place([["Ｒｅｇｉｓｔｒａｔｉｏｎ", "Insurer", "Status"], a], 180, 0, 160)]),
          textDoc([{ text: "SCHEDULE", y: 150 }, ...place([["Ｒｅｇｉｓｔｒａｔｉｏｎ", "Insurer", "Status"], b], 180, 0, 160)]),
        ),
      );
    const r = run2(["G-AAAA", "Insurer Alpha", "Active"], ["G-BBBB", "Insurer Alpha", "Lead"]);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "G-AAAA", "left"), visible(r, "G-BBBB", "right")]).toEqual([true, true]);
    // Control: the same registration pairs.
    expect(run2(["G-AAAA", "Insurer Alpha", "Active"], ["G-AAAA", "Insurer Alpha", "Lead"]).differences.map((d) => d.matchEvidence.method)).toEqual([
      "row-identity",
    ]);
  });
  it("rows after two closed tables do not bind across them (PR #9 comment 6508226511)", () => {
    // Aircraft Registration and Engine Serial each end the table before them;
    // the rows after each are their own scope, not one shared fallback.
    const doc = (second: Cells, fourth: Cells) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place(
          [
            ["MSN", "Operator", "Value"], ["100", "Zed", "USD 10"],
            ["Aircraft Registration", "Operator", "Value"], second,
            ["ESN", "Operator", "Value"], ["200", "Yan", "USD 20"],
            ["Engine Serial", "Operator", "Value"], fourth,
          ],
          180, 0, 220,
        ),
      ]);
    const r = ResultSchemaV2.parse(
      compare(doc(["MSN 123", "Alpha", "USD 100"], ["MSN 456", "Beta", "USD 300"]), doc(["MSN 789", "Gamma", "USD 200"], ["MSN 123", "Delta", "USD 400"])),
    );
    expect(crossPaired(r, "Alpha", "Delta")).toBe(false);
    expect([visible(r, "Alpha", "left"), visible(r, "Delta", "right")]).toEqual([true, true]);
    // Control: within one closed table the named MSN still pairs.
    const c = ResultSchemaV2.parse(
      compare(doc(["MSN 123", "Alpha", "USD 100"], ["MSN 456", "Beta", "USD 300"]), doc(["MSN 123", "Alpha", "USD 200"], ["MSN 456", "Beta", "USD 300"])),
    );
    expect(c.differences.map((d) => [d.matchEvidence.method, d.newText])).toEqual([["row-identity", "MSN 123 Alpha USD 200"]]);
  });
  it("a cell under a descriptive heading (Status: Registration pending) names no identifier (r4418795510)", () => {
    const run2 = (a: Cells, b: Cells) =>
      ResultSchemaV2.parse(
        compare(
          textDoc([{ text: "SCHEDULE", y: 150 }, ...place([["Status", "Operator", "Value"], a], 180, 0, 160)]),
          textDoc([{ text: "SCHEDULE", y: 150 }, ...place([["Status", "Operator", "Value"], b], 180, 0, 160)]),
        ),
      );
    const r = run2(["Registration pending", "Alpha Air", "USD 1000"], ["Registration pending", "Delta Air", "USD 2000"]);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "Alpha Air", "left"), visible(r, "Delta Air", "right")]).toEqual([true, true]);
  });
  it("an identifier under no heading cell leaves the row's identity incomplete (r4418900383)", () => {
    // A right-aligned MSN (x 100) does not overlap its short heading (x 40):
    // its column is unknown, so the insurer alone does not pair the rows.
    const doc = (msn: string, value: string, x = 100) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        { text: "MSN", x: 40, y: 180 }, { text: "Insurer", x: 190, y: 180 }, { text: "Value", x: 340, y: 180 },
        { text: msn, x, y: 200 }, { text: "Alpha", x: 190, y: 200 }, { text: value, x: 340, y: 200 },
      ]);
    const r = ResultSchemaV2.parse(compare(doc("123456", "USD 1000"), doc("789012", "USD 2000")));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "123456", "left"), visible(r, "789012", "right")]).toEqual([true, true]);
    // Control: under its heading the MSN is read, and the same MSN pairs.
    const c = ResultSchemaV2.parse(compare(doc("123456", "USD 1000", 40), doc("123456", "USD 2000", 40)));
    expect(c.differences.map((d) => d.matchEvidence.method)).toEqual(["row-identity"]);
  });
  it("an unplaced value-like identifier (AB12.34) also leaves the row's identity incomplete (r4418984410)", () => {
    const doc = (serial: string) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        { text: "Serial", x: 40, y: 180 }, { text: "Insurer", x: 190, y: 180 }, { text: "Value", x: 340, y: 180 },
        { text: serial, x: 100, y: 200 }, { text: "Alpha", x: 190, y: 200 }, { text: "USD 1000", x: 340, y: 200 },
      ]);
    const r = ResultSchemaV2.parse(compare(doc("AB12.34"), doc("AB56.78")));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "AB12.34", "left"), visible(r, "AB56.78", "right")]).toEqual([true, true]);
  });
  it("two cells under one identity column leave the row's identity incomplete (r4419030685)", () => {
    const doc = (a: string, b: string) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        { text: "Aircraft Registration", x: 40, y: 180 }, { text: "Insurer", x: 240, y: 180 }, { text: "Value", x: 390, y: 180 },
        { text: a, x: 40, y: 200 }, { text: b, x: 115, y: 200 }, { text: "Alpha", x: 240, y: 200 }, { text: "USD 1000", x: 390, y: 200 },
      ]);
    const r = ResultSchemaV2.parse(compare(doc("G-AAAA", "G-BBBB"), doc("G-CCCC", "G-DDDD")));
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    expect([visible(r, "G-AAAA", "left"), visible(r, "G-DDDD", "right")]).toEqual([true, true]);
  });
  it("a heading that only mentions an identifier (Registration Status) is no identity column (r4417386686)", () => {
    const run2 = (head: Cells, a: Cells, b: Cells) =>
      ResultSchemaV2.parse(compare(textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, a], 180)]), textDoc([{ text: "SCHEDULE", y: 150 }, ...place([head, b], 180)])));
    const r = run2(["Registration Status", "Operator", "Value"], ["Active", "Alpha Air", "USD 1000"], ["Active", "Delta Air", "USD 2000"]);
    expect(r.differences.some((d) => d.matchEvidence.method === "row-identity")).toBe(false);
    // Controls: an identifier label, also after a qualifier or before a number suffix, still names the column.
    for (const label of ["Registration", "Engine MSN", "Serial No."]) {
      const c = run2([label, "Operator", "Value"], ["G-AAAA", "Alpha Air", "USD 1000"], ["G-AAAA", "Alpha Air", "USD 2000"]);
      expect(c.differences.map((d) => d.matchEvidence.method), label).toEqual(["row-identity"]);
    }
  });
  it("control: in one table a changed digit-free record pairs by the registration it names", () => {
    const head: Cells = ["Registration", "Operator", "Status"];
    const doc = (operator: string) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([head, ["Registration G-AAAA", operator, "Lead"], ["Registration G-BBBB", "Beta Air", "Follow"]], 180),
      ]);
    const r = ResultSchemaV2.parse(compare(doc("Alpha Air"), doc("Delta Air")));
    expect(r.differences.map((d) => [d.kind, d.matchEvidence.method, d.oldText, d.newText])).toEqual([
      ["Replaced", "row-identity", "Registration G-AAAA Alpha Air Lead", "Registration G-AAAA Delta Air Lead"],
    ]);
  });
  it("control: one table continued on the next page under its repeated heading row still pairs by registration", () => {
    const head: Cells = ["Registration", "Operator", "Value"];
    const doc = (value: string) =>
      textDoc([
        { text: "SCHEDULE", y: 150 },
        ...place([head, ["G-AAAA", "Alpha Air", "USD 1000"]], 180),
        { text: "SCHEDULE", y: 150, page: 1 },
        ...place([head, ["G-BBBB", "Beta Air", value]], 180, 1),
      ]);
    const r = ResultSchemaV2.parse(compare(doc("USD 2000"), doc("USD 2500")));
    const d = r.differences.find((d) => d.newText.includes("USD 2500"))!;
    expect([d.matchEvidence.method, d.structurePath?.rowKey, d.oldText]).toEqual(["row-identity", "G-BBBB", "G-BBBB Beta Air USD 2000"]);
  });
});
