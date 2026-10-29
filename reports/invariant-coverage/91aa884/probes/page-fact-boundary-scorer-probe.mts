// The scorer's factHolds('page_number_only') on the inputs of Codex PR #11 comment 6509987949 (text form only:
// a false form returns false before the scope check; a true form on a single line is null, open).
import { factHolds } from "/home/user/policy-compare/tests/evaluation/scorer";
const loc = { side: "left", pageIndex: 0, rawRange: [0, 0], charIds: ["c"] } as any;
for (const [oldText, newText] of [["Page 1.1", "Page 2.1"], ["Page 100,000", "Page 200,000"], ["Schedule Page 3 of 10,5", "Schedule Page 3 of 11,5"], ["Page 1 of 10", "Page 2 of 10"], ["Page 3", "Page 4"]]) {
  const d = { oldText, newText, left: [loc], right: [{ ...loc, side: "right" }], occurrences: [] } as any;
  console.log(`${JSON.stringify(oldText)} -> ${JSON.stringify(newText)}: ${factHolds("page_number_only", d, [{ pages: [] }, { pages: [] }] as any)}`);
}
