import { compare } from "../../../../packages/compare-core/index";
import { textDoc } from "../../../../tests/helpers";
type Rows = string[][];
const lines = (rows: Rows, y0: number) => rows.flatMap((row, i) => row.map((text, j) => ({ text, x: 40 + j * 130, y: y0 + i * 20 })));
const table = (rows: Rows) => textDoc([{ text: "SCHEDULE", y: 150 }, ...lines(rows, 180)]);
const show = (name: string, a: any, b: any) => {
  const r: any = compare(a, b);
  console.log(name, "|", r.status, "| unresolved", r.unresolved.length);
  for (const d of r.differences) console.log("  ", JSON.stringify([d.kind, d.matchEvidence.method, d.structurePath?.rowKey ?? null, d.structurePath?.confidence, d.oldText, d.newText]));
};
show("A320", table([["Registration", "MSN", "Model"], ["G-AAAA", "123", "A320"], ["G-CCCC", "789", "B737"]]), table([["Registration", "MSN", "Model"], ["G-BBBB", "456", "A320"], ["G-CCCC", "789", "B737"]]));
show("names, no heading row", table([["Alpha Air", "A-1", "USD 100,000"], ["Beta Air", "B-2", "USD 200,000"]]), table([["Alpha Air", "A-1", "USD 200,000"], ["Beta Air", "B-2", "USD 100,000"]]));
show("MSN 1/2 prefix", table([["MSN 1", "Alpha", "10%"], ["MSN 2", "Beta", "20%"]]), table([["MSN 1", "Beta", "10%"], ["MSN 2", "Alpha", "20%"]]));
show("same MSN, other registration", table([["MSN", "Registration", "Value"], ["1315", "G-AAAA", "USD 1,000"], ["1316", "G-BBBB", "USD 2,000"]]), table([["MSN", "Registration", "Value"], ["1315", "G-ZZZZ", "USD 1,000"], ["1316", "G-BBBB", "USD 2,000"]]));
const doc = (aircraft: Rows, parties: Rows) => textDoc([{ text: "SCHEDULE", y: 150 }, ...lines([["Registration", "Operator", "Value"], ...aircraft], 180), ...lines([["Registration", "Contract Party", "Since"], ...parties], 300)]);
show("same title, two tables", doc([["G-AAAA", "Alpha Air", "USD 1,000"]], [["G-BBBB", "North Bank plc", "2019"]]), doc([["G-CCCC", "Gamma Air", "USD 3,000"]], [["G-AAAA", "South Bank plc", "2021"]]));
