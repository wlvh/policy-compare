import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { compare } from "../packages/compare-core/index";
import { textDoc } from "./helpers";
import {
  grade,
  identityRule,
  summarize,
  exitCode,
  IDENTITY_NOT_APPLICABLE,
  INVARIANTS,
  type Expected,
  type Layout,
  type NotEvaluated,
} from "./evaluation/scorer";
import {
  ResultSchemaV2 as ResultSchema,
  resolveLocation,
  type CompareResultV2 as CompareResult,
  type DifferenceV2 as Difference,
  type DocInput,
  type SourceLocation,
} from "../packages/contracts/index";
function example() {
  const left = textDoc([
      { text: "SUMS INSURED:", x: 40, y: 150 },
      { text: "USD 100", x: 180, y: 150 },
    ]),
    right = textDoc([
      { text: "SUMS INSURED:", x: 40, y: 150 },
      { text: "USD 200", x: 180, y: 150 },
    ]);
  const expected: Expected = {
    case_id: "independent-scorer-test",
    required_status: "complete_for_scope",
    events: [
      {
        event_id: "amount",
        logical_path: "risk_details.sum_insured",
        old: "USD 100",
        new: "USD 200",
        operation: "replace",
        detection_requirement: "must_detect",
        acceptable_kinds: ["Replaced"],
        acceptable_categories: ["Material", "Review"],
      },
    ],
    invariants: [],
    coverage_requirements: [],
    evidence_locations: {
      amount: {
        before: [{ page_index: 0, run_id: "amount" }],
        after: [{ page_index: 0, run_id: "amount" }],
      },
    },
  };
  const page = (d: DocInput) => ({
    text_runs: [
      {
        run_id: "amount",
        text: d.pages[0].chars.filter(c=>c.origin[0]>=180).map(c=>c.text).join(""),
        direction: [1, 0],
        characters: d.pages[0].chars
          .filter((c) => c.origin[0] >= 180)
          .map((c) => ({
            quad_tl_tr_br_bl: [
              [c.quad[0], c.quad[1]],
              [c.quad[2], c.quad[3]],
              [c.quad[6], c.quad[7]],
              [c.quad[4], c.quad[5]],
            ],
          })),
      },
    ],
  });
  return {
    docs: [left, right] as [DocInput, DocInput],
    expected,
    layout: {
      before: { pages: [page(left)] },
      after: { pages: [page(right)] },
    } as Layout,
    result: compare(left, right),
  };
}
describe("independent grader rejects dishonest outputs", () => {
  for(const sides of [['left'],['right'],['left','right']] as const)
    it('F6 rejects displaced final changed geometry on '+sides.join('/'),()=>{
      const x=example();expect(grade(x.result,x.expected,x.layout,x.docs,true).status).toBe('PASS');
      for(const d of x.result.differences)for(const op of d.textOps)if(op.kind!=='equal')for(const side of sides)for(const loc of op[side])loc.resolvedGeometry={method:'text_layer_range',text:loc.text,quads:[[10000,10000,10020,10000,10000,10020,10020,10020]]};
      expect(grade(x.result,x.expected,x.layout,x.docs,true).status).toBe('FAIL');
    });
  it("accepts valid evidence and a genuine control", () => {
    const x = example();
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
    x.expected.events = [];
    x.expected.invariants = ["no_content_differences"];
    expect(
      grade(compare(x.docs[0], x.docs[0]), x.expected, x.layout, [
        x.docs[0],
        x.docs[0],
      ]).status,
    ).toBe("PASS");
  });
  const mutations: Record<string, (r: CompareResult) => void> = {
    "empty required output": (r) => {
      r.differences = [];
    },
    "wrong subject": (r) => {
      r.differences[0].structurePath!.entity = "wrong";
    },
    "wrong page": (r) => {
      r.differences[0].left[0].pageIndex = 9;
    },
    "hidden event": (r) => {
      (
        r.differences[0] as unknown as { defaultVisible: boolean }
      ).defaultVisible = false;
    },
    "invalid source": (r) => {
      r.differences[0].left[0].charIds = ["missing"];
    },
    "reversed sides": (r) => {
      [r.differences[0].left, r.differences[0].right] = [
        r.differences[0].right,
        r.differences[0].left,
      ];
    },
    "unjustified partial": (r) => {
      r.status = "partial";
    },
    "wrong operation": (r) => {
      r.differences[0].kind = "Added";
    },
    "no precise changed source": (r) => {
      r.differences[0].textOps = [];
    },
  };
  for (const [name, mutate] of Object.entries(mutations))
    it(name, () => {
      const x = example();
      mutate(x.result);
      expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
    });
  for (const mode of [
    "empty",
    "generic warning",
    "wrong region",
    "incorrect complete",
  ])
    it("coverage: " + mode, () => {
      const x = example();
      x.expected.required_status = "partial";
      x.expected.events[0].detection_requirement = "coverage_warning_required";
      x.expected.coverage_requirements = [
        { side: "both", page_index: 0, reason: "unverified_image_text_region" },
      ];
      x.expected.evidence_locations.amount = {
        before: [
          { page_index: 0, image_bbox_top_left_pt: [50, 250, 500, 400] },
        ],
        after: [{ page_index: 0, image_bbox_top_left_pt: [50, 250, 500, 400] }],
      };
      x.result.differences = [];
      x.result.status =
        mode === "incorrect complete" ? "complete_for_scope" : "partial";
      if (mode !== "empty")
        x.result.coverage = (["left", "right"] as const).map((side) => ({
          side,
          pageIndex: 0,
          region:
            mode === "generic warning"
              ? [0, 0, 600, 850]
              : mode === "wrong region"
                ? [0, 0, 20, 20]
                : [50, 250, 500, 400],
          reason: "unverified_image_text_region",
          evidence: "image object",
          message: "image not compared",
          defaultVisible: true,
        }));
      expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
    });
  it("duplicate-key warning alone cannot waive amount evidence", () => {
    const x = example();
    x.expected.required_status = "partial_or_explicit_review";
    x.expected.events[0].detection_requirement =
      "visible_text_delta_with_identity_review";
    x.result.status = "partial";
    x.result.unresolved = [
      {
        reason: "ambiguous_identity",
        message: "duplicate keys",
        left: [],
        right: [],
        defaultVisible: true,
      },
    ];
    x.result.differences = [];
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
  // #10 rulings 1 and 3 on result format 2: a card's flags and stated facts are claims checked against
  // its source-validated texts; none of them can turn the same change into PASS.
  it("an undeclared text change in a control fails, whatever fact the card states", () => {
    for (const facts of [[], ["whitespace_only"], ["continued_heading"]] as Difference["facts"][]) {
      const x = example();
      x.expected.events = [];
      x.expected.invariants = ["no_material_differences"];
      x.result.differences[0].facts = facts;
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status, facts.join()).toBe("FAIL");
      expect(score.faults, facts.join()).toContain("no_material_differences: Undeclared text change in a no-change control");
    }
  });
  it("a false hasTextChange flag fails, and the control still sees the source text change", () => {
    const x = example();
    x.expected.events = [];
    x.expected.invariants = ["no_false_text_added_or_removed"];
    Object.assign(x.result.differences[0], { hasTextChange: false, facts: ["whitespace_only"] });
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    const id = x.result.differences[0].id;
    expect(score.faults).toEqual([
      "hasTextChange contradicts the card's source-validated texts: " + id,
      `card ${id} states whitespace_only, which its source texts disprove`,
      "no_false_text_added_or_removed: False text delta in reflow control",
    ]);
  });
  it("deleting and re-inserting the same text is no text change; a true flag on it is a false claim", () => {
    const x = example();
    const [l, r] = x.docs;
    x.expected.events = [];
    x.expected.invariants = ["no_false_text_added_or_removed"];
    const loc = (d: DocInput, side: "left" | "right") => {
      const line = d.pages[0].lines[0];
      const chars = line.charIds.map((id) => d.pages[0].chars.find((c) => c.id === id)!);
      return { side, pageIndex: 0, unitId: line.id, rawRange: [chars[0].rawRange[0], chars.at(-1)!.rawRange[1]] as [number, number], charIds: [...line.charIds], text: chars.map((c) => c.text).join(""), quads: chars.map((c) => c.quad), direction: line.direction, precision: "synthetic" as const };
    };
    const [a, b] = [loc(l, "left"), loc(r, "right")];
    x.result.differences = [
      {
        ...x.result.differences[0],
        id: "same",
        left: [a],
        right: [b],
        oldText: a.text,
        newText: b.text,
        textOps: [
          { kind: "delete", text: a.text, left: [a], right: [] },
          { kind: "insert", text: b.text, left: [], right: [b] },
        ],
        hasTextChange: true,
        occurrences: [],
      },
    ];
    expect(a.text).toBe(b.text);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.faults).toEqual(["hasTextChange contradicts the card's source-validated texts: same"]);
    x.result.differences[0].hasTextChange = false;
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
  });
  it("a card that fails source validation cannot show that a control holds", () => {
    const x = example();
    x.expected.events = [];
    x.expected.invariants = ["no_false_text_added_or_removed", "no_material_differences"];
    // Forged equal texts: no change, if the text were believed.
    const d = x.result.differences[0];
    Object.assign(d, {
      newText: d.oldText,
      textOps: [{ kind: "equal", text: d.oldText, left: d.left, right: d.right }],
      hasTextChange: false,
    });
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.invariants.map((i) => [i.name, i.result])).toEqual([
      ["no_false_text_added_or_removed", "FAIL"],
      ["no_material_differences", "FAIL"],
    ]);
    expect(score.faults).toContain(`no_material_differences: card ${d.id} is not backed by its sources`);
  });
  it("a stated fact its sources disprove fails; discovery and attribution still pass", () => {
    for (const fact of ["whitespace_only", "page_number_only", "continued_heading", "dates_rolled_forward_one_year"] as const) {
      const x = example();
      x.result.differences[0].facts = [fact];
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status, fact).toBe("FAIL");
      expect(score.faults, fact).toContain(`card ${x.result.differences[0].id} states ${fact}, which its source texts disprove`);
      expect(score.events[0], fact).toMatchObject({
        discovery: true,
        attribution: true,
        position: true,
        falseFacts: [expect.stringContaining(fact)],
      });
    }
  });
  it("format 2 has no category: the answer's old acceptable_categories are not checked", () => {
    const x = example();
    x.expected.events[0].acceptable_categories = ["Cosmetic"];
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
  });
});
describe("identity applicability: checked, explicit N/A, or not evaluated", () => {
  const caseDir = "validation/dataset/cases";
  const allExpected = () =>
    readdirSync(caseDir).map(
      (c) =>
        JSON.parse(
          readFileSync(`${caseDir}/${c}/expected.json`, "utf8"),
        ) as Expected,
    );
  const as = (
    x: ReturnType<typeof example>,
    eventId: string,
    logicalPath: string,
  ) => {
    x.expected.evidence_locations = {
      [eventId]: x.expected.evidence_locations.amount,
    };
    Object.assign(x.expected.events[0], {
      event_id: eventId,
      logical_path: logicalPath,
    });
    return x;
  };
  // R16:E1 (the page title the repagination adds) was registered in issue #2 round 5: 11 -> 12.
  it("the 32 pairs have exactly the 13 known N/A events in 12 cases and no unsupported path", () => {
    const text = allExpected().flatMap((c) =>
      c.events.filter(
        (e) => e.detection_requirement !== "coverage_warning_required",
      ),
    );
    const of = (a: string) =>
      text
        .filter((e) => identityRule(e).applicability === a)
        .map((e) => e.event_id)
        .sort();
    expect(of("not_applicable")).toEqual(Object.keys(IDENTITY_NOT_APPLICABLE).sort());
    expect(of("not_applicable")).toHaveLength(13);
    expect(new Set(of("not_applicable").map((id) => id.split(":")[0])).size).toBe(12);
    expect(of("unsupported")).toEqual([]);
    // Coverage-warning events are a separate branch and are not counted as identity events.
    const coverage = allExpected().flatMap((c) =>
      c.events.filter((e) => e.detection_requirement === "coverage_warning_required"),
    );
    expect(coverage.map((e) => e.event_id).sort()).toEqual([
      "R27_mixed_scan_page:E1",
      "R28_inline_scan:E1",
    ]);
    expect(coverage.some((e) => e.event_id in IDENTITY_NOT_APPLICABLE)).toBe(false);
  });
  it("N/A skips only the identity check", () => {
    const x = as(example(), "R05_negation:E1", "clauses.territory.text");
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("PASS");
    expect(score.events[0].identity?.applicability).toBe("not_applicable");
    x.result.differences[0].structurePath!.entity = "wrong";
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
  });
  const kept: Record<string, (r: CompareResult) => void> = {
    "wrong page": (r) => {
      r.differences[0].left[0].pageIndex = 9;
    },
    hidden: (r) => {
      (r.differences[0] as unknown as { defaultVisible: boolean }).defaultVisible = false;
    },
    "wrong operation": (r) => {
      r.differences[0].kind = "Added";
    },
    "false stated fact": (r) => {
      r.differences[0].facts = ["whitespace_only"];
    },
    "no output": (r) => {
      r.differences = [];
    },
    "unjustified partial": (r) => {
      r.status = "partial";
    },
  };
  for (const [name, mutate] of Object.entries(kept))
    it("N/A still fails on " + name, () => {
      const x = as(example(), "R19_rotated_status:E1", "document.status");
      mutate(x.result);
      expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
    });
  it("an unknown path is NOT_EVALUATED, never PASS, and a proven fault still FAILs", () => {
    const x = as(example(), "new_case:E1", "endorsements.cyber.limit");
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.events[0]).toMatchObject({ verdict: "NOT_EVALUATED", pass: false });
    expect(score.notEvaluated.map((n) => n.eventId)).toEqual(["new_case:E1"]);
    expect(score.faults).toEqual([]);
    x.result.differences = [];
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
  it("an N/A entry does not cover the same event under another path", () => {
    const x = as(example(), "R05_negation:E1", "clauses.exclusions.text");
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("NOT_EVALUATED");
  });
  it("an unknown detection branch is NOT_EVALUATED", () => {
    const x = example();
    x.expected.events[0].detection_requirement = "detect_if_possible";
    expect(grade(x.result, x.expected, x.layout, x.docs)).toMatchObject({
      status: "NOT_EVALUATED",
      faults: [],
    });
  });
  it("summaries never count NOT_EVALUATED or unknown states as passed", () => {
    const ok = { caseId: "a", status: "PASS" },
      open = { caseId: "b", status: "NOT_EVALUATED" };
    expect(summarize([ok, open])).toMatchObject({
      status: "NOT_EVALUATED",
      passed: 1,
      total: 2,
      notEvaluated: ["b"],
      failed: [],
    });
    expect(summarize([ok, open, { caseId: "c", status: "FAIL" }]).status).toBe("FAIL");
    expect(summarize([ok, { caseId: "d", status: "ERROR" }])).toMatchObject({
      status: "FAIL",
      passed: 1,
      failed: ["d"],
    });
    expect(summarize([ok]).status).toBe("PASS");
  });
  it("R13: the exact move and the similar new clause are not interchangeable", () => {
    const P = "The insurer will pay covered losses arising from approved operations worldwide.",
      Q = "The insurer will pay approved losses arising from approved operations worldwide.",
      keep = "Other clause text stays here unchanged for context.",
      claims = "Claims must be notified promptly to the insurer.";
    const left = textDoc([
        { text: "LOSS PAYMENT", y: 100 },
        { text: P, y: 130 },
        { text: keep, y: 170 },
        { text: "CLAIMS", y: 100, page: 1 },
        { text: claims, y: 130, page: 1 },
      ]),
      right = textDoc([
        { text: "LOSS PAYMENT", y: 100 },
        { text: Q, y: 130 },
        { text: keep, y: 170 },
        { text: "CLAIMS", y: 100, page: 1 },
        { text: claims, y: 130, page: 1 },
        { text: P, y: 170, page: 1 },
      ]);
    const runs = (d: DocInput) => ({
      pages: d.pages.map((p) => ({
        text_runs: p.lines.map((l) => {
          const chars = l.charIds.map((id) => p.chars.find((c) => c.id === id)!);
          return {
            run_id: l.id,
            text: chars.map((c) => c.text).join(""),
            direction: [1, 0],
            characters: chars.map((c) => ({
              quad_tl_tr_br_bl: [
                [c.quad[0], c.quad[1]],
                [c.quad[2], c.quad[3]],
                [c.quad[6], c.quad[7]],
                [c.quad[4], c.quad[5]],
              ],
            })),
          };
        }),
      })),
    });
    const expected: Expected = {
      case_id: "R13-like",
      required_status: "complete_for_scope",
      events: [
        {
          event_id: "R13_move_and_replacement:E1",
          logical_path: "clauses.loss_payment",
          old: P,
          new: P,
          operation: "move",
          detection_requirement: "must_detect",
          acceptable_kinds: ["Moved"],
          acceptable_categories: ["Review", "Material"],
        },
        {
          event_id: "R13_move_and_replacement:E2",
          logical_path: "clauses.new_loss_payment",
          old: null,
          new: Q,
          operation: "add",
          detection_requirement: "must_detect",
          acceptable_kinds: ["Added"],
          acceptable_categories: ["Material", "Review"],
        },
      ],
      invariants: ["exact_move_must_not_be_consumed_by_local_replacement"],
      coverage_requirements: [],
      evidence_locations: {
        "R13_move_and_replacement:E1": {
          before: [{ page_index: 0, run_id: "l1" }],
          after: [{ page_index: 1, run_id: "l5" }],
        },
        "R13_move_and_replacement:E2": {
          before: [],
          after: [{ page_index: 0, run_id: "l1" }],
        },
      },
    };
    const layout = { before: runs(left), after: runs(right) } as Layout;
    const docs = [left, right] as [DocInput, DocInput];
    const fresh = () => compare(left, right);
    const score = grade(fresh(), expected, layout, docs);
    expect(score.status).toBe("PASS");
    expect(score.events.map((e) => e.identity?.applicability)).toEqual([
      "not_applicable",
      "not_applicable",
    ]);
    const failing = (r: CompareResult) =>
      grade(r, expected, layout, docs)
        .events.filter((e) => e.verdict === "FAIL")
        .map((e) => e.eventId);
    // Consumed: the move becomes a local replacement by the similar clause.
    const consumed = fresh();
    const moved = consumed.differences.find((d) => d.kind === "Moved")!,
      added = consumed.differences.find((d) => d.kind === "Added")!;
    consumed.differences = [
      {
        ...moved,
        kind: "Replaced",
        newText: added.newText,
        right: added.right,
        hasTextChange: true,
        textOps: [
          { kind: "delete", text: moved.oldText, left: moved.left, right: [] },
          { kind: "insert", text: added.newText, left: [], right: added.right },
        ],
      },
    ];
    expect(failing(consumed)).toEqual([
      "R13_move_and_replacement:E1",
      "R13_move_and_replacement:E2",
    ]);
    // Swapped: the new clause reported as the move cannot satisfy the add.
    const swapped = fresh();
    swapped.differences.find((d) => d.kind === "Added")!.kind = "Moved";
    expect(failing(swapped)).toContain("R13_move_and_replacement:E2");
    // The added clause found at the moved clause's position is not positioned.
    const misplaced = fresh();
    const add = misplaced.differences.find((d) => d.kind === "Added")!;
    for (const loc of [...add.right, ...add.textOps.flatMap((o) => o.right)])
      loc.pageIndex = 1;
    expect(failing(misplaced)).toContain("R13_move_and_replacement:E2");
  });
});
// Layout runs and source locations taken from a synthetic document, one run per line; `split`
// cuts a line into cell runs ([start, end, logical path]), and an empty split leaves it out.
const layoutOf = (
  d: DocInput,
  paths: Record<string, string> = {},
  split: Record<string, [number, number, string][]> = {},
) => ({
  pages: d.pages.map((p) => ({
    text_runs: p.lines.flatMap((l) => {
      const chars = l.charIds.map((id) => p.chars.find((c) => c.id === id)!);
      const run = (run_id: string, cs: typeof chars, logical_path: string | null) => ({
        run_id,
        logical_path,
        text: cs.map((c) => c.text).join(""),
        direction: [1, 0],
        characters: cs.map((c) => ({
          quad_tl_tr_br_bl: [
            [c.quad[0], c.quad[1]],
            [c.quad[2], c.quad[3]],
            [c.quad[6], c.quad[7]],
            [c.quad[4], c.quad[5]],
          ],
        })),
      });
      return split[l.id]
        ? split[l.id].map(([a, b, path], k) => run(`${l.id}.${k}`, chars.slice(a, b), path))
        : [run(l.id, chars, paths[l.id] ?? null)];
    }),
  })),
});
// Characters [a, b) of a location; a run-level location keeps its shared quad.
const slice = (loc: SourceLocation, a: number, b: number): SourceLocation => ({
  ...loc,
  rawRange: [loc.rawRange[0] + a, loc.rawRange[0] + b],
  charIds: loc.charIds.slice(a, b),
  text: loc.text.slice(a, b),
  quads: loc.precision === "run" ? loc.quads : loc.quads.slice(a, b),
});
// One location per character, in the given order.
const glyphs = (loc: SourceLocation, order = Array.from(loc.text, (_, i) => i)) => order.map((i) => slice(loc, i, i + 1));
const lineLoc = (d: DocInput, side: "left" | "right", lineId: string): SourceLocation => {
  const page = d.pages.find((p) => p.lines.some((l) => l.id === lineId))!;
  const line = page.lines.find((l) => l.id === lineId)!;
  const chars = line.charIds.map((id) => page.chars.find((c) => c.id === id)!);
  return {
    side,
    pageIndex: page.pageIndex,
    unitId: lineId,
    rawRange: [chars[0].rawRange[0], chars.at(-1)!.rawRange[1]],
    charIds: [...line.charIds],
    text: chars.map((c) => c.text).join(""),
    quads: chars.map((c) => c.quad),
    direction: line.direction,
    precision: "synthetic",
  };
};
const replaced = (
  id: string,
  left: SourceLocation,
  right: SourceLocation,
  path: Partial<NonNullable<Difference["structurePath"]>>,
): Difference => ({
  id,
  kind: "Replaced",
  structurePath: {
    section: "s",
    entity: null,
    field: null,
    table: null,
    rowKey: null,
    confidence: "reliable",
    ...path,
  },
  left: [left],
  right: [right],
  oldText: left.text,
  newText: right.text,
  textOps: [
    { kind: "delete", text: left.text, left: [left], right: [] },
    { kind: "insert", text: right.text, left: [], right: [right] },
  ],
  hasTextChange: left.text !== right.text,
  defaultVisible: true,
  matchEvidence: { method: "test", score: null, details: [] },
  reviewReasons: [],
  occurrences: [],
  facts: [],
  repeat: null,
});
describe("one correct event card cannot offset an extra wrong card (#10)", () => {
  // R26: registration renamed, every agreed value unchanged.
  // Columns: registration, serial, MSN (a bare-number identifier), currency, agreed value.
  const table = (
    registration: string,
    bare: boolean,
    amounts = bare ? ["100000", "200000"] : ["100,000", "200,000"],
    rows: string[] = [],
  ) =>
    textDoc([
      { text: "SCHEDULE OF AIRCRAFT", y: 100 },
      { text: "TEST-A789", x: 40, y: 150 },
      { text: "SYN-1026-001", x: 150, y: 150 },
      { text: "1315", x: 240, y: 150 },
      { text: "USD", x: 300, y: 150 },
      { text: amounts[0], x: 360, y: 150 },
      { text: registration, x: 40, y: 180 },
      { text: "SYN-1026-003", x: 150, y: 180 },
      { text: "1748", x: 240, y: 180 },
      { text: "USD", x: 300, y: 180 },
      { text: amounts[1], x: 360, y: 180 },
      ...rows.map((text, i) => ({ text, x: 40, y: 210 + 30 * i })),
    ]);
  const cells = (row: string, first: number) =>
    Object.fromEntries(
      ["registration", "serial", "msn", "currency", "agreed_value"].map((f, i) => [
        `l${first + i}`,
        `aircraft_schedule.${row}.${f}`,
      ]),
    );
  const paths = { ...cells("SYN-1026-001", 1), ...cells("SYN-1026-003", 6) };
  // Extra records "MSN OPERATOR AMOUNT", one source line each; layout.json cuts them into cells.
  type Rows = { left: string[]; right: string[]; inLayout?: boolean; cover?: string[]; coarse?: boolean };
  const rowCells = (rows: string[], inLayout = true, cover = ["msn", "operator", "agreed_value"]) =>
    Object.fromEntries(
      rows.map((text, i): [string, [number, number, string][]] => {
        const a = text.indexOf(" "),
          b = text.lastIndexOf(" "),
          path = `aircraft_schedule.SYN-9${i}`;
        return [
          `l${11 + i}`,
          inLayout
            ? ([
                [0, a, `${path}.msn`],
                [a + 1, b, `${path}.operator`],
                [b + 1, text.length, `${path}.agreed_value`],
              ] as [number, number, string][]).filter(([, , p]) => cover.includes(p.split(".").at(-1)!))
            : [],
        ];
      }),
    );
  const r26 = (bare = false, amounts?: string[], rows?: Rows, newAmounts = amounts) => {
    const left = table("TEST-C941", bare, amounts, rows?.left),
      right = table("TEST-RENAMED", bare, newAmounts, rows?.right);
    const expected: Expected = {
      case_id: "R26_key_change",
      required_status: "complete_for_scope",
      events: [
        {
          event_id: "R26_key_change:E1",
          logical_path: "aircraft_schedule.SYN-1026-003.registration",
          old: "TEST-C941",
          new: "TEST-RENAMED",
          operation: "replace",
          detection_requirement: "must_detect",
          acceptable_kinds: ["Replaced", "Added+Removed"],
          acceptable_categories: ["Material", "Review"],
        },
      ],
      invariants: ["agreed_value_unchanged", "secondary_key_or_explicit_identity_review"],
      coverage_requirements: [],
      evidence_locations: {
        "R26_key_change:E1": {
          before: [{ page_index: 0, run_id: "l6" }],
          after: [{ page_index: 0, run_id: "l6" }],
        },
      },
    };
    const layout = {
      before: layoutOf(left, paths, rowCells(rows?.left ?? [], rows?.inLayout, rows?.cover)),
      after: layoutOf(right, paths, rowCells(rows?.right ?? [], rows?.inLayout, rows?.cover)),
    } as Layout;
    // Run-level extraction: every character of an extra row shares the row's box (layout.json keeps cells).
    if (rows?.coarse)
      for (const d of [left, right])
        for (const line of d.pages[0].lines.slice(11)) {
          const cs = d.pages[0].chars.filter((c) => line.charIds.includes(c.id));
          const [x0, y0, x1, y1] = [Math.min(...cs.map((c) => c.quad[0])), Math.min(...cs.map((c) => c.quad[1])), Math.max(...cs.map((c) => c.quad[2])), Math.max(...cs.map((c) => c.quad[5]))];
          for (const c of cs) c.quad = [x0, y0, x1, y0, x0, y1, x1, y1];
        }
    const result = compare(left, right);
    result.status = "complete_for_scope";
    result.unresolved = [];
    result.coverage = [];
    result.differences = [
      replaced("registration", lineLoc(left, "left", "l6"), lineLoc(right, "right", "l6"), {
        section: "aircraft_schedule",
        entity: "SYN-1026-003",
        field: "registration",
        table: "aircraft_schedule",
        rowKey: "SYN-1026-003",
      }),
    ];
    // Wrong pairing: old side of row SYN-1026-001 (100,000) against new side of row SYN-1026-003 (200,000).
    const wrong = replaced("wrong-amount", lineLoc(left, "left", "l5"), lineLoc(right, "right", "l10"), {
      section: "aircraft_schedule",
      entity: "SYN-1026-001",
      field: "agreed_value",
      table: "aircraft_schedule",
      rowKey: "SYN-1026-001",
    });
    return {
      docs: [left, right] as [DocInput, DocInput],
      expected,
      layout,
      result,
      wrong,
      coarse: rows?.coarse,
    };
  };
  for (const bare of [false, true])
    for (const fine of [false, true])
    it(`R26: correct registration card plus a wrong agreed-value card fails (${bare ? "100000" : "100,000"}, fine geometry ${fine})`, () => {
      const x = r26(bare);
      expect(ResultSchema.safeParse(x.result).success).toBe(true);
      expect(grade(x.result, x.expected, x.layout, x.docs, fine).status).toBe("PASS");
      x.result.differences.push(x.wrong);
      // The forged card is schema-valid and every reference resolves to real input characters.
      expect(ResultSchema.safeParse(x.result).success).toBe(true);
      expect(x.wrong.left.concat(x.wrong.right).every((l) => resolveLocation(l, x.docs))).toBe(true);
      const score = grade(x.result, x.expected, x.layout, x.docs, fine);
      expect(score.status).toBe("FAIL");
      expect(score.events[0].verdict).toBe("PASS");
      expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
    });
  it("R26: a wrong bare-number amount card fails whatever field it claims; layout.json names the cell", () => {
    const x = r26(true);
    x.result.differences.push({ ...x.wrong, structurePath: { ...x.wrong.structurePath!, field: "registration" } });
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
  });
  it("R26: a wrong amount card cannot hide the change by citing one location per digit", () => {
    // 100020 and 200010 have the same digits, so tokens taken per location would match.
    const x = r26(true, ["100020", "200010"]);
    const left = glyphs(lineLoc(x.docs[0], "left", "l5")),
      right = glyphs(lineLoc(x.docs[1], "right", "l10"));
    x.result.differences.push({
      ...x.wrong,
      structurePath: { ...x.wrong.structurePath!, field: "registration" },
      left,
      right,
      textOps: [
        { kind: "delete", text: "100020", left, right: [] },
        { kind: "insert", text: "200010", left: [], right },
      ],
    });
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
  });
  it("R26: an agreed value whose sign changes is an amount change (r4417025747)", () => {
    // -100,020 -> 100,020 in the first record's agreed-value cell, reported on that record's card.
    const x = r26(false, ["-100,020", "200,000"], undefined, ["100,020", "200,000"]);
    x.result.differences.push({ ...x.wrong, id: "sign", right: [lineLoc(x.docs[1], "right", "l5")], newText: "100,020", textOps: [{ kind: "delete", text: "-", left: [slice(x.wrong.left[0], 0, 1)], right: [] }, { kind: "equal", text: "100,020", left: [slice(x.wrong.left[0], 1, 8)], right: [lineLoc(x.docs[1], "right", "l5")] }] });
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
    // Control: a hyphen between numbers is no sign; "1-100,000" keeps the amount 100,000.
    const y = r26(false, ["1-100,000", "200,000"]);
    expect(grade(y.result, y.expected, y.layout, y.docs).status).toBe("PASS");
  });
  // A card pairing two extra records: d.left/right cite whole rows, the text operations single cells.
  const ROWS = { left: ["1315 Alpha Air 100000", "1748 Alpha Air 200000"], right: ["1315 Alpha Air 100000", "1748 Alpha Air 200000"] };
  const rowCard = (x: ReturnType<typeof r26>, leftLine: string, rightLine: string, field = "registration") => {
    const run = (l: SourceLocation): SourceLocation => (x.coarse ? { ...l, precision: "run", quads: [l.quads[0]] } : l);
    const L = run(lineLoc(x.docs[0], "left", leftLine)),
      R = run(lineLoc(x.docs[1], "right", rightLine));
    const [la, lb, ra, rb] = [L.text.indexOf(" "), L.text.lastIndexOf(" "), R.text.indexOf(" "), R.text.lastIndexOf(" ")];
    const card = replaced("row", L, R, { section: "aircraft_schedule", entity: null, field, table: "aircraft_schedule", rowKey: null });
    card.textOps = [
      { kind: "delete", text: L.text.slice(0, la), left: [slice(L, 0, la)], right: [] },
      { kind: "insert", text: R.text.slice(0, ra), left: [], right: [slice(R, 0, ra)] },
      { kind: "equal", text: L.text.slice(la, lb + 1), left: [slice(L, la, lb + 1)], right: [slice(R, ra, rb + 1)] },
      { kind: "delete", text: L.text.slice(lb + 1), left: [slice(L, lb + 1, L.text.length)], right: [] },
      { kind: "insert", text: R.text.slice(rb + 1), left: [], right: [slice(R, rb + 1, R.text.length)] },
    ];
    return card;
  };
  const graded = (x: ReturnType<typeof r26>, card: Difference, fine = false) => {
    x.result.differences.push(card);
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const locs = [...card.left, ...card.right, ...card.textOps.flatMap((o) => [...o.left, ...o.right])];
    expect(locs.every((l) => resolveLocation(l, x.docs))).toBe(true);
    return grade(x.result, x.expected, x.layout, x.docs, fine);
  };
  for (const fine of [false, true])
    it(`R26: a wrong card citing whole rows cannot hide the amount change (fine geometry ${fine})`, () => {
      const x = r26(true, undefined, ROWS);
      expect(grade(x.result, x.expected, x.layout, x.docs, fine).status).toBe("PASS");
      const score = graded(x, rowCard(x, "l11", "l12"), fine);
      expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
      expect(score.status).toBe("FAIL");
      expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
      expect(exitCode(summarize([score]))).toBe(1);
    });
  it("R26: the same wrong pairing cited cell by cell, or under a declared amount field, fails as well", () => {
    const x = r26(true, undefined, ROWS);
    const card = rowCard(x, "l11", "l12");
    card.left = card.textOps.flatMap((o) => (o.kind === "insert" ? [] : o.left));
    card.right = card.textOps.flatMap((o) => (o.kind === "delete" ? [] : o.right));
    expect(graded(x, card).status).toBe("FAIL");
    const y = r26(true, undefined, ROWS);
    expect(graded(y, rowCard(y, "l11", "l12", "agreed_value")).status).toBe("FAIL");
  });
  it("R26: a whole-row card for one record's MSN change passes", () => {
    const x = r26(true, undefined, { ...ROWS, right: ["1316 Alpha Air 100000", "1748 Alpha Air 200000"] });
    expect(graded(x, rowCard(x, "l11", "l11")).status).toBe("PASS");
  });
  it("R26: a card claiming a change inside an unchanged amount cell by citing part of it fails", () => {
    // Both sides keep 100020; the card cites "100" on the left and "020" on the right.
    const x = r26(true, ["100020", "200010"]);
    const L = slice(lineLoc(x.docs[0], "left", "l5"), 0, 3),
      R = slice(lineLoc(x.docs[1], "right", "l5"), 3, 6);
    const score = graded(x, replaced("part", L, R, { section: "aircraft_schedule", entity: "SYN-1026-001", field: "registration", table: "aircraft_schedule", rowKey: "SYN-1026-001" }));
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
  });
  it("R26: citing an unchanged amount's glyphs in another order cannot hide the claimed change", () => {
    // 100020 stays on both sides; the right side cites its glyphs as 2,0,0,0,1,0 to back "200010".
    const x = r26(true, ["100020", "200010"]);
    const L = glyphs(lineLoc(x.docs[0], "left", "l5")),
      R = glyphs(lineLoc(x.docs[1], "right", "l5"), [4, 1, 2, 3, 0, 5]);
    const card = replaced("order", L[0], R[0], { section: "aircraft_schedule", entity: "SYN-1026-001", field: "registration", table: "aircraft_schedule", rowKey: "SYN-1026-001" });
    Object.assign(card, {
      left: L,
      right: R,
      oldText: "100020",
      newText: "200010",
      textOps: [
        { kind: "delete", text: "100020", left: L, right: [] },
        { kind: "insert", text: "200010", left: [], right: R },
      ],
    });
    const score = graded(x, card);
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
  });
  it("R26: splitting the claimed amount into one operation per glyph cannot hide the change", () => {
    // As above, but every glyph sits in its own delete or insert operation.
    const x = r26(true, ["100020", "200010"]);
    const L = glyphs(lineLoc(x.docs[0], "left", "l5")),
      R = glyphs(lineLoc(x.docs[1], "right", "l5"), [4, 1, 2, 3, 0, 5]);
    const card = replaced("ops", L[0], R[0], { section: "aircraft_schedule", entity: "SYN-1026-001", field: "registration", table: "aircraft_schedule", rowKey: "SYN-1026-001" });
    Object.assign(card, {
      left: L,
      right: R,
      oldText: "100020",
      newText: "200010",
      textOps: [
        ...L.map((l) => ({ kind: "delete" as const, text: l.text, left: [l], right: [] })),
        ...R.map((r) => ({ kind: "insert" as const, text: r.text, left: [], right: [r] })),
      ],
    });
    const score = graded(x, card);
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
  });
  it("R26: one card swapping two unchanged amount cells cannot pass; their correspondence is NOT_EVALUATED", () => {
    // Rows keep 100000 and 200000; one card cites them as 100000,200000 on the left and 200000,100000 on the right.
    const x = r26(true);
    const [l, r] = x.docs;
    const L = [lineLoc(l, "left", "l5"), lineLoc(l, "left", "l10")],
      R = [lineLoc(r, "right", "l10"), lineLoc(r, "right", "l5")];
    const card = replaced("swap", L[0], R[0], { section: "aircraft_schedule", entity: null, field: "registration", table: "aircraft_schedule", rowKey: null });
    Object.assign(card, {
      left: L,
      right: R,
      oldText: "100000200000",
      newText: "200000100000",
      textOps: [
        { kind: "delete", text: "100000", left: [L[0]], right: [] },
        { kind: "delete", text: "200000", left: [L[1]], right: [] },
        { kind: "insert", text: "200000", left: [], right: [R[0]] },
        { kind: "insert", text: "100000", left: [], right: [R[1]] },
      ],
    });
    const score = graded(x, card);
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
    expect(exitCode(summarize([score]))).toBe(1);
  });
  it("R26: one card swapping parts of two unchanged currency codes cannot pass; their correspondence is NOT_EVALUATED", () => {
    // Both rows keep USD; one card cites "U" of row 1 and "D" of row 3 as UD on the left and DU on the right.
    const x = r26(true);
    const [l, r] = x.docs;
    const L = [slice(lineLoc(l, "left", "l4"), 0, 1), slice(lineLoc(l, "left", "l9"), 2, 3)],
      R = [slice(lineLoc(r, "right", "l9"), 2, 3), slice(lineLoc(r, "right", "l4"), 0, 1)];
    const card = replaced("code-swap", L[0], R[0], { section: "aircraft_schedule", entity: null, field: "registration", table: "aircraft_schedule", rowKey: null });
    Object.assign(card, {
      left: L,
      right: R,
      oldText: "UD",
      newText: "DU",
      textOps: [
        { kind: "delete", text: "U", left: [L[0]], right: [] },
        { kind: "delete", text: "D", left: [L[1]], right: [] },
        { kind: "insert", text: "D", left: [], right: [R[0]] },
        { kind: "insert", text: "U", left: [], right: [R[1]] },
      ],
    });
    const score = graded(x, card);
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
    expect(exitCode(summarize([score]))).toBe(1);
  });
  it("R26: run-level geometry that leaves a cited amount outside layout.json is NOT_EVALUATED", () => {
    // Each extra row is one shared box; layout.json covers only the MSN cells.
    const x = r26(true, undefined, { ...ROWS, coarse: true, cover: ["msn"] });
    const score = graded(x, rowCard(x, "l11", "l12"));
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
    expect(exitCode(summarize([score]))).toBe(1);
  });
  it("R26: with run-level geometry a wrong row pairing still fails, and an MSN-only change cannot be attributed", () => {
    const x = r26(true, undefined, { ...ROWS, coarse: true });
    expect(graded(x, rowCard(x, "l11", "l12")).status).toBe("FAIL");
    const y = r26(true, undefined, { ...ROWS, right: ["1316 Alpha Air 100000", "1748 Alpha Air 200000"], coarse: true });
    const score = graded(y, rowCard(y, "l11", "l11"));
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
  });
  it("R26: row-wide locations that layout.json does not cover are NOT_EVALUATED, not PASS", () => {
    const x = r26(true, undefined, { ...ROWS, inLayout: false });
    const score = graded(x, rowCard(x, "l11", "l12"));
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
    expect(exitCode(summarize([score]))).toBe(1);
  });
  it("R26: a bare-number identifier change (MSN) is not taken for an amount change", () => {
    const x = r26(true);
    x.expected.invariants = ["agreed_value_unchanged", "no_amount_or_currency_change"];
    x.result.differences.push(
      replaced("msn", lineLoc(x.docs[0], "left", "l3"), lineLoc(x.docs[1], "right", "l8"), {
        section: "aircraft_schedule",
        entity: "SYN-1026-001",
        field: "msn",
        table: "aircraft_schedule",
        rowKey: "SYN-1026-001",
      }),
    );
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("PASS");
    expect(score.invariants.map((i) => i.result)).toEqual(["PASS", "PASS"]);
  });
  // Delete + add cards: amounts may cancel only within one record and field.
  const oneSided = (kind: "Added" | "Removed", id: string, loc: SourceLocation, rowKey: string | null, field = "agreed_value"): Difference => {
    const card = replaced(id, loc, loc, {
      section: "aircraft_schedule",
      entity: rowKey,
      field,
      table: "aircraft_schedule",
      rowKey,
    });
    return kind === "Removed"
      ? { ...card, kind, right: [], newText: "", hasTextChange: true, textOps: [card.textOps[0]] }
      : { ...card, kind, left: [], oldText: "", hasTextChange: true, textOps: [{ ...card.textOps[1], text: loc.text, right: [loc] }] };
  };
  const swapped = (x: ReturnType<typeof r26>, a: string | null, b: string | null) => {
    const [l, r] = x.docs;
    x.result.differences.push(
      oneSided("Removed", "a-out", lineLoc(l, "left", "l5"), a),
      oneSided("Added", "a-in", lineLoc(r, "right", "l10"), a),
      oneSided("Removed", "b-out", lineLoc(l, "left", "l10"), b),
      oneSided("Added", "b-in", lineLoc(r, "right", "l5"), b),
    );
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    return grade(x.result, x.expected, x.layout, x.docs);
  };
  it("R26: amounts swapped between two records through delete + add cards fail", () => {
    const score = swapped(r26(), "SYN-1026-001", "SYN-1026-003");
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("agreed_value_unchanged");
  });
  it("R26: delete + add amounts that cancel only across cards without a record are NOT_EVALUATED", () => {
    const score = swapped(r26(), null, null);
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([
      { invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" },
    ]);
    expect(exitCode(summarize([score]))).toBe(1);
  });
  it("R26: delete + add cards claiming different parts of an unchanged amount cell fail", () => {
    // One record, unchanged 100020: the Removed card cites "100", the Added card "020".
    const x = r26(true, ["100020", "200010"]);
    const [l, r] = x.docs;
    x.result.differences.push(
      oneSided("Removed", "out", slice(lineLoc(l, "left", "l5"), 0, 3), "SYN-1026-001", "registration"),
      oneSided("Added", "in", slice(lineLoc(r, "right", "l5"), 3, 6), "SYN-1026-001", "registration"),
    );
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
  });
  it("R26: delete + add cards declaring agreed_value cannot hide a claim by splitting it across cards", () => {
    // Unchanged 100020: six Removed cards cite its digits in order, six Added cards back "200010".
    const x = r26(true, ["100020", "200010"]);
    const [l, r] = x.docs;
    x.result.differences.push(
      ...glyphs(lineLoc(l, "left", "l5")).map((g, i) => oneSided("Removed", `out${i}`, g, "SYN-1026-001")),
      ...glyphs(lineLoc(r, "right", "l5"), [4, 1, 2, 3, 0, 5]).map((g, i) => oneSided("Added", `in${i}`, g, "SYN-1026-001")),
    );
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
  });
  it("R26: removing an unchanged currency letter by letter across cards fails, with or without a record", () => {
    // The USD cell of row SYN-1026-001 stays; three Removed cards cite U, S and D.
    for (const rowKey of ["SYN-1026-001", null]) {
      const x = r26(true);
      x.result.differences.push(
        ...glyphs(lineLoc(x.docs[0], "left", "l4")).map((g, i) => oneSided("Removed", `cur${i}`, g, rowKey, "currency")),
      );
      expect(ResultSchema.safeParse(x.result).success).toBe(true);
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
      expect(score.status).toBe("FAIL");
    }
  });
  it("R26: removing or changing part of an unchanged currency code fails, with or without a record", () => {
    // The USD cell of row SYN-1026-001 stays; the claims hold no whole currency code.
    for (const rowKey of ["SYN-1026-001", null])
      for (const field of ["currency", "agreed_value"]) {
        const x = r26(true);
        x.result.differences.push(oneSided("Removed", "cur-u", slice(lineLoc(x.docs[0], "left", "l4"), 0, 1), rowKey, field));
        expect(ResultSchema.safeParse(x.result).success).toBe(true);
        const score = grade(x.result, x.expected, x.layout, x.docs);
        expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged")), `${rowKey} ${field}`).toEqual([]);
        expect(score.status, `${rowKey} ${field}`).toBe("FAIL");
      }
    // One Replaced card: "U" on the left, "D" on the right of the same unchanged cell.
    const x = r26(true);
    const score = graded(
      x,
      replaced("cur-part", slice(lineLoc(x.docs[0], "left", "l4"), 0, 1), slice(lineLoc(x.docs[1], "right", "l4"), 2, 3), {
        section: "aircraft_schedule",
        entity: "SYN-1026-001",
        field: "registration",
        table: "aircraft_schedule",
        rowKey: "SYN-1026-001",
      }),
    );
    expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged"))).toEqual([]);
    expect(score.status).toBe("FAIL");
  });
  it("R26: one record's unchanged cell split differently on the two sides: duplicate counting is NOT_EVALUATED, a real claim change still fails", () => {
    // One record and field, cell 100020 unchanged; Removed and Added cards cite it whole or glyph by glyph.
    const whole = (x: ReturnType<typeof r26>, side: "left" | "right") => [lineLoc(x.docs[side === "left" ? 0 : 1], side, "l5")];
    const split = (x: ReturnType<typeof r26>, side: "left" | "right", order?: number[]) =>
      glyphs(lineLoc(x.docs[side === "left" ? 0 : 1], side, "l5"), order);
    const cases: [string, (x: ReturnType<typeof r26>) => [SourceLocation[], SourceLocation[]], string][] = [
      ["whole + whole", (x) => [whole(x, "left"), whole(x, "right")], "PASS"],
      ["six glyphs + whole", (x) => [split(x, "left"), whole(x, "right")], "NOT_EVALUATED"],
      ["whole + six glyphs", (x) => [whole(x, "left"), split(x, "right")], "NOT_EVALUATED"],
      ["glyphs + glyphs in source order", (x) => [split(x, "left"), split(x, "right")], "PASS"],
      ["whole + glyphs backing 200010", (x) => [whole(x, "left"), split(x, "right", [4, 1, 2, 3, 0, 5])], "FAIL"],
    ];
    for (const [name, cite, want] of cases) {
      const x = r26(true, ["100020", "200010"]);
      const [gone, come] = cite(x);
      x.result.differences.push(
        ...gone.map((g, i) => oneSided("Removed", `out${i}`, g, "SYN-1026-001")),
        ...come.map((g, i) => oneSided("Added", `in${i}`, g, "SYN-1026-001")),
      );
      expect(ResultSchema.safeParse(x.result).success, name).toBe(true);
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged")), name).toEqual([]);
      expect(score.status, name).toBe(want);
      if (want === "NOT_EVALUATED") {
        expect(score.notEvaluated, name).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
        expect(exitCode(summarize([score])), name).toBe(1);
      }
    }
  });
  it("R26: the saved segmentation inputs: split cells are NOT_EVALUATED, one edit reported twice and a claimed change fail", () => {
    // Cell l5 of row SYN-1026-001 keeps its value; Removed and Added cards cite it whole or glyph by glyph.
    const at = (x: ReturnType<typeof r26>, side: "left" | "right") => lineLoc(x.docs[side === "left" ? 0 : 1], side, "l5");
    const cuts: [string, (x: ReturnType<typeof r26>, back: number[]) => [SourceLocation[], SourceLocation[]]][] = [
      ["whole + whole", (x) => [[at(x, "left")], [at(x, "right")]]],
      ["glyphs + whole", (x) => [glyphs(at(x, "left")), [at(x, "right")]]],
      ["whole + glyphs", (x) => [[at(x, "left")], glyphs(at(x, "right"))]],
      ["glyphs + glyphs", (x) => [glyphs(at(x, "left")), glyphs(at(x, "right"))]],
      ["whole twice + whole", (x) => [[at(x, "left"), at(x, "left")], [at(x, "right")]]],
      ["whole + glyphs backing another amount", (x, back) => [[at(x, "left")], glyphs(at(x, "right"), back)]],
    ];
    // label, bare amounts, amounts, row key, glyph order backing 200,010 / 200010, expected status per cut
    const variants: [string, boolean, string[], string | null, number[], string[]][] = [
      ["formatted 100,020 with a record", false, ["100,020", "200,010"], "SYN-1026-001", [5, 1, 2, 3, 4, 0, 6], ["PASS", "NOT_EVALUATED", "NOT_EVALUATED", "PASS", "FAIL", "FAIL"]],
      ["bare 100020 without a record", true, ["100020", "200010"], null, [4, 1, 2, 3, 0, 5], ["NOT_EVALUATED", "NOT_EVALUATED", "NOT_EVALUATED", "NOT_EVALUATED", "FAIL", "FAIL"]],
      ["bare 100020 with a record", true, ["100020", "200010"], "SYN-1026-001", [4, 1, 2, 3, 0, 5], ["PASS", "NOT_EVALUATED", "NOT_EVALUATED", "PASS", "FAIL", "FAIL"]],
    ];
    for (const [label, bare, amounts, rowKey, back, want] of variants)
      cuts.forEach(([cut, cite], i) => {
        const name = `${label}: ${cut}`;
        const x = r26(bare, amounts);
        const [gone, come] = cite(x, back);
        x.result.differences.push(
          ...gone.map((g, j) => oneSided("Removed", `out${j}`, g, rowKey)),
          ...come.map((g, j) => oneSided("Added", `in${j}`, g, rowKey)),
        );
        expect(ResultSchema.safeParse(x.result).success, name).toBe(true);
        expect([...gone, ...come].every((l) => resolveLocation(l, x.docs)), name).toBe(true);
        const score = grade(x.result, x.expected, x.layout, x.docs);
        expect(score.faults.filter((f) => !f.includes("agreed_value_unchanged")), name).toEqual([]);
        expect(score.status, name).toBe(want[i]);
        if (want[i] === "NOT_EVALUATED") {
          expect(score.notEvaluated, name).toMatchObject([{ invariant: "agreed_value_unchanged", kind: "invariant_unverifiable" }]);
          expect(exitCode(summarize([score])), name).toBe(1);
        }
        // One deletion cited twice fails for that reason; the doubled citation is never read as an amount.
        if (cut === "whole twice + whole") {
          expect(score.faults.join("\n"), name).toContain("one edit is reported twice");
          expect(score.faults.join("\n"), name).not.toMatch(/100,?020,?100,?020/);
        }
        if (cut === "whole + glyphs backing another amount") expect(score.faults.join("\n"), name).toMatch(/200,?010/);
      });
  });
  it("R26: a split cell left unevaluated does not hide a wrong pairing in another record", () => {
    const x = r26(false, ["100,020", "200,010"]);
    const [l, r] = x.docs;
    x.result.differences.push(
      ...glyphs(lineLoc(l, "left", "l5")).map((g, j) => oneSided("Removed", `out${j}`, g, "SYN-1026-001")),
      oneSided("Added", "in", lineLoc(r, "right", "l5"), "SYN-1026-001"),
      oneSided("Removed", "wrong-out", lineLoc(l, "left", "l10"), "SYN-1026-003"),
      oneSided("Added", "wrong-in", lineLoc(r, "right", "l5"), "SYN-1026-003"),
    );
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("record SYN-1026-003|agreed_value delete/add cards change 200,010 to 100,020");
  });
  it("R26: one record shown as delete + add with the same amount passes", () => {
    const x = r26();
    const [l, r] = x.docs;
    x.result.differences.push(
      oneSided("Removed", "out", lineLoc(l, "left", "l5"), "SYN-1026-001"),
      oneSided("Added", "in", lineLoc(r, "right", "l5"), "SYN-1026-001"),
    );
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
  });
  it("R26: matching the row by the renamed registration instead of the serial fails", () => {
    const x = r26();
    x.result.differences[0].structurePath!.rowKey = "TEST-C941";
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    // The card's edits lie on the record's registration cell; only its identity claim is false.
    expect(score.events[0]).toMatchObject({ discovery: true, attribution: true, position: true });
    expect(score.events[0].identity).toMatchObject({ pass: false, claims: ["wrong"], outcome: "wrong_statement" });
  });
  // #10 ruling 2: an explicit identity review is an answer-allowed form for R26; a missing identity
  // is not wrong, but neither determines the record nor reviews it explicitly.
  it("R26: an explicit identity review is accepted as presented, not as determined", () => {
    const x = r26();
    Object.assign(x.result.differences[0].structurePath!, { rowKey: null, entity: null, confidence: "unresolved" });
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("PASS");
    expect(score.events[0].identity).toMatchObject({ pass: true, determined: false, claims: ["unresolved"], outcome: "presented_unresolved" });
  });
  it("R26: a missing row key without an explicit review is not a wrong claim, but does not meet the answer", () => {
    const x = r26();
    Object.assign(x.result.differences[0].structurePath!, { rowKey: null, entity: null });
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.events[0]).toMatchObject({ attribution: true });
    expect(score.events[0].identity).toMatchObject({ pass: false, determined: false, claims: ["absent"], outcome: "requirement_unmet" });
  });
  // #10 ruling 4: Added+Removed is one Removed card on the record's old cell and one Added card on its
  // new cell, with the event's text, counted once.
  const renamePair = (x: ReturnType<typeof r26>, line = "l6", added = "TEST-RENAMED") => {
    const [l, r] = x.docs;
    const out = oneSided("Removed", "rename-out", lineLoc(l, "left", "l6"), "SYN-1026-003", "registration");
    const loc = lineLoc(r, "right", line);
    const at = loc.text.indexOf(added);
    const into = oneSided("Added", "rename-in", slice(loc, at, at + added.length), "SYN-1026-003", "registration");
    return [out, into];
  };
  it("R26: one delete + one add card on the record's registration cell is accepted once", () => {
    const x = r26();
    x.result.differences = renamePair(x);
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("PASS");
    expect(score.events[0]).toMatchObject({ representation: "delete+add", attribution: true });
    expect(score.events[0].identity).toMatchObject({ pass: true, determined: true });
    // A repeated half does not count the event twice.
    x.result.differences.push({ ...x.result.differences[0], id: "rename-out-again" });
    const again = grade(x.result, x.expected, x.layout, x.docs);
    expect(again.events).toHaveLength(1);
    expect(summarize([again]).eventRegression).toMatchObject({ passed: 1, total: 1 });
  });
  it("R26: a delete + add pair is not the event when the added text lies in another record, or is the old text moved", () => {
    // Another record (SYN-90) on the new side carries TEST-RENAMED, or the old registration.
    for (const [text, added] of [["TEST-RENAMED OPS 300,000", "TEST-RENAMED"], ["TEST-C941 OPS 300,000", "TEST-C941"]]) {
      const x = r26(false, undefined, { left: [], right: [text] });
      x.result.differences = renamePair(x, "l11", added);
      expect(ResultSchema.safeParse(x.result).success).toBe(true);
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status, text).toBe("FAIL");
      expect(score.events[0].attribution, text).toBe(false);
    }
  });
  it("R26: with a delete + add pair, another record's key on one half is a false claim", () => {
    const x = r26();
    x.result.differences = renamePair(x);
    x.result.differences[1].structurePath!.rowKey = "SYN-1026-001";
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.events[0].identity?.claims).toContain("wrong");
  });
  it("R26: a table card that changes a record's text fails the row control by its sources, without a table label", () => {
    const x = r26();
    x.expected.events = [];
    x.expected.evidence_locations = {};
    x.expected.invariants = ["no_false_row_additions_or_deletions"];
    x.result.differences[0].structurePath = null;
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.faults).toContain("no_false_row_additions_or_deletions: False table value/entity delta");
  });
  // R22: one agreed value changes; the answer matches rows by registration or declared serial.
  const r22 = (amounts = ["100,000", "200,000"]) => {
    const left = table("TEST-C941", false, amounts),
      right = table("TEST-C941", false, [amounts[0], "250,000"]);
    const expected: Expected = {
      case_id: "R22_table_value",
      required_status: "complete_for_scope",
      events: [
        {
          event_id: "R22_table_value:E1",
          logical_path: "aircraft_schedule.SYN-1026-003.agreed_value",
          old: amounts[1],
          new: "250,000",
          operation: "replace",
          detection_requirement: "must_detect",
          acceptable_kinds: ["Replaced"],
          acceptable_categories: ["Material", "Review"],
        },
      ],
      invariants: ["match_row_by_registration_or_declared_serial"],
      coverage_requirements: [],
      evidence_locations: {
        "R22_table_value:E1": {
          before: [{ page_index: 0, run_id: "l10" }],
          after: [{ page_index: 0, run_id: "l10" }],
        },
      },
    };
    const result = compare(left, right);
    Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [] });
    result.differences = [
      replaced("value", lineLoc(left, "left", "l10"), lineLoc(right, "right", "l10"), {
        section: "aircraft_schedule",
        entity: "SYN-1026-003",
        field: "agreed_value",
        table: "aircraft_schedule",
        rowKey: "SYN-1026-003",
      }),
    ];
    return {
      docs: [left, right] as [DocInput, DocInput],
      expected,
      layout: { before: layoutOf(left, paths), after: layoutOf(right, paths) } as Layout,
      result,
    };
  };
  it("R22: the record's declared serial or its registration is an accepted row key", () => {
    for (const key of ["SYN-1026-003", "TEST-C941"]) {
      const x = r22();
      Object.assign(x.result.differences[0].structurePath!, { rowKey: key, entity: key });
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status, key).toBe("PASS");
      expect(score.events[0].identity, key).toMatchObject({ pass: true, determined: true, claims: ["determined"], outcome: "determined" });
    }
  });
  it("R22: another record's serial or registration on a correctly sourced card fails as a false identity claim", () => {
    for (const key of ["SYN-1026-001", "TEST-A789"]) {
      const x = r22();
      x.result.differences[0].structurePath!.rowKey = key;
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status, key).toBe("FAIL");
      expect(score.events[0], key).toMatchObject({ discovery: true, attribution: true, position: true, visibility: true });
      expect(score.events[0].identity, key).toMatchObject({ pass: false, claims: ["wrong"], outcome: "wrong_statement" });
    }
  });
  it("R22: an explicitly unresolved identity is not wrong, but this answer does not allow it", () => {
    const x = r22();
    Object.assign(x.result.differences[0].structurePath!, { rowKey: null, entity: null, confidence: "unresolved" });
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.events[0]).toMatchObject({ attribution: true });
    // Not met, and reported apart from a wrong identity statement.
    expect(score.events[0].identity).toMatchObject({ pass: false, claims: ["unresolved"], outcome: "requirement_unmet" });
    expect(summarize([score]).identityClaims).toMatchObject({ requirementUnmet: ["R22_table_value:E1"], wrong: [] });
  });
  it("R22: the correct record label on a card that deletes the same value from another record does not attribute the event", () => {
    // Row SYN-1026-001 also holds 200,000 and keeps it; the card takes its old text from there.
    const x = r22(["200,000", "200,000"]);
    const [l, r] = x.docs;
    x.result.differences = [
      replaced("value", lineLoc(l, "left", "l5"), lineLoc(r, "right", "l10"), {
        section: "aircraft_schedule",
        entity: "SYN-1026-003",
        field: "agreed_value",
        table: "aircraft_schedule",
        rowKey: "SYN-1026-003",
      }),
    ];
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.events[0]).toMatchObject({ discovery: true, attribution: false });
  });
  // R11: label alias only; neither amount nor currency may change.
  const policy = (label: string, bare: boolean) =>
    textDoc([
      { text: label, x: 40, y: 150 },
      { text: bare ? "2000000" : "USD 2,000,000", x: 180, y: 150 },
      { text: "DEDUCTIBLE:", x: 40, y: 180 },
      { text: bare ? "10000" : "USD 10,000", x: 180, y: 180 },
      { text: "EUROPEAN LIMIT:", x: 40, y: 210 },
      { text: "EUR 2,000,000", x: 180, y: 210 },
    ]);
  const R11_PATHS = {
    l0: "risk_details.sum_insured.label",
    l1: "risk_details.sum_insured",
    l2: "risk_details.deductible.label",
    l3: "risk_details.deductible",
    l4: "risk_details.limit.label",
    l5: "risk_details.limit",
  };
  const r11 = (bare = false) => {
    const left = policy("SUMS INSURED:", bare),
      right = policy("SUM INSURED:", bare);
    const expected: Expected = {
      case_id: "R11_label_alias",
      required_status: "complete_for_scope",
      events: [
        {
          event_id: "R11_label_alias:E1",
          logical_path: "risk_details.sum_insured.label",
          old: "SUMS INSURED:",
          new: "SUM INSURED:",
          operation: "replace",
          detection_requirement: "must_detect",
          acceptable_kinds: ["Replaced"],
          acceptable_categories: ["Cosmetic", "Review"],
        },
      ],
      invariants: ["no_amount_or_currency_change", "same_field_identity"],
      coverage_requirements: [],
      evidence_locations: {
        "R11_label_alias:E1": {
          before: [{ page_index: 0, run_id: "l0" }],
          after: [{ page_index: 0, run_id: "l0" }],
        },
      },
    };
    const result = compare(left, right);
    result.status = "complete_for_scope";
    result.unresolved = [];
    result.coverage = [];
    result.differences = [
      replaced(
        "label",
        lineLoc(left, "left", "l0"),
        lineLoc(right, "right", "l0"),
        { section: "risk_details", field: "sum_insured.label" },
      ),
    ];
    return {
      left,
      right,
      docs: [left, right] as [DocInput, DocInput],
      expected,
      layout: {
        before: layoutOf(left, R11_PATHS),
        after: layoutOf(right, R11_PATHS),
      } as Layout,
      result,
    };
  };
  for (const [name, rightLine, bare] of [
    ["amount", "l3", false],
    ["bare-number amount", "l3", true],
    ["currency", "l5", false],
  ] as const)
    it(`R11: correct label card plus a wrong ${name} card fails`, () => {
      const x = r11(bare);
      expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
      x.result.differences.push(
        replaced("wrong", lineLoc(x.left, "left", "l1"), lineLoc(x.right, "right", rightLine), {
          section: "risk_details",
          field: "sum_insured",
        }),
      );
      expect(ResultSchema.safeParse(x.result).success).toBe(true);
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status).toBe("FAIL");
      expect(score.faults.join("\n")).toContain("no_amount_or_currency_change");
    });
  it("R11: a wrong bare-number amount card filed under a non-amount field fails", () => {
    const x = r11(true);
    x.result.differences.push(
      replaced("wrong", lineLoc(x.left, "left", "l1"), lineLoc(x.right, "right", "l3"), {
        section: "risk_details",
        field: "endorsement",
      }),
    );
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults.join("\n")).toContain("no_amount_or_currency_change");
  });
  it("R11: claiming part of the code inside an unchanged amount cell is NOT_EVALUATED", () => {
    // "USD 2,000,000" is one sum_insured cell; letters outside a whole token may be code or wording.
    for (const make of [
      (x: ReturnType<typeof r11>) => oneSided("Removed", "part", slice(lineLoc(x.left, "left", "l1"), 0, 1), null, "sum_insured"),
      (x: ReturnType<typeof r11>) =>
        replaced("part", slice(lineLoc(x.left, "left", "l1"), 0, 1), slice(lineLoc(x.right, "right", "l1"), 1, 2), {
          section: "risk_details",
          field: "sum_insured",
        }),
    ]) {
      const x = r11();
      const card = make(x);
      x.result.differences.push(card);
      expect(ResultSchema.safeParse(x.result).success).toBe(true);
      expect([...card.left, ...card.right].every((l) => resolveLocation(l, x.docs))).toBe(true);
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.faults).toEqual([]);
      expect(score.status).toBe("NOT_EVALUATED");
      expect(score.notEvaluated).toMatchObject([{ invariant: "no_amount_or_currency_change", kind: "invariant_unverifiable" }]);
      expect(exitCode(summarize([score]))).toBe(1);
    }
  });
  it("R11: swapping parts of the codes of two unchanged amount cells is NOT_EVALUATED", () => {
    // "USD 2,000,000" and "USD 10,000" stay; one card cites the U of each as sum_insured,deductible
    // on the left and deductible,sum_insured on the right.
    const x = r11();
    const L = [slice(lineLoc(x.left, "left", "l1"), 0, 1), slice(lineLoc(x.left, "left", "l3"), 0, 1)],
      R = [slice(lineLoc(x.right, "right", "l3"), 0, 1), slice(lineLoc(x.right, "right", "l1"), 0, 1)];
    const card = replaced("code-swap", L[0], R[0], { section: "risk_details", field: "sum_insured" });
    Object.assign(card, {
      left: L,
      right: R,
      oldText: "UU",
      newText: "UU",
      // The raw texts are equal, so an honest flag is false (a true one would be a false claim).
      hasTextChange: false,
      textOps: [
        { kind: "delete", text: "U", left: [L[0]], right: [] },
        { kind: "delete", text: "U", left: [L[1]], right: [] },
        { kind: "insert", text: "U", left: [], right: [R[0]] },
        { kind: "insert", text: "U", left: [], right: [R[1]] },
      ],
    });
    x.result.differences.push(card);
    expect(ResultSchema.safeParse(x.result).success).toBe(true);
    expect([...L, ...R].every((l) => resolveLocation(l, x.docs))).toBe(true);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.faults).toEqual([]);
    expect(score.status).toBe("NOT_EVALUATED");
    expect(score.notEvaluated).toMatchObject([{ invariant: "no_amount_or_currency_change", kind: "invariant_unverifiable" }]);
    expect(exitCode(summarize([score]))).toBe(1);
  });
  it("R11: the label change attached to another field fails", () => {
    const x = r11();
    x.result.differences[0].structurePath!.field = "deductible.label";
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
});
// #10 round 19, result format 2, narrowed in round 20: a no-change control allows a text change only
// as one of its declared events. A change the sources prove form only (whitespace, confirmed page
// numbers, continued heading, recomputed whether or not the card states it) is not allowed by that
// fact: whether this control permits it is NOT_EVALUATED. Any other undeclared change fails.
describe("result format 2: stated facts and form-only changes in controls", () => {
  type Line = { text: string; page?: number; y?: number };
  const docOf = (lines: Line[]) => textDoc(lines.map((l, i) => ({ x: 40, y: l.y ?? 100 + 30 * i, ...l })));
  const at = (d: DocInput, side: "left" | "right", text: string, page = 0): SourceLocation => {
    const line = d.pages[page].lines.find((l) =>
      l.charIds.map((id) => d.pages[page].chars.find((c) => c.id === id)!.text).join("") === text,
    )!;
    return lineLoc(d, side, line.id);
  };
  const card = (id: string, left: SourceLocation[], right: SourceLocation[], facts: Difference["facts"] = []): Difference => {
    const [oldText, newText] = [left.map((l) => l.text).join(""), right.map((l) => l.text).join("")];
    return {
      ...replaced(id, left[0] ?? right[0], right[0] ?? left[0], {}),
      kind: left.length && right.length ? "Replaced" : left.length ? "Removed" : "Added",
      left,
      right,
      oldText,
      newText,
      hasTextChange: oldText !== newText,
      textOps: [
        ...left.map((l) => ({ kind: "delete" as const, text: l.text, left: [l], right: [] })),
        ...right.map((r) => ({ kind: "insert" as const, text: r.text, left: [], right: [r] })),
      ],
      facts,
    };
  };
  const control = (left: DocInput, right: DocInput, cards: (docs: [DocInput, DocInput]) => Difference[], invariants = ["no_material_differences"]) => {
    const docs: [DocInput, DocInput] = [left, right];
    const result = compare(left, right);
    Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: cards(docs) });
    expect(ResultSchema.safeParse(result).success).toBe(true);
    const expected: Expected = {
      case_id: "format-2-control",
      required_status: "complete_for_scope",
      events: [],
      invariants,
      coverage_requirements: [],
      evidence_locations: {},
    };
    return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, docs);
  };
  const material = (score: ReturnType<typeof grade>) =>
    score.invariants.find((i) => i.name === "no_material_differences")?.result;
  const open = (score: ReturnType<typeof grade>, name: string, kinds = ["invariant_unverifiable"]) => {
    expect(score.faults, name).toEqual([]);
    expect(material(score), name).toBe("NOT_EVALUATED");
    expect(score.notEvaluated.map((n) => n.kind), name).toEqual(kinds);
    expect(exitCode(summarize([score])), name).toBe(1);
  };
  it("an undeclared form-only change the sources prove is not allowed by that fact: NOT_EVALUATED, stated or not", () => {
    const cases: [string, DocInput, DocInput, string, string, Difference["facts"][number]][] = [
      ["whitespace", docOf([{ text: "Hull  cover applies." }]), docOf([{ text: "Hull cover applies." }]), "Hull  cover applies.", "Hull cover applies.", "whitespace_only"],
      [
        "page number",
        docOf([{ text: "Page 1 of 2" }, { text: "Body.", page: 1 }]),
        docOf([{ text: "Page 1 of 3" }, { text: "Body.", page: 1 }, { text: "More.", page: 2 }]),
        "Page 1 of 2",
        "Page 1 of 3",
        "page_number_only",
      ],
      // r4414859932: only the numbers of a page expression change; the printed numbers need not
      // be the PDF's own page (here a one-page document).
      ["printed page number not the PDF's page", docOf([{ text: "Schedule Page 3 of 10" }]), docOf([{ text: "Schedule Page 3 of 11" }]), "Schedule Page 3 of 10", "Schedule Page 3 of 11", "page_number_only"],
      ["printed counter", docOf([{ text: "Page 5 of 2" }]), docOf([{ text: "Page 6 of 2" }]), "Page 5 of 2", "Page 6 of 2", "page_number_only"],
    ];
    // On these single lines a stated page-number fact's scope is open as well (r4416542441).
    for (const [name, left, right, a, b, fact] of cases)
      for (const facts of [[], [fact]] as Difference["facts"][]) {
        const kinds = facts.includes("page_number_only") ? ["claim_unverifiable", "invariant_unverifiable"] : undefined;
        open(control(left, right, ([l, r]) => [card("c", [at(l, "left", a)], [at(r, "right", b)], facts)]), name + facts.join(), kinds);
      }
  });
  it("R24: an undeclared continued schedule heading is NOT_EVALUATED until the case declares it", () => {
    const left = docOf([{ text: "SCHEDULE OF AIRCRAFT" }, { text: "Row one" }]),
      right = docOf([{ text: "SCHEDULE OF AIRCRAFT" }, { text: "Row one" }, { text: "SCHEDULE OF AIRCRAFT CONTINUED", page: 1 }, { text: "Row two", page: 1 }]);
    for (const facts of [[], ["continued_heading"]] as Difference["facts"][]) {
      open(control(left, right, ([, r]) => [card("h", [], [at(r, "right", "SCHEDULE OF AIRCRAFT CONTINUED", 1)], facts)]), facts.join());
    }
  });
  it("a change that is not form only fails a control, and a form fact stated on it is false", () => {
    const cases: [string, DocInput, DocInput, string[], string[], Difference["facts"]][] = [
      ["a word changed", docOf([{ text: "Hull cover applies." }]), docOf([{ text: "Hull covers applies." }]), ["Hull cover applies."], ["Hull covers applies."], ["whitespace_only"]],
      ["words joined", docOf([{ text: "Hull cover applies." }]), docOf([{ text: "Hullcover applies." }]), ["Hull cover applies."], ["Hullcover applies."], ["whitespace_only"]],
      // A page expression whose form changes, a number outside the expressions, or whitespace alone.
      ["page expression form changed", docOf([{ text: "Page 3" }]), docOf([{ text: "Page 3 of 11" }]), ["Page 3"], ["Page 3 of 11"], ["page_number_only"]],
      ["a rate beside the page number", docOf([{ text: "Page 3 of 10 rate 4%" }]), docOf([{ text: "Page 3 of 11 rate 5%" }]), ["Page 3 of 10 rate 4%"], ["Page 3 of 11 rate 5%"], ["page_number_only"]],
      ["an amount beside the page number", docOf([{ text: "Page 3 of 10 USD 100" }]), docOf([{ text: "Page 3 of 10 USD 200" }]), ["Page 3 of 10 USD 100"], ["Page 3 of 10 USD 200"], ["page_number_only"]],
      // A page expression's number is a whole number: the "1" of "Page 1.1" is not one (r4416744456).
      ["a decimal after Page", docOf([{ text: "Schedule Page 1.1" }]), docOf([{ text: "Schedule Page 2.1" }]), ["Schedule Page 1.1"], ["Schedule Page 2.1"], ["page_number_only"]],
      ["a total cut out of a longer number", docOf([{ text: "Page 3 of 10,5" }]), docOf([{ text: "Page 3 of 11,5" }]), ["Page 3 of 10,5"], ["Page 3 of 11,5"], ["page_number_only"]],
      // Spaces changed beside a changed page number: the text outside the numbers differs (r4417386694).
      ["spaces added beside a changed page number", docOf([{ text: "Schedule coverage Page 1 of 10" }]), docOf([{ text: "Schedule coverage Page   2 of 10" }]), ["Schedule coverage Page 1 of 10"], ["Schedule coverage Page   2 of 10"], ["page_number_only"]],
      ["one side not only page expressions", docOf([{ text: "Row one" }]), docOf([{ text: "Row one" }, { text: "Draft Page 2" }]), [], ["Draft Page 2"], ["page_number_only"]],
      // The base heading is missing from the old version.
      ["continued heading without its base", docOf([{ text: "Row one" }]), docOf([{ text: "SCHEDULE OF AIRCRAFT" }, { text: "SCHEDULE OF AIRCRAFT CONTINUED", page: 1 }]), [], ["SCHEDULE OF AIRCRAFT CONTINUED"], ["continued_heading"]],
    ];
    for (const [name, left, right, a, b, facts] of cases) {
      const score = control(left, right, ([l, r]) => [
        card("c", a.map((t) => at(l, "left", t)), b.map((t) => at(r, "right", t, t.endsWith("CONTINUED") ? 1 : 0)), facts),
      ]);
      expect(score.status, name).toBe("FAIL");
      expect(score.faults, name).toEqual([
        `card c states ${facts[0]}, which its source texts disprove`,
        "no_material_differences: Undeclared text change in a no-change control",
      ]);
    }
    // Whitespace alone is form only, but no page number changed: the stated page fact is false.
    const spaces = control(docOf([{ text: "Page 3 of  10" }]), docOf([{ text: "Page 3 of 10" }]), ([l, r]) => [
      card("c", [at(l, "left", "Page 3 of  10")], [at(r, "right", "Page 3 of 10")], ["page_number_only"]),
    ]);
    expect(spaces.status).toBe("FAIL");
    expect(spaces.faults).toEqual(["card c states page_number_only, which its source texts disprove"]);
  });
  it("a page-number fact on a repeated page line is decided from the texts: it holds, and the undeclared change stays open in the control", () => {
    const left = docOf([{ text: "Page 1 of 2" }, { text: "Page 2 of 2", page: 1 }]),
      right = docOf([{ text: "Page 1 of 3" }, { text: "Page 2 of 3", page: 1 }, { text: "Page 3 of 3", page: 2 }]);
    const score = control(left, right, ([l, r]) => {
      const occ = [0, 1, 2].map((p) => ({ left: p < 2 ? [at(l, "left", `Page ${p + 1} of 2`, p)] : [], right: [at(r, "right", `Page ${p + 1} of 3`, p)] }));
      return [{ ...card("p", occ[0].left, occ[0].right, ["page_number_only"]), occurrences: occ, repeat: { left: 2, right: 3, leftPages: 2, rightPages: 3 } }];
    });
    expect(score).toMatchObject({ status: "NOT_EVALUATED", faults: [] });
    expect(score.notEvaluated.map((n) => n.kind)).toEqual(["invariant_unverifiable"]);
    expect(exitCode(summarize([score]))).toBe(1);
    // The same lines as one card citing both pages, with no occurrences: not shown to be a repeated
    // line, so the stated fact is open too.
    const joined = control(left, right, ([l, r]) => [
      {
        ...of("p", [
          op("delete", at(l, "left", "Page 1 of 2"), null, "Page 1 of 2 "),
          op("delete", at(l, "left", "Page 2 of 2", 1), null),
          op("insert", null, at(r, "right", "Page 1 of 3"), "Page 1 of 3 "),
          op("insert", null, at(r, "right", "Page 2 of 3", 1)),
        ]),
        facts: ["page_number_only"],
      },
    ]);
    expect(joined).toMatchObject({ status: "NOT_EVALUATED", faults: [] });
    expect(joined.notEvaluated.map((n) => n.kind)).toEqual(["claim_unverifiable", "invariant_unverifiable"]);
  });
  it("a page-number fact stated on a line not shown to be a repeated page line is NOT_EVALUATED, never PASS (r4416542441)", () => {
    // A body sentence's cross-reference changes only its page number: the text form holds, but the
    // contract states the fact only on a repeated page line, a heading or a page-margin line.
    const [a, b] = ["Refer to Page 3 for the exclusion.", "Refer to Page 4 for the exclusion."];
    const body = (facts: Difference["facts"]) =>
      control(docOf([{ text: a, y: 300 }]), docOf([{ text: b, y: 300 }]), ([l, r]) => [card("c", [at(l, "left", a)], [at(r, "right", b)], facts)], []);
    const stated = body(["page_number_only"]);
    expect(stated).toMatchObject({ status: "NOT_EVALUATED", faults: [] });
    expect(stated.notEvaluated).toMatchObject([{ kind: "claim_unverifiable", reason: "card c states page_number_only; only page numbers differ, but its sources do not show a repeated page line, and a heading or page-margin line cannot be established from them" }]);
    expect(exitCode(summarize([stated]))).toBe(1);
    // Control: the same card without the fact passes; a text form the sources disprove still fails.
    expect(body([]).status).toBe("PASS");
    const wrong = control(docOf([{ text: a, y: 300 }]), docOf([{ text: "Refer to Page 4 for the exclusions.", y: 300 }]), ([l, r]) => [card("c", [at(l, "left", a)], [at(r, "right", "Refer to Page 4 for the exclusions.")], ["page_number_only"])], []);
    expect(wrong.faults).toEqual(["card c states page_number_only, which its source texts disprove"]);
    // One occurrence listed twice is still one page: not a repeated line.
    const twice = control(docOf([{ text: "Page 1 of 2", y: 40 }]), docOf([{ text: "Page 1 of 3", y: 40 }]), ([l, r]) => {
      const o = { left: [at(l, "left", "Page 1 of 2")], right: [at(r, "right", "Page 1 of 3")] };
      return [{ ...card("c", o.left, o.right, ["page_number_only"]), occurrences: [o, { left: [...o.left], right: [...o.right] }], repeat: { left: 2, right: 2, leftPages: 1, rightPages: 1 } }];
    }, []);
    expect(twice.notEvaluated.map((n) => n.kind)).toEqual(["claim_unverifiable"]);
    expect(twice.faults).toContain("card c lists the same source characters in two occurrences on the left side");
  });
  it("repeat counts are checked against the documents' page counts and the occurrences the card cites", () => {
    const left = docOf([{ text: "RUNNING HEADER", y: 40 }, { text: "Body one." }, { text: "RUNNING HEADER", y: 40, page: 1 }, { text: "Body two.", page: 1 }]),
      right = docOf([{ text: "RUNNING HEADER", y: 40 }, { text: "Body one." }, { text: "RUNNING HEADER", y: 40, page: 1 }, { text: "Body two.", page: 1 }, { text: "RUNNING HEADER", y: 40, page: 2 }, { text: "Body three.", page: 2 }]);
    const repeated = (docs: [DocInput, DocInput]): Difference => {
      const [l, r] = docs;
      const occ = [0, 1, 2].map((p) => ({ left: p < 2 ? [at(l, "left", "RUNNING HEADER", p)] : [], right: [at(r, "right", "RUNNING HEADER", p)] }));
      return { ...card("rep", [occ[0].left[0]], [occ[0].right[0]]), textOps: [{ kind: "equal", text: "RUNNING HEADER", left: occ[0].left, right: occ[0].right }], occurrences: occ, repeat: { left: 2, right: 3, leftPages: 2, rightPages: 3 } };
    };
    const graded = (mutate: (d: Difference) => void) => {
      const docs: [DocInput, DocInput] = [left, right];
      const result = compare(left, right);
      const d = repeated(docs);
      mutate(d);
      Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: [d] });
      expect(ResultSchema.safeParse(result).success).toBe(true);
      const expected: Expected = { case_id: "repeat", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
      return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, docs);
    };
    expect(graded(() => {}).faults).toEqual([]);
    for (const [name, mutate] of [
      ["page count", (d: Difference) => (d.repeat!.rightPages = 2)],
      ["occurrence count", (d: Difference) => (d.repeat!.right = 2)],
    ] as const)
      expect(graded(mutate).faults, name).toEqual(["card rep states occurrence or page counts that differ from the documents' page counts or from the occurrences of its own text it cites"]);
    // One occurrence listed twice, with both counts raised to match the list (r4416805143): the
    // documents still hold 2 and 3; two entries citing the same source characters are one.
    expect(
      graded((d) => {
        d.occurrences.push({ left: [...d.occurrences[0].left], right: [...d.occurrences[0].right] });
        d.repeat!.left = 3;
        d.repeat!.right = 4;
      }).faults,
    ).toEqual(["card rep lists the same source characters in two occurrences on the left side", "card rep lists the same source characters in two occurrences on the right side"]);
    // The card shows the old line but lists no old occurrence and counts 0 there (r4416274609).
    expect(
      graded((d) => {
        d.occurrences = d.occurrences.map((o) => ({ left: [], right: o.right }));
        d.repeat!.left = 0;
      }).faults,
    ).toEqual(["card rep shows its own text on the left side outside the occurrences it counts there"]);
  });
  it("repeat counts the card's own variant on each side; another variant it cites there is context, not counted (r4414789954)", () => {
    // Four pages; the new version changes the limit on page 2 only.
    const lines = (limit: (p: number) => string) =>
      docOf([0, 1, 2, 3].flatMap((page) => [{ text: `Hull limit USD ${limit(page)}`, y: 40, page }, { text: `Body ${page + 1}.`, page }]));
    const [left, right] = [lines(() => "1,000,000"), lines((p) => (p === 1 ? "2,000,000" : "1,000,000"))];
    const [o, n] = ["Hull limit USD 1,000,000", "Hull limit USD 2,000,000"];
    // A fixed set for the old limit: 4 lines before, 3 after (page 2 changed).
    const oldSet = {
      requirement_id: "T1",
      text: o,
      counts: { before: 4, after: 3 },
      occurrences: {
        before: [0, 1, 2, 3].map((p) => ({ page_index: p, run_id: at(left, "left", o, p).unitId, text: o })),
        after: [0, 2, 3].map((p) => ({ page_index: p, run_id: at(right, "right", o, p).unitId, text: o })),
      },
    };
    const score = (repeat: Difference["repeat"], sets: Expected["repeated_text_requirements"] = []) => {
      const occ = [0, 1, 2, 3].map((p) => ({ left: [at(left, "left", o, p)], right: [at(right, "right", p === 1 ? n : o, p)] }));
      const d = { ...card("limit", [occ[1].left[0]], [occ[1].right[0]]), occurrences: occ, repeat };
      const result = compare(left, right);
      Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: [d] });
      expect(ResultSchema.safeParse(result).success).toBe(true);
      const expected: Expected = { case_id: "variant", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {}, repeated_text_requirements: sets };
      return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, [left, right]);
    };
    const graded = (repeat: Difference["repeat"]) => score(repeat).faults;
    // 4 occurrences of the old limit, 1 of the new; the 3 unchanged new-side lines are context.
    expect(graded({ left: 4, right: 1, leftPages: 4, rightPages: 4 })).toEqual([]);
    // The card reports the set's text on the old side; on the new side its own text is the new
    // limit, and the set's lines it cites there are context: not "outside the set", not counted.
    const withSet = score({ left: 4, right: 1, leftPages: 4, rightPages: 4 }, [oldSet]);
    expect(withSet.faults).toEqual([]);
    expect(withSet.repeatedText).toMatchObject([{ requirementId: "T1", pass: true, cards: ["limit"] }]);
    expect(score({ left: 3, right: 1, leftPages: 4, rightPages: 4 }, [oldSet]).faults).toContain("repeated text T1: card limit states 3 -> 1 occurrences; the set has 4 -> 3");
    const wrong = ["card limit states occurrence or page counts that differ from the documents' page counts or from the occurrences of its own text it cites"];
    expect(graded({ left: 4, right: 4, leftPages: 4, rightPages: 4 }), "context counted").toEqual(wrong);
    expect(graded({ left: 3, right: 1, leftPages: 4, rightPages: 4 }), "an old occurrence left out of the count").toEqual(wrong);
    // A running line whose only difference is its page expression's number is one variant.
    const paged = (pages: number) => docOf(Array.from({ length: pages }, (_, page) => ({ text: `FIXTURE | PAGE ${page + 1}`, y: 40, page })));
    const [pl, pr] = [paged(2), paged(3)];
    const occ = [0, 1, 2].map((p) => ({ left: p < 2 ? [at(pl, "left", `FIXTURE | PAGE ${p + 1}`, p)] : [], right: [at(pr, "right", `FIXTURE | PAGE ${p + 1}`, p)] }));
    const running = { ...card("running", [occ[0].left[0]], [occ[0].right[0]]), textOps: [{ kind: "equal" as const, text: "FIXTURE | PAGE 1", left: occ[0].left, right: occ[0].right }], occurrences: occ, repeat: { left: 2, right: 3, leftPages: 2, rightPages: 3 } };
    const result = compare(pl, pr);
    Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: [running] });
    const expected: Expected = { case_id: "running", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
    expect(grade(result, expected, { before: layoutOf(pl), after: layoutOf(pr) } as Layout, [pl, pr]).faults).toEqual([]);
    // A page counter is read against its own page when it counts with the pages; the same printed
    // counter on two pages is then two variants, and a counter that does not count stays as printed.
    const pagesOf = (texts: string[]) => docOf(texts.map((text, page) => ({ text, y: 40, page })));
    const counted = (lt: string[], rt: string[], cardPages: [number, number], occ: { side: "left" | "right"; page: number; context?: true }[], repeat: [number, number]) => {
      const [dl, dr] = [pagesOf(lt), pagesOf(rt)];
      const loc = (side: "left" | "right", page: number) => at(side === "left" ? dl : dr, side, (side === "left" ? lt : rt)[page], page);
      const d = {
        ...card("pages", [loc("left", cardPages[0])], [loc("right", cardPages[1])]),
        occurrences: occ.map((o) => ({ left: o.side === "left" ? [loc("left", o.page)] : [], right: o.side === "right" ? [loc("right", o.page)] : [], ...(o.context ? { context: true as const } : {}) })),
        repeat: { left: repeat[0], right: repeat[1], leftPages: lt.length, rightPages: rt.length },
      };
      const result = compare(dl, dr);
      Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: [d] });
      expect(ResultSchema.safeParse(result).success).toBe(true);
      const expected: Expected = { case_id: "counters", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
      return grade(result, expected, { before: layoutOf(dl), after: layoutOf(dr) } as Layout, [dl, dr]).faults;
    };
    const counts = "card pages states occurrence or page counts that differ from the documents' page counts or from the occurrences of its own text it cites";
    // A later page's counter changed (Page 3 -> Page 99): its own variant once, the rest context.
    const four = ["Page 1 of 4", "Page 2 of 4", "Page 3 of 4", "Page 4 of 4"], ninety = ["Page 1 of 4", "Page 2 of 4", "Page 99 of 4", "Page 4 of 4"];
    const listed = (ctx: boolean) => [
      ...[0, 1, 2, 3].map((page) => ({ side: "left" as const, page })),
      { side: "right" as const, page: 2 },
      ...[0, 1, 3].map((page) => ({ side: "right" as const, page, ...(ctx ? { context: true as const } : {}) })),
    ];
    expect(counted(four, ninety, [0, 2], listed(true), [4, 1])).toEqual([]);
    expect(counted(four, ninety, [0, 2], listed(true), [4, 4]), "context counted").toEqual([counts]);
    expect(
      counted(four, ninety, [0, 2], listed(true).map((o) => (o.side === "right" && o.page === 2 ? { ...o, context: true as const } : o)), [4, 0]),
      "its own occurrence marked as context",
    ).toContain("card pages marks an occurrence of its own text as context");
    // The same printed "Page 3" on pages 3 and 4 is two variants once the counter counts.
    const misprinted = ["Page 1", "Page 2", "Page 3", "Page 3"];
    // The card cites every old occurrence, page 4's "Page 3" as its new text and the rest as context.
    const occ4 = [
      ...[0, 1, 2, 3].map((page) => ({ side: "left" as const, page })),
      { side: "right" as const, page: 3 },
      ...[0, 1, 2].map((page) => ({ side: "right" as const, page, context: true as const })),
    ];
    expect(counted(["Page 1", "Page 2", "Page 3", "Page 4"], misprinted, [0, 3], occ4, [4, 1])).toEqual([]);
    expect(counted(["Page 1", "Page 2", "Page 3", "Page 4"], misprinted, [0, 3], occ4, [4, 2]), "the other page's Page 3 counted").toEqual([counts]);
    // A template printing "Page 1" on every page: the counter does not count, one variant as printed.
    const same = [0, 1, 2].map((page) => ({ side: "left" as const, page }));
    expect(counted(["Page 1", "Page 1", "Page 1"], ["Page 1", "Page 1", "Page 1", "Page 1"], [0, 0], [...same, ...[0, 1, 2, 3].map((page) => ({ side: "right" as const, page }))], [3, 4])).toEqual([]);
  });
  it("a repeated line's variant keeps its whitespace as the source prints it (#2's r4416942422)", () => {
    // Four pages; a trailing space is added to the line on page 3 only. The product's card counts the
    // spaced variant 4 -> 1 and lists the three unchanged new lines as context.
    const four = (v: (p: number) => string) => docOf([0, 1, 2, 3].flatMap((page) => [{ text: v(page), y: 120, page }, { text: `Ordinary body on page ${page + 1}`, y: 300, page }]));
    const [left, right] = [four(() => "Limit USD 1000"), four((p) => (p === 2 ? "Limit USD 1000 " : "Limit USD 1000"))];
    const graded = (mutate: (d: Difference) => void = () => {}) => {
      const result = compare(left, right);
      Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [] });
      expect(result.differences).toHaveLength(1);
      mutate(result.differences[0]);
      const expected: Expected = { case_id: "spaced", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
      return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, [left, right]);
    };
    expect(graded().faults).toEqual([]);
    // Counting the unchanged lines too states 4 -> 4 for the spaced text, which occurs once.
    expect(graded((d) => (d.repeat!.right = 4)).faults).toEqual([
      expect.stringContaining("states occurrence or page counts that differ"),
    ]);
  });
  it("a page counter printed other than plainly stays as printed in its variant (#2's r4417060269)", () => {
    // Page 1 .. Page 4; the third becomes "Page 03". Only a plainly printed counter is read against
    // its page, so "Page 03" is its own variant: the product's card counts it 4 -> 1, the rest context.
    const four = (v: (p: number) => string) => docOf([0, 1, 2, 3].flatMap((page) => [{ text: v(page), y: 120, page }, { text: `Ordinary body on page ${page + 1}`, y: 300, page }]));
    const [left, right] = [four((p) => `Page ${p + 1}`), four((p) => (p === 2 ? "Page 03" : `Page ${p + 1}`))];
    const graded = (mutate: (d: Difference) => void = () => {}) => {
      const result = compare(left, right);
      Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [] });
      expect(result.differences).toHaveLength(1);
      mutate(result.differences[0]);
      const expected: Expected = { case_id: "zeros", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
      return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, [left, right]);
    };
    expect(graded().faults).toEqual([]);
    expect(graded((d) => (d.repeat!.right = 4)).faults).toEqual([expect.stringContaining("states occurrence or page counts that differ")]);
  });
  it("a counter is read per side: a fixed Page 1 against a counting Page 1 .. 4 (#2's r4417303223)", () => {
    // Each side decides from its own occurrences whether a counter counts with the pages or stays
    // the same; only a side that shows neither takes the other side's reading. "Page 1" printed on
    // every old page is one variant as printed, the counting new pages one variant read against
    // their pages: the product's card counts 4 -> 4.
    const four = (v: (p: number) => string) => docOf([0, 1, 2, 3].flatMap((page) => [{ text: v(page), y: 120, page }, { text: `Ordinary body on page ${page + 1}`, y: 300, page }]));
    const [fixed, counting] = [four(() => "Page 1"), four((p) => `Page ${p + 1}`)];
    for (const [name, left, right] of [["fixed -> counting", fixed, counting], ["counting -> fixed", counting, fixed]] as const) {
      const graded = (mutate: (d: Difference) => void = () => {}) => {
        const result = compare(left, right);
        Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [] });
        expect(result.differences, name).toHaveLength(1);
        expect(result.differences[0].repeat, name).toMatchObject({ left: 4, right: 4 });
        mutate(result.differences[0]);
        const expected: Expected = { case_id: "fixed-counting", required_status: "complete_for_scope", events: [], invariants: [], coverage_requirements: [], evidence_locations: {} };
        return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, [left, right]);
      };
      expect(graded().faults, name).toEqual([]);
      expect(graded((d) => (d.repeat!.left = 1)).faults, name).toEqual([expect.stringContaining("states occurrence or page counts that differ")]);
    }
  });
  it("a fixed set of repeated text is checked for completeness and counts, whatever the cards' form", () => {
    // Two pages before, three after; the header repeats on every page. A body line on the first new
    // page repeats the words but is not part of the generated set.
    const left = docOf([{ text: "RUNNING HEADER", y: 40 }, { text: "Body one." }, { text: "RUNNING HEADER", y: 40, page: 1 }, { text: "Body two.", page: 1 }]),
      right = docOf([
        { text: "RUNNING HEADER", y: 40 },
        { text: "Body one." },
        { text: "RUNNING HEADER", y: 200 },
        { text: "RUNNING HEADER", y: 40, page: 1 },
        { text: "Body two.", page: 1 },
        { text: "RUNNING HEADER", y: 40, page: 2 },
        { text: "Body three.", page: 2 },
      ]);
    // The header line of a page, by its baseline.
    const headerLine = (d: DocInput, page: number, y = 40) => d.pages[page].lines.find((l) => l.baseline[1] === y)!.id;
    const header = (d: DocInput, side: "left" | "right", page: number, y = 40) => lineLoc(d, side, headerLine(d, page, y));
    const set = (d: DocInput, pages: number[]) => pages.map((p) => ({ page_index: p, run_id: headerLine(d, p), text: "RUNNING HEADER" }));
    const repeated = (id: string, l: SourceLocation[], r: SourceLocation[], cut?: [number, number]): Difference => {
      const part = (loc: SourceLocation) => (cut ? slice(loc, ...cut) : loc);
      const occ = Array.from({ length: Math.max(l.length, r.length) }, (_, i) => ({ left: l[i] ? [part(l[i])] : [], right: r[i] ? [part(r[i])] : [] }));
      const text = part(l[0]).text;
      return {
        ...card(id, [occ[0].left[0]], [occ[0].right[0]]),
        textOps: [{ kind: "equal", text, left: occ[0].left, right: occ[0].right }],
        occurrences: occ,
        repeat: { left: l.length, right: r.length, leftPages: 2, rightPages: 3 },
      };
    };
    const graded = (cards: Difference[]) => {
      const result = compare(left, right);
      Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: cards });
      expect(ResultSchema.safeParse(result).success).toBe(true);
      const expected: Expected = {
        case_id: "repeated-set",
        required_status: "complete_for_scope",
        events: [],
        invariants: [],
        coverage_requirements: [],
        evidence_locations: {},
        repeated_text_requirements: [
          { requirement_id: "T1", text: "RUNNING HEADER", counts: { before: 2, after: 3 }, occurrences: { before: set(left, [0, 1]), after: set(right, [0, 1, 2]) } },
        ],
      };
      return grade(result, expected, { before: layoutOf(left), after: layoutOf(right) } as Layout, [left, right]);
    };
    const [l, r] = [[0, 1].map((p) => header(left, "left", p)), [0, 1, 2].map((p) => header(right, "right", p))];
    // One card, or the text split over two cards, each citing every occurrence of the set.
    for (const [name, cards] of [
      ["one card", [repeated("all", l, r)]],
      ["split over two cards", [repeated("running", l, r, [0, 7]), repeated("header", l, r, [8, 14])]],
    ] as const) {
      const score = graded([...cards]);
      expect(score.faults, name).toEqual([]);
      expect(score.repeatedText, name).toMatchObject([{ requirementId: "T1", pass: true }]);
      expect(summarize([score]).repeatedText, name).toEqual({ pass: ["T1"], fail: [] });
    }
    const failing: [string, Difference[], string[]][] = [
      ["no card", [], ["repeated text T1: no card reports its occurrence counts"]],
      [
        "an occurrence left out",
        [repeated("short", l, r.slice(0, 2))],
        ["repeated text T1: card short leaves out an occurrence of the set on the right side", "repeated text T1: card short states 2 -> 2 occurrences; the set has 2 -> 3"],
      ],
      [
        "an occurrence outside the set",
        [repeated("extra", l, [...r, header(right, "right", 0, 200)])],
        ["repeated text T1: card extra cites an occurrence outside the set on the right side", "repeated text T1: card extra states 2 -> 4 occurrences; the set has 2 -> 3"],
      ],
      [
        "one of two split cards incomplete",
        [repeated("running", l, r, [0, 7]), repeated("header", l, r.slice(0, 2), [8, 14])],
        ["repeated text T1: card header leaves out an occurrence of the set on the right side", "repeated text T1: card header states 2 -> 2 occurrences; the set has 2 -> 3"],
      ],
      // The same text on both sides, with no old occurrence listed and 0 counted there (r4416274609).
      [
        "the old side shown but not counted",
        [{ ...repeated("unlisted", l, r), occurrences: r.map((x) => ({ left: [], right: [x] })), repeat: { left: 0, right: 3, leftPages: 2, rightPages: 3 } }],
        [
          "card unlisted shows its own text on the left side outside the occurrences it counts there",
          "repeated text T1: card unlisted leaves out an occurrence of the set on the left side",
          "repeated text T1: card unlisted states 0 -> 3 occurrences; the set has 2 -> 3",
        ],
      ],
      [
        "the text stated as added",
        [{ ...card("added", [], [r[0]]), occurrences: r.map((x) => ({ left: [], right: [x] })), repeat: { left: 0, right: 3, leftPages: 2, rightPages: 3 } }],
        ["repeated text T1: card added leaves out an occurrence of the set on the left side", "repeated text T1: card added states 0 -> 3 occurrences; the set has 2 -> 3"],
      ],
      [
        "the same text counted off the set on one side",
        [repeated("elsewhere", l, [header(right, "right", 0, 200)])],
        [
          "repeated text T1: card elsewhere cites an occurrence outside the set on the right side",
          "repeated text T1: card elsewhere leaves out an occurrence of the set on the right side",
          "repeated text T1: card elsewhere states 2 -> 1 occurrences; the set has 2 -> 3",
        ],
      ],
    ];
    for (const [name, cards, faults] of failing) {
      const score = graded(cards);
      expect(score.status, name).toBe("FAIL");
      expect(score.faults, name).toEqual(faults);
      expect(summarize([score]).repeatedText, name).toEqual({ pass: [], fail: ["T1"] });
    }
  });
  // An operation over one location per side, and a card made of operations.
  const op = (kind: "equal" | "delete" | "insert", a: SourceLocation | null, b: SourceLocation | null, text = (a ?? b)!.text) => ({
    kind,
    text,
    left: a ? [a] : [],
    right: b ? [b] : [],
  });
  const of = (id: string, ops: ReturnType<typeof op>[]): Difference => {
    const left = ops.flatMap((o) => o.left), right = ops.flatMap((o) => o.right);
    const oldText = ops.filter((o) => o.kind !== "insert").map((o) => o.text).join("");
    const newText = ops.filter((o) => o.kind !== "delete").map((o) => o.text).join("");
    return { ...card(id, left, right), kind: left.length && right.length ? "Replaced" : left.length ? "Removed" : "Added", oldText, newText, hasTextChange: oldText !== newText, textOps: ops };
  };
  // One replace event from the old to the new text, on the lines (runs) holding them.
  const grader = (left: DocInput, right: DocInput, old: string, neu: string, beforeLines: string | string[], afterLines: string | string[], operation = "replace") => (
    differences: Difference[],
    kinds: Expected["events"][number]["acceptable_kinds"] = ["Replaced"],
  ) => {
    const result = compare(left, right);
    // Each card names the event's field, so identity is met.
    const named = differences.map((d) => ({ ...d, structurePath: { ...d.structurePath!, field: "sum_insured" } }));
    Object.assign(result, { status: "complete_for_scope", unresolved: [], coverage: [], differences: named });
    expect(ResultSchema.safeParse(result).success).toBe(true);
    const before = layoutOf(left), after = layoutOf(right);
    const runs = (l: typeof before, texts: string | string[]) =>
      [texts].flat().map((text) => {
        const page_index = l.pages.findIndex((p) => p.text_runs.some((r) => r.text === text));
        return { page_index, run_id: l.pages[page_index].text_runs.find((r) => r.text === text)!.run_id };
      });
    const expected: Expected = {
      case_id: "carried",
      required_status: "complete_for_scope",
      events: [{ event_id: "E1", logical_path: "risk_details.sum_insured", old, new: neu, operation, detection_requirement: "must_detect", acceptable_kinds: kinds, acceptable_categories: [] }],
      invariants: [],
      coverage_requirements: [],
      evidence_locations: { E1: { before: runs(before, beforeLines), after: runs(after, afterLines) } },
    };
    return grade(result, expected, { before, after } as Layout, [left, right]);
  };
  it("an event's text counts only where the card's own edit on the event's runs carries it, not from another unit of the card", () => {
    // The event's line changes its amount and its wording; another line holds both amounts unchanged.
    const left = docOf([{ text: "USD 100 included" }, { text: "USD 100 USD 200" }]),
      right = docOf([{ text: "USD 200 excluded" }, { text: "USD 100 USD 200" }]);
    const [l0, l1] = [at(left, "left", "USD 100 included"), at(left, "left", "USD 100 USD 200")];
    const [r0, r1] = [at(right, "right", "USD 200 excluded"), at(right, "right", "USD 100 USD 200")];
    const graded = grader(left, right, "USD 100", "USD 200", "USD 100 included", "USD 200 excluded");
    // Controls: the whole line replaced, or edited glyph by glyph inside the amount.
    expect(graded([card("whole", [l0], [r0])]).status).toBe("PASS");
    const glyphwise = of("glyphs", [
      op("equal", slice(l0, 0, 4), slice(r0, 0, 4)),
      op("delete", slice(l0, 4, 5), null),
      op("insert", null, slice(r0, 4, 5)),
      op("equal", slice(l0, 5, 8), slice(r0, 5, 8)),
      op("delete", slice(l0, 8, 16), null),
      op("insert", null, slice(r0, 8, 16)),
    ]);
    expect(graded([glyphwise]).status).toBe("PASS");
    // The card reports only included → excluded on the event's line; the amounts it contains come
    // from the unchanged line, as plain context or paired across the two lines.
    const borrowed = {
      context: of("context", [op("delete", slice(l0, 8, 16), null), op("insert", null, slice(r0, 8, 16)), op("equal", l1, r1)]),
      // The event line's own amounts are cited, but paired with the unchanged line's equal amounts;
      // the amount edits the card does report lie on the unchanged line.
      crossed: of("crossed", [
        op("equal", slice(l0, 0, 8), slice(r1, 0, 8)),
        op("delete", slice(l0, 8, 16), null),
        op("insert", null, slice(r0, 8, 16)),
        op("equal", slice(l1, 8, 15), slice(r0, 0, 7)),
        op("delete", slice(l1, 0, 8), null),
        op("insert", null, slice(r0, 7, 8)),
        op("insert", null, slice(r1, 8, 15)),
      ]),
    };
    // One operation per side citing two locations: the unchanged line's amount and the event line's
    // word. Each character belongs to its own location, not to whichever location of the operation
    // lies on the event's line (r4414882091).
    const coalesced: Difference = {
      ...card("coalesced", [slice(l1, 0, 8), slice(l0, 8, 16)], [slice(r1, 8, 15), slice(r0, 8, 16)]),
      oldText: "USD 100 included",
      newText: "USD 200 excluded",
      textOps: [
        { kind: "delete", text: "USD 100 included", left: [slice(l1, 0, 8), slice(l0, 8, 16)], right: [] },
        { kind: "insert", text: "USD 200 excluded", left: [], right: [slice(r1, 8, 15), slice(r0, 8, 16)] },
      ],
    };
    Object.assign(borrowed, { coalesced });
    for (const [name, d] of Object.entries(borrowed)) {
      const score = graded([d]);
      expect.soft(score.status, name).toBe("FAIL");
      expect.soft(score.events[0], name).toMatchObject({ discovery: true, attribution: false, verdict: "FAIL" });
    }
    // The same on the delete + add path: the halves' amounts come from the unchanged line.
    const removed = of("removed", [op("delete", slice(l0, 8, 16), null), op("delete", l1, null)]);
    const added = of("added", [op("insert", null, slice(r0, 8, 16)), op("insert", null, r1)]);
    expect.soft(graded([removed, added], ["Replaced", "Added+Removed"]).events[0], "delete + add").toMatchObject({ attribution: false, verdict: "FAIL" });
    const honestRemoved = of("removed", [op("delete", l0, null)]), honestAdded = of("added", [op("insert", null, r0)]);
    expect(graded([honestRemoved, honestAdded], ["Replaced", "Added+Removed"]).events[0]).toMatchObject({ representation: "delete+add", verdict: "PASS" });
    // An old text kept whole inside the new one carries no edit itself; the new text holds the edit.
    const [kept, extended] = [docOf([{ text: "Cover applies" }]), docOf([{ text: "Cover applies to hull" }])];
    const [k0, x0] = [at(kept, "left", "Cover applies"), at(extended, "right", "Cover applies to hull")];
    const appended = grader(kept, extended, "Cover applies", "Cover applies to hull", "Cover applies", "Cover applies to hull");
    expect(appended([of("tail", [op("equal", k0, slice(x0, 0, 13)), op("insert", null, slice(x0, 13, 21))])]).status).toBe("PASS");
    // A number of the event matches only as a whole number: in one run holding two amounts, the
    // edit of USD 1000 does not show the event USD 100 -> USD 200.
    const [two, twoNew] = [docOf([{ text: "Hull USD 100; Liability USD 1000" }]), docOf([{ text: "Hull USD 200; Liability USD 2000" }])];
    const [t0, n0] = [at(two, "left", "Hull USD 100; Liability USD 1000"), at(twoNew, "right", "Hull USD 200; Liability USD 2000")];
    const amounts = grader(two, twoNew, "USD 100", "USD 200", "Hull USD 100; Liability USD 1000", "Hull USD 200; Liability USD 2000");
    const digit = (id: string, [a, b]: [number, number], pos: number) =>
      of(id, [
        op("equal", slice(t0, a, pos), slice(n0, a, pos)),
        op("delete", slice(t0, pos, pos + 1), null),
        op("insert", null, slice(n0, pos, pos + 1)),
        op("equal", slice(t0, pos + 1, b), slice(n0, pos + 1, b)),
      ]);
    expect.soft(amounts([digit("liability", [14, 32], 28)]).events[0], "the other amount's edit").toMatchObject({ discovery: true, attribution: false, verdict: "FAIL" });
    expect(amounts([digit("hull", [0, 12], 9)]).status).toBe("PASS");
    // The same with the card's text cut inside the source's number: "USD 100" taken from "USD 1000".
    const cut = of("cut", [
      op("equal", slice(t0, 24, 28), slice(n0, 24, 28)),
      op("delete", slice(t0, 28, 29), null),
      op("insert", null, slice(n0, 28, 29)),
      op("equal", slice(t0, 29, 31), slice(n0, 29, 31)),
    ]);
    expect.soft(amounts([cut]).events[0], "cut inside a number of the source").toMatchObject({ discovery: true, attribution: false, verdict: "FAIL" });
    expect(amounts([card("line", [t0], [n0])]).status).toBe("PASS");
    // A sign right before a number is part of it, as for amounts (f0173ed; #2's r4417384098): the
    // card's new value -200 is not the event's 200. A hyphen after a digit or letter is no sign.
    for (const [shown, verdict] of [["Hull -200 included", "FAIL"], ["Hull −200 included", "FAIL"], ["Hull 200 included", "PASS"], ["Hull 1-200 included", "PASS"]] as const) {
      const [plainDoc, shownDoc] = [docOf([{ text: "Hull 100 included" }]), docOf([{ text: shown }])];
      const signed = grader(plainDoc, shownDoc, "100 included", "200 included", "Hull 100 included", shown);
      const score = signed([card("line", [at(plainDoc, "left", "Hull 100 included")], [at(shownDoc, "right", shown)])]);
      expect.soft(score.events[0], shown).toMatchObject(verdict === "FAIL" ? { discovery: true, attribution: false, verdict } : { verdict });
    }
    // Each side whose fragment changes (beyond the old and new texts' common start and end) must
    // carry the edit itself: here the new amount is only another, unchanged USD 200 of the same run.
    const [same, sameNew] = [docOf([{ text: "USD 100; USD 200 included" }]), docOf([{ text: "USD 200; USD 200 excluded" }])];
    const [s0, m0] = [at(same, "left", "USD 100; USD 200 included"), at(sameNew, "right", "USD 200; USD 200 excluded")];
    const twice = grader(same, sameNew, "USD 100", "USD 200", "USD 100; USD 200 included", "USD 200; USD 200 excluded");
    const borrowedNew = of("borrowed new", [
      op("delete", slice(s0, 0, 9), null),
      op("equal", slice(s0, 9, 17), slice(m0, 9, 17)),
      op("delete", slice(s0, 17, 25), null),
      op("insert", null, slice(m0, 17, 25)),
    ]);
    expect.soft(twice([borrowedNew]).events[0], "the new amount borrowed").toMatchObject({ discovery: true, attribution: false, verdict: "FAIL" });
    const edited = of("edited", [
      op("equal", slice(s0, 0, 4), slice(m0, 0, 4)),
      op("delete", slice(s0, 4, 5), null),
      op("insert", null, slice(m0, 4, 5)),
      op("equal", slice(s0, 5, 17), slice(m0, 5, 17)),
      op("delete", slice(s0, 17, 25), null),
      op("insert", null, slice(m0, 17, 25)),
    ]);
    expect(twice([edited]).status).toBe("PASS");
  });
  it("an event's text is shown in the source's own order, carrying the card's own edit, the old and new occurrences lined up in that edit", () => {
    const fails = (score: ReturnType<typeof grade>, name: string) => {
      expect.soft(score.status, name).toBe("FAIL");
      expect.soft(score.events[0], name).toMatchObject({ discovery: true, attribution: false, verdict: "FAIL" });
    };
    // Characters out of the source's order: the amount line's rate digit also changes 1 -> 2.
    const [left, right] = [docOf([{ text: "USD 100 rate 1" }]), docOf([{ text: "USD 200 rate 2" }])];
    const [l0, r0] = [at(left, "left", "USD 100 rate 1"), at(right, "right", "USD 200 rate 2")];
    const graded = grader(left, right, "USD 100", "USD 200", "USD 100 rate 1", "USD 200 rate 2");
    // One location whose characters are the given ones of a line, in the given order.
    const picked = (loc: SourceLocation, idx: number[]): SourceLocation => ({
      ...loc,
      rawRange: [loc.rawRange[0] + idx[0], loc.rawRange[0] + idx.at(-1)! + 1],
      charIds: idx.map((i) => loc.charIds[i]),
      text: idx.map((i) => Array.from(loc.text)[i]).join(""),
      quads: idx.map((i) => loc.quads[i]),
    });
    const forged = {
      // The rate digit's edit shown in the amount's place: "USD " + rate 1 -> 2 + "00".
      reordered: of("reordered", [
        op("equal", slice(l0, 0, 4), slice(r0, 0, 4)),
        op("delete", slice(l0, 13, 14), null),
        op("insert", null, slice(r0, 13, 14)),
        op("equal", slice(l0, 5, 7), slice(r0, 5, 7)),
      ]),
      // The same inside one location each.
      "one location out of order": of("one location", [
        op("delete", picked(l0, [0, 1, 2, 3, 13, 5, 6]), null),
        op("insert", null, picked(r0, [0, 1, 2, 3, 13, 5, 6])),
      ]),
      // A character cited twice instead of its neighbour.
      duplicated: of("duplicated", [op("delete", picked(l0, [0, 1, 2, 3, 4, 5, 5]), null), op("insert", null, slice(r0, 0, 7))]),
    };
    for (const [name, d] of Object.entries(forged)) fails(graded([d]), name);
    // Controls: the amount edited glyph by glyph, both edits shown, the whole line replaced.
    const amount = [
      op("equal", slice(l0, 0, 4), slice(r0, 0, 4)),
      op("delete", slice(l0, 4, 5), null),
      op("insert", null, slice(r0, 4, 5)),
      op("equal", slice(l0, 5, 7), slice(r0, 5, 7)),
    ];
    expect(graded([of("amount", amount)]).status).toBe("PASS");
    const both = [...amount, op("equal", slice(l0, 7, 13), slice(r0, 7, 13)), op("delete", slice(l0, 13, 14), null), op("insert", null, slice(r0, 13, 14))];
    expect(graded([of("both", both)]).status).toBe("PASS");
    expect(graded([card("whole", [l0], [r0])]).status).toBe("PASS");
    // Across a line break the text runs on from the end of one line to the start of the next. With
    // the two lines the other way round, "USD" ends the page and "100" comes before it.
    const wrapped = (reversed: boolean) => {
      const lines = (amount: string) => (reversed ? [{ text: `${amount} each loss` }, { text: "Limit USD" }] : [{ text: "Limit USD" }, { text: `${amount} each loss` }]);
      const [wl, wr] = [docOf(lines("100")), docOf(lines("200"))];
      const [wl0, wl1, wr0, wr1] = [at(wl, "left", "Limit USD"), at(wl, "left", "100 each loss"), at(wr, "right", "Limit USD"), at(wr, "right", "200 each loss")];
      return grader(wl, wr, "USD 100", "USD 200", ["Limit USD", "100 each loss"], ["Limit USD", "200 each loss"])([
        of("wrapped", [
          op("equal", slice(wl0, 6, 9), slice(wr0, 6, 9), "USD "),
          op("delete", slice(wl1, 0, 1), null),
          op("insert", null, slice(wr1, 0, 1)),
          op("equal", slice(wl1, 1, 3), slice(wr1, 1, 3)),
        ]),
      ]);
    };
    expect(wrapped(false).status).toBe("PASS");
    fails(wrapped(true), "lines in the other order");
    // Edits that only change spaces, inside amounts that do not change (r4415075897's input): no
    // character of the part the event changes (1 -> 2) is edited.
    const [sl, sr] = ["Extra USD  100; Liability USD 200.", "Extra USD 100; Liability USD  200."];
    const [spl, spr] = [docOf([{ text: sl }]), docOf([{ text: sr }])];
    const [s0, t0] = [at(spl, "left", sl), at(spr, "right", sr)];
    fails(
      grader(spl, spr, "USD 100", "USD 200", sl, sr)([of("spaces", [
        op("equal", slice(s0, 0, 10), slice(t0, 0, 10)),
        op("delete", slice(s0, 10, 11), null),
        op("equal", slice(s0, 11, 30), slice(t0, 10, 29)),
        op("insert", null, slice(t0, 29, 30)),
        op("equal", slice(s0, 30, 34), slice(t0, 30, 34)),
      ])]),
      "whitespace edits",
    );
    // Real edits, but only of the part the event keeps (r4415913728's input): the currency codes
    // swap while both amounts stay; no character of 1 -> 2 is edited.
    const [cl, cr] = ["1315 Hull USD 100; Liability EUR 200.", "1315 Hull EUR 100; Liability USD 200."];
    const [cdl, cdr] = [docOf([{ text: cl }]), docOf([{ text: cr }])];
    const [c0, d0] = [at(cdl, "left", cl), at(cdr, "right", cr)];
    fails(
      grader(cdl, cdr, "USD 100", "USD 200", cl, cr)([of("codes", [
        op("equal", slice(c0, 0, 10), slice(d0, 0, 10)),
        op("delete", slice(c0, 10, 13), null),
        op("insert", null, slice(d0, 10, 13)),
        op("equal", slice(c0, 13, 29), slice(d0, 13, 29)),
        op("delete", slice(c0, 29, 32), null),
        op("insert", null, slice(d0, 29, 32)),
        op("equal", slice(c0, 32, 37), slice(d0, 32, 37)),
      ])]),
      "currency codes swapped",
    );
    // A move carries no edit, but its text must still be shown where it is, as a whole number
    // (r4416120281): a Moved card citing only "USD 1000" does not show the move of "USD 100".
    const [ml, mr] = ["USD 100; Liability USD 1000", "Other wording stays."];
    const [mvl, mvr] = [docOf([{ text: ml }, { text: mr }]), docOf([{ text: mr }, { text: ml }])];
    const [n0, q0] = [at(mvl, "left", ml), at(mvr, "right", ml)];
    const moved = (d: Difference) => grader(mvl, mvr, "USD 100", "USD 100", ml, ml, "move")([{ ...d, kind: "Moved" }], ["Moved"]);
    fails(moved(of("thousand", [op("equal", slice(n0, 19, 27), slice(q0, 19, 27))])), "move shown by another number");
    // The first digits of the source's "1000" cut out as "USD 100": whole in the card, not in the source.
    fails(moved(of("cut", [op("equal", slice(n0, 19, 26), slice(q0, 19, 26))])), "a number cut out of a longer one");
    expect(moved(of("line", [op("equal", n0, q0)])).status).toBe("PASS");
    // An empty side is a pure insertion or deletion: no text to find there; the other side still
    // needs its edit (r4415128893's input).
    const [pl, pr] = ["The insurer pays losses.", "The insurer pays approved losses."];
    const [il, ir] = [docOf([{ text: pl }]), docOf([{ text: pr }])];
    const [i0, j0] = [at(il, "left", pl), at(ir, "right", pr)];
    const insertion = [op("equal", slice(i0, 0, 17), slice(j0, 0, 17)), op("insert", null, slice(j0, 17, 26)), op("equal", slice(i0, 17, 24), slice(j0, 26, 33))];
    expect(grader(il, ir, "", "approved", pl, pr)([of("insert", insertion)]).status).toBe("PASS");
    const [k0, m0] = [at(ir, "left", pr), at(il, "right", pl)];
    const deletion = [op("equal", slice(k0, 0, 17), slice(m0, 0, 17)), op("delete", slice(k0, 17, 26), null), op("equal", slice(k0, 26, 33), slice(m0, 17, 24))];
    expect(grader(ir, il, "approved", "", pr, pl)([of("delete", deletion)]).status).toBe("PASS");
    // Nothing on either side is no event to show.
    expect(grader(il, ir, "", "", pl, pr)([of("insert", insertion)]).events[0]).toMatchObject({ attribution: false, verdict: "FAIL" });
    {
      // Which copy of a repeated word the card marks as inserted is its alignment: "South Sudan, " ->
      // "South Sudan, Sudan, " is shown with either Sudan inserted (#2's renewal-triage/10 control).
      const [sa, sb] = ["Iran, South Sudan, Syria.", "Iran, South Sudan, Sudan, Syria."];
      const [sl, sr] = [docOf([{ text: sa }]), docOf([{ text: sb }])];
      const [s0, t0] = [at(sl, "left", sa), at(sr, "right", sb)];
      const sudan = grader(sl, sr, "South Sudan, ", "South Sudan, Sudan, ", sa, sb);
      expect(sudan([of("first", [op("equal", slice(s0, 0, 11), slice(t0, 0, 11)), op("insert", null, slice(t0, 11, 18)), op("equal", slice(s0, 11, 25), slice(t0, 18, 32))])]).status, "the first Sudan inserted").toBe("PASS");
      expect(sudan([of("second", [op("equal", slice(s0, 0, 18), slice(t0, 0, 18)), op("insert", null, slice(t0, 18, 25)), op("equal", slice(s0, 18, 25), slice(t0, 25, 32))])]).status, "the second Sudan inserted").toBe("PASS");
      // An inserted clause whose repeated words the card pairs with the old text after it.
      const [ca, cb] = ["Claims: a bird strike (USD 412,500) and a ground claim.", "Claims: a bird strike (USD 412,500) and a tail strike and a ground claim."];
      const [ql, qr] = [docOf([{ text: ca }]), docOf([{ text: cb }])];
      const [c0, d0] = [at(ql, "left", ca), at(qr, "right", cb)];
      const [kept, added] = [42, 18];
      expect(
        grader(ql, qr, "a bird strike (USD 412,500)", "a bird strike (USD 412,500) and a tail strike", ca, cb)([
          of("clause", [op("equal", slice(c0, 0, kept), slice(d0, 0, kept)), op("insert", null, slice(d0, kept, kept + added)), op("equal", slice(c0, kept, ca.length), slice(d0, kept + added, cb.length))]),
        ]).status,
        "an inserted clause",
      ).toBe("PASS");
      // The old and the new amount at the two ends of a card, each paired with another value and
      // unchanged text between them, do not show "USD 100 -> USD 200" as one change; the line replaced
      // whole does.
      const [ea, eb] = ["USD 100 lorem ipsum dolor EUR 7", "EUR 9 lorem ipsum dolor USD 200"];
      const [el, er] = [docOf([{ text: ea }]), docOf([{ text: eb }])];
      const [e0, f0] = [at(el, "left", ea), at(er, "right", eb)];
      const ends = grader(el, er, "USD 100", "USD 200", ea, eb);
      fails(ends([of("ends", [op("delete", slice(e0, 0, 7), null), op("insert", null, slice(f0, 0, 5)), op("equal", slice(e0, 7, 26), slice(f0, 5, 24)), op("delete", slice(e0, 26, 31), null), op("insert", null, slice(f0, 24, 31))])]), "the amounts at the two ends");
      expect(ends([of("whole", [op("delete", e0, null), op("insert", null, f0)])]).status, "the line replaced whole").toBe("PASS");
    }
  });
});
// One violating result per directly checked invariant; the fault must name that invariant.
const directViolations: Record<string, (x: ReturnType<typeof example>) => void> = {
  no_content_differences: () => {},
  no_material_differences: () => {},
  no_false_text_added_or_removed: () => {},
  no_false_clause_moves: (x) => {
    x.result.differences[0].kind = "Moved";
  },
  no_false_row_additions_or_deletions: (x) => {
    x.result.differences[0].structurePath!.table = "aircraft_schedule";
  },
  moved_clause_has_no_internal_word_edits: (x) => {
    x.result.differences[0].kind = "Moved";
  },
  must_not_classify_as_unchanged_duration_roll_forward: (x) => {
    x.result.differences[0].facts = ["dates_rolled_forward_one_year"];
  },
  grouping_allowed_only_with_all_occurrence_locations: (x) => {
    x.result.differences[0].occurrences = [];
  },
  agreed_value_unchanged: () => {},
  no_amount_or_currency_change: () => {},
};
describe("invariant coverage register (#10)", () => {
  for (const [name, violate] of Object.entries(directViolations))
    it("direct invariant check rejects a violation: " + name, () => {
      const x = example();
      if (name !== "grouping_allowed_only_with_all_occurrence_locations") x.expected.events = [];
      x.expected.invariants = [name];
      violate(x);
      const score = grade(x.result, x.expected, x.layout, x.docs);
      expect(score.status).toBe("FAIL");
      expect(score.faults.some((f) => f.startsWith(name + ": "))).toBe(true);
      expect(score.invariants).toMatchObject([{ name, coverage: "direct", result: "FAIL" }]);
    });
  it("the register covers exactly the 31 invariants of the 32 answers, and every cited test exists", () => {
    const declared = new Set(
      readdirSync("validation/dataset/cases").flatMap(
        (c) =>
          (JSON.parse(readFileSync(`validation/dataset/cases/${c}/expected.json`, "utf8")) as Expected)
            .invariants,
      ),
    );
    expect(declared.size).toBe(31);
    expect(Object.keys(INVARIANTS).sort()).toEqual([...declared].sort());
    const of = (c: string) =>
      Object.entries(INVARIANTS)
        .filter(([, v]) => v.coverage === c)
        .map(([k]) => k)
        .sort();
    expect(of("direct")).toEqual(Object.keys(directViolations).sort());
    expect(of("unsupported")).toEqual([
      "all_aircraft_values_attached_to_original_identity",
      "all_source_text_preserved",
      "ligature_geometry_not_uniformly_guessed",
      "same_logical_row_order",
    ]);
    const source = readFileSync("tests/scorer.test.ts", "utf8");
    for (const [name, v] of Object.entries(INVARIANTS)) {
      if (v.coverage === "indirect") expect(v.tests.length, name).toBeGreaterThan(0);
      if (v.coverage === "unsupported") expect(v.tests, name).toEqual([]);
      for (const t of v.tests) expect(source.includes(t), `${name}: ${t}`).toBe(true);
    }
  });
  it("unsupported and unknown invariants are NOT_EVALUATED; a failure still wins", () => {
    const x = example();
    x.expected.invariants = ["same_logical_row_order"];
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score).toMatchObject({ status: "NOT_EVALUATED", eventStatus: "PASS", faults: [] });
    expect(score.notEvaluated).toMatchObject([
      { invariant: "same_logical_row_order", kind: "invariant_unsupported" },
    ]);
    x.expected.invariants = ["brand_new_requirement"];
    expect(grade(x.result, x.expected, x.layout, x.docs).notEvaluated).toMatchObject([
      { invariant: "brand_new_requirement", kind: "invariant_unknown" },
    ]);
    x.expected.invariants = ["same_logical_row_order", "no_content_differences"];
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
  it("an indirect invariant follows the event checks", () => {
    const x = example();
    x.expected.invariants = ["same_field_identity"];
    expect(grade(x.result, x.expected, x.layout, x.docs).invariants[0]).toMatchObject({
      coverage: "indirect",
      result: "PASS",
    });
    x.result.differences[0].structurePath!.field = "deductible";
    expect(grade(x.result, x.expected, x.layout, x.docs).invariants[0].result).toBe("FAIL");
  });
  it("exit code: 0 strict PASS, 2 only registered gaps, 1 for failures or unregistered gaps", () => {
    const record = (caseId: string, status: string, kind?: NotEvaluated["kind"]) => ({
      caseId,
      status,
      eventStatus: status === "FAIL" ? "FAIL" : "PASS",
      notEvaluated: kind ? [{ kind, reason: "r" }] : [],
    });
    const ok = record("a", "PASS");
    expect(exitCode(summarize([ok]))).toBe(0);
    const gap = summarize([ok, record("b", "NOT_EVALUATED", "invariant_unsupported")]);
    expect(gap).toMatchObject({
      status: "NOT_EVALUATED",
      passed: 1,
      knownGapsOnly: true,
      eventRegression: { status: "PASS", passed: 2 },
    });
    expect(exitCode(gap)).toBe(2);
    expect(exitCode(summarize([ok, record("c", "NOT_EVALUATED", "invariant_unknown")]))).toBe(1);
    expect(exitCode(summarize([ok, record("d", "NOT_EVALUATED", "identity_unsupported")]))).toBe(1);
    expect(
      exitCode(summarize([record("b", "NOT_EVALUATED", "invariant_unsupported"), record("e", "FAIL")])),
    ).toBe(1);
  });
  // R25: a duplicate identity must stay reported and unresolved, with the amount change visible.
  const r25 = () => {
    const x = example();
    x.expected.required_status = "partial_or_explicit_review";
    x.expected.events[0].detection_requirement = "visible_text_delta_with_identity_review";
    x.result.status = "partial";
    x.result.unresolved = [
      { reason: "ambiguous_identity", message: "duplicate keys", left: [], right: [], defaultVisible: true },
    ];
    Object.assign(x.result.differences[0].structurePath!, { confidence: "unresolved", rowKey: null });
    return x;
  };
  it("R25: the reported duplicate with a visible amount change passes", () => {
    const x = r25();
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("PASS");
  });
  it("R25: an unreported duplicate identity fails", () => {
    const x = r25();
    x.result.status = "complete_for_scope";
    x.result.unresolved = [];
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
  it("R25: asserting a unique row key without evidence fails", () => {
    const x = r25();
    Object.assign(x.result.differences[0].structurePath!, { confidence: "reliable", rowKey: "SYN-1026-001" });
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
  it("R25: asserting a party for the duplicate group is a false identity claim", () => {
    const x = r25();
    expect(grade(x.result, x.expected, x.layout, x.docs).events[0].identity).toMatchObject({ pass: true, determined: false, claims: ["unresolved"] });
    x.result.differences[0].structurePath!.entity = "SYN-1026-001";
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.events[0]).toMatchObject({ attribution: true });
    expect(score.events[0].identity).toMatchObject({ pass: false, claims: ["wrong"] });
  });
});
// Issue #2 round 5: the repagination in R16 really adds the page title POLICY WORDING. It is a
// declared Added/Review event; the no-change invariant excuses only the card that exactly is it.
describe("R16: a declared added page title in a no-change control", () => {
  const title = "POLICY WORDING";
  const doc = (pages: [string, number][][]) =>
    textDoc(pages.flatMap((lines, page) => lines.map(([text, y]) => ({ text, x: 40, y, page }))));
  const before: [string, number][][] = [
    [["POLICY SCHEDULE", 81], ["The schedule lists the insured aircraft.", 200], ["LOSS PAYMENT", 400], ["The insurer pays approved losses.", 420]],
    [["SCHEDULE OF AIRCRAFT", 81], ["Aircraft one remains insured.", 200]],
  ];
  const after = (heading: string, extra: [string, number][] = []): [string, number][][] => [
    [["POLICY SCHEDULE", 81], ["The schedule lists the insured aircraft.", 200]],
    [[heading, 81], ...extra, ["LOSS PAYMENT", 135], ["The insurer pays approved losses.", 155]],
    [["SCHEDULE OF AIRCRAFT", 81], ["Aircraft one remains insured.", 200]],
  ];
  // One layout run per line, named by its text.
  const layoutOf = (d: DocInput) => ({
    pages: d.pages.map((p) => ({
      text_runs: p.lines.map((l) => {
        const chars = l.charIds.map((id) => p.chars.find((c) => c.id === id)!);
        return {
          run_id: chars.map((c) => c.text).join(""),
          text: chars.map((c) => c.text).join(""),
          direction: [1, 0],
          characters: chars.map((c) => ({
            quad_tl_tr_br_bl: [[c.quad[0], c.quad[1]], [c.quad[2], c.quad[3]], [c.quad[6], c.quad[7]], [c.quad[4], c.quad[5]]],
          })),
        };
      }),
    })),
  });
  const r16 = (heading = title, extra: [string, number][] = [], declaredRun = title, declaredPage = 1) => {
    const docs: [DocInput, DocInput] = [doc(before), doc(after(heading, extra))];
    const expected: Expected = {
      case_id: "R16_repagination",
      required_status: "complete_for_scope",
      events: [
        {
          event_id: "R16_repagination:E1",
          logical_path: "document.page_heading.policy_wording",
          old: null,
          new: title,
          operation: "add",
          detection_requirement: "must_detect",
          acceptable_kinds: ["Added"],
          acceptable_categories: ["Review"],
        },
      ],
      invariants: ["no_material_differences", "no_false_clause_moves", "all_source_text_preserved"],
      coverage_requirements: [],
      evidence_locations: {
        "R16_repagination:E1": { before: [], after: [{ page_index: declaredPage, run_id: declaredRun }] },
      },
    };
    return { docs, expected, layout: { before: layoutOf(docs[0]), after: layoutOf(docs[1]) } as Layout, result: compare(...docs) };
  };
  // On this branch a direct invariant's fault names the invariant.
  const invariant = "no_material_differences: Undeclared text change in a no-change control";
  it("the exact title card passes, as one Added card stating no fact", () => {
    const x = r16();
    expect(x.result.differences.map((d) => [d.kind, d.facts, d.newText])).toEqual([["Added", [], title]]);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    // all_source_text_preserved is a registered unsupported gap, so the strict status stays
    // NOT_EVALUATED; the card itself passes the event and the no-change invariant.
    expect(score).toMatchObject({ status: "NOT_EVALUATED", eventStatus: "PASS", faults: [] });
    expect(score.notEvaluated.map((n) => n.kind)).toEqual(["invariant_unsupported"]);
    expect(score.invariants.find((i) => i.name === "no_material_differences")?.result).toBe("PASS");
    expect(score.events[0].identity?.applicability).toBe("not_applicable");
  });
  it("an undeclared Review card still fails the control", () => {
    const x = r16();
    x.expected.events = [];
    x.expected.evidence_locations = {};
    expect(grade(x.result, x.expected, x.layout, x.docs).faults).toContain(invariant);
  });
  it("a missing title fails", () => {
    const x = r16();
    x.result.differences = [];
    expect(grade(x.result, x.expected, x.layout, x.docs).faults).toContain("Required event failed: R16_repagination:E1");
  });
  it("another title fails, and its card is not excused", () => {
    const x = r16("WAR EXCLUSION");
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults).toContain(invariant);
  });
  it("the title at another position than declared is not excused", () => {
    const x = r16(title, [], "SCHEDULE OF AIRCRAFT", 2);
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults).toContain(invariant);
  });
  it("a card carrying body text with the title is not excused, though it contains the title", () => {
    const x = r16(title, [["War risks are excluded from this policy.", 100]]);
    const [head, body] = [
      x.result.differences.find((d) => d.newText === title)!,
      x.result.differences.find((d) => d.newText.includes("War risks"))!,
    ];
    expect(head && body && head !== body).toBe(true);
    // The same text reported as one card: every part is backed by real source.
    x.result.differences = [
      {
        ...head,
        newText: head.newText + body.newText,
        right: [...head.right, ...body.right],
        textOps: [...head.textOps, ...body.textOps],
        occurrences: [...head.occurrences, ...body.occurrences],
      },
      ...x.result.differences.filter((d) => d !== head && d !== body),
    ];
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.events[0].verdict).toBe("PASS");
    expect(score.faults).toContain(invariant);
  });
  // The declared title is a real addition, not a continued heading: stating that is false, and the
  // event fails; the card is still the declared edit, so the control itself holds.
  it("a continued_heading stated on the declared title is false and fails the event", () => {
    const x = r16();
    x.result.differences[0].facts = ["continued_heading"];
    const score = grade(x.result, x.expected, x.layout, x.docs);
    expect(score.status).toBe("FAIL");
    expect(score.faults).toEqual([
      `card ${x.result.differences[0].id} states continued_heading, which its source texts disprove`,
      "Required event failed: R16_repagination:E1",
    ]);
    expect(score.events[0]).toMatchObject({ attribution: true, falseFacts: [expect.stringContaining("continued_heading")] });
    expect(score.invariants.find((i) => i.name === "no_material_differences")?.result).toBe("PASS");
  });
  const kept: Record<string, (r: CompareResult) => void> = {
    "a second card for the same title": (r) => {
      r.differences.push({ ...r.differences[0], id: r.differences[0].id + "-copy" });
    },
  };
  for (const [name, mutate] of Object.entries(kept))
    it(`${name} still fails the control`, () => {
      const x = r16();
      mutate(x.result);
      expect(grade(x.result, x.expected, x.layout, x.docs).faults).toContain(invariant);
    });
  it("a hidden title card fails (the result schema already rejects it)", () => {
    const x = r16();
    (x.result.differences[0] as unknown as { defaultVisible: boolean }).defaultVisible = false;
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
});
