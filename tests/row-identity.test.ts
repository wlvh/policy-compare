import { describe, it, expect } from "vitest";
import { compare } from "../packages/compare-core/index";
import type { CompareResult } from "../packages/contracts/index";
import { textDoc } from "./helpers";

// Each cell is a separate extraction line on the row's baseline, as in the
// renewal samples; no profile table header is declared.
const table = (rows: string[][], title = "SCHEDULE") =>
  textDoc([
    { text: title, y: 150 },
    ...rows.flatMap((row, i) =>
      row.map((text, j) => ({ text, x: 40 + j * 130, y: 180 + i * 20 })),
    ),
  ]);
const run = (before: string[][], after: string[][]) =>
  compare(table(before), table(after));
// No confident card may turn one record into another.
const crossPaired = (r: CompareResult, from: string, to: string) =>
  r.differences.some(
    (d) =>
      d.oldText.includes(from) &&
      d.newText.includes(to) &&
      !d.oldText.includes(to) &&
      d.structurePath?.confidence !== "unresolved",
  );
const card = (r: CompareResult, kind: string, text: string) =>
  r.differences.find(
    (d) => d.kind === kind && (d.oldText + d.newText).includes(text),
  );

describe("recovered table rows bind only through identity evidence", () => {
  it("numbered rows: an inserted row does not shift identities", () => {
    const r = run(
      [
        ["1", "Alpha Hangar", "USD 100,000"],
        ["2", "Beta Hangar", "USD 200,000"],
        ["3", "Gamma Hangar", "USD 300,000"],
      ],
      [
        ["1", "Alpha Hangar", "USD 100,000"],
        ["2", "Delta Hangar", "USD 250,000"],
        ["3", "Beta Hangar", "USD 200,000"],
        ["4", "Gamma Hangar", "USD 300,000"],
      ],
    );
    expect(card(r, "Added", "Delta Hangar")?.facts).toEqual([]);
    expect(crossPaired(r, "Beta", "Delta")).toBe(false);
    expect(crossPaired(r, "Gamma", "Beta")).toBe(false);
  });
  it("item codes counting 1..n behave like row numbers", () => {
    const r = run(
      [
        ["Item-001", "Alpha Hangar", "USD 100,000"],
        ["Item-002", "Beta Hangar", "USD 200,000"],
        ["Item-003", "Gamma Hangar", "USD 300,000"],
      ],
      [
        ["Item-001", "Alpha Hangar", "USD 100,000"],
        ["Item-002", "Delta Hangar", "USD 250,000"],
        ["Item-003", "Beta Hangar", "USD 200,000"],
        ["Item-004", "Gamma Hangar", "USD 300,000"],
      ],
    );
    expect(card(r, "Added", "Delta Hangar")).toBeDefined();
    expect(crossPaired(r, "Beta", "Delta")).toBe(false);
    expect(crossPaired(r, "Gamma", "Beta")).toBe(false);
  });
  it("an exit and an entry with equal share and date stay separate", () => {
    const r = run(
      [
        ["ALD 3392", "AVN24117", "22.5%", "02/10/2025"],
        ["SLD 2988", "SLD-01", "10.0%", "03/10/2025"],
        ["Nordvik Re", "NRE-1", "15.0%", "04/10/2025"],
      ],
      [
        ["ALD 3392", "AVN24117", "22.5%", "02/10/2025"],
        ["Corvane AG", "COR-02", "10.0%", "03/10/2025"],
        ["Nordvik Re", "NRE-1", "15.0%", "04/10/2025"],
      ],
    );
    expect(card(r, "Removed", "SLD 2988")?.facts).toEqual([]);
    expect(card(r, "Added", "Corvane AG")?.facts).toEqual([]);
    expect(crossPaired(r, "SLD", "Corvane")).toBe(false);
  });
  it("amounts swapped between two companies are reported per company", () => {
    const r = run(
      [
        ["Alpha Air", "A-1", "USD 100,000"],
        ["Beta Air", "B-2", "USD 200,000"],
      ],
      [
        ["Alpha Air", "A-1", "USD 200,000"],
        ["Beta Air", "B-2", "USD 100,000"],
      ],
    );
    const alpha = r.differences.find((d) => d.oldText.startsWith("Alpha"))!;
    const beta = r.differences.find((d) => d.oldText.startsWith("Beta"))!;
    expect([alpha.oldText, alpha.newText]).toEqual([
      "Alpha Air A-1 USD 100,000",
      "Alpha Air A-1 USD 200,000",
    ]);
    expect([beta.oldText, beta.newText]).toEqual([
      "Beta Air B-2 USD 200,000",
      "Beta Air B-2 USD 100,000",
    ]);
    expect([alpha.facts, beta.facts]).toEqual([[], []]);
  });
  it("reordered unchanged rows produce no text change", () => {
    const rows = [
      ["Alpha Air", "A-1", "USD 100,000"],
      ["Beta Air", "B-2", "USD 200,000"],
      ["Gamma Air", "C-3", "USD 300,000"],
    ];
    const r = run(rows, [rows[2], rows[0], rows[1]]);
    expect(r.differences.some((d) => d.hasTextChange)).toBe(false);
  });
  it("a share change stays on its insurer row", () => {
    const r = run(
      [
        ["HPX 0624", "HX-AV-2210", "12.5%", "03/10/2024"],
        ["MKV 1426", "24AV0381", "15.0%", "03/10/2024"],
      ],
      [
        ["HPX 0624", "HX-AV-2587", "10.0%", "02/10/2025"],
        ["MKV 1426", "25AV0412", "15.0%", "02/10/2025"],
      ],
    );
    const hpx = r.differences.find((d) => d.oldText.startsWith("HPX 0624"))!;
    expect(hpx.kind).toBe("Replaced");
    expect(hpx.newText.startsWith("HPX 0624")).toBe(true);
    expect(hpx.oldText).toContain("12.5%");
    expect(hpx.newText).toContain("10.0%");
    expect(hpx.facts).toEqual([]);
    expect(hpx.structurePath?.rowKey).toBe("HPX 0624");
  });
  it("gapped row numbers are not trusted over names", () => {
    const r = run(
      [
        ["10", "Alpha", "USD 100,000"],
        ["30", "Beta", "USD 200,000"],
        ["70", "Gamma", "USD 300,000"],
      ],
      [
        ["10", "Alpha", "USD 100,000"],
        ["30", "Delta", "USD 250,000"],
        ["70", "Beta", "USD 200,000"],
        ["90", "Gamma", "USD 300,000"],
      ],
    );
    expect(crossPaired(r, "Beta", "Delta")).toBe(false);
    expect(crossPaired(r, "Gamma", "Beta")).toBe(false);
  });
  it("business ids that count up keep a conflict with names unresolved", () => {
    const r = run(
      [
        ["101", "Alpha", "10%"],
        ["102", "Beta", "20%"],
      ],
      [
        ["101", "Beta", "10%"],
        ["102", "Alpha", "20%"],
      ],
    );
    expect(r.status).toBe("partial");
    expect(r.unresolved.some((u) => u.reason === "ambiguous_identity")).toBe(
      true,
    );
    expect(
      r.differences.some((d) => d.matchEvidence.method === "row-identity"),
    ).toBe(false);
    expect(r.differences.every((d) => d.defaultVisible)).toBe(true);
  });
  it("the same text in a different column is not identity evidence", () => {
    const r = run(
      [
        ["MSN 100", "Alpha Leasing", "Beta Air"],
        ["MSN 200", "Gamma Leasing", "Delta Air"],
      ],
      [
        ["MSN 300", "Beta Air", "Omega Air"],
        ["MSN 200", "Gamma Leasing", "Delta Air"],
      ],
    );
    expect(card(r, "Removed", "MSN 100")).toBeDefined();
    expect(card(r, "Added", "MSN 300")).toBeDefined();
    expect(crossPaired(r, "MSN 100", "MSN 300")).toBe(false);
  });
});

describe("structure guards for the renewal fixes", () => {
  it("an amount on its own line is compared as content, not as a heading", () => {
    const doc = (amount: string) =>
      textDoc([
        { text: "AGREED VALUE", y: 150 },
        { text: amount, x: 200, y: 170 },
      ]);
    const r = compare(doc("USD 16,680,000"), doc("USD 15,000,000"));
    expect(r.differences.some((d) => d.oldText === "USD 16,680,000")).toBe(true);
    expect(r.differences.some((d) => d.newText === "USD 15,000,000")).toBe(true);
    expect(r.differences.every((d) => d.facts.length === 0)).toBe(true);
  });
  it("a case-only heading change keeps the following limit change visible", () => {
    const doc = (word: string, limit: string) =>
      textDoc([
        { text: "LIMITS", y: 150 },
        { text: word, x: 230, y: 180 },
        { text: `(b) USD${limit} any one Occurrence`, x: 230, y: 200 },
      ]);
    const r = compare(
      doc("HOWEVER:", "500,000,000"),
      doc("However:", "600,000,000"),
    );
    const changed = r.differences.filter((d) => d.hasTextChange && d.facts.length === 0);
    expect(changed.some((d) => d.oldText.includes("500,000,000"))).toBe(true);
    expect(changed.some((d) => d.newText.includes("600,000,000"))).toBe(true);
  });
  it("two prose columns on shared baselines are not turned into table rows", () => {
    const left = [
      "The insurer shall indemnify the insured",
      "against physical loss of or damage to",
      "the aircraft while in flight or taxiing.",
    ];
    const right = [
      "Claims must be notified within thirty",
      "days of the occurrence giving rise to",
      "the claim, failing which cover lapses.",
    ];
    const doc = (r: string[]) =>
      textDoc([
        { text: "CONDITIONS", y: 150 },
        ...left.flatMap((t, i) => [
          { text: t, x: 40, y: 180 + i * 14 },
          { text: r[i], x: 320, y: 180 + i * 14 },
        ]),
      ]);
    const changed = [...right];
    changed[0] = "Claims must be notified within sixty";
    const r = compare(doc(right), doc(changed));
    const d = r.differences.find((d) => d.newText.includes("sixty"))!;
    expect(d.facts).toEqual([]);
    expect(d.oldText).toContain("thirty");
    expect(d.structurePath?.table).toBeNull();
  });
});
