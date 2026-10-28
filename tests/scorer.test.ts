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
  ResultSchema,
  resolveLocation,
  type CompareResult,
  type Difference,
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
  it("Review does not excuse false text in control", () => {
    const x = example();
    x.expected.events = [];
    x.expected.invariants = ["no_material_differences"];
    x.result.differences[0].category = "Review";
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
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
  it("the 32 pairs have exactly the 11 known N/A events in 10 cases and no unsupported path", () => {
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
    expect(of("not_applicable")).toHaveLength(11);
    expect(new Set(of("not_applicable").map((id) => id.split(":")[0])).size).toBe(10);
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
    "wrong category": (r) => {
      r.differences[0].category = "Cosmetic";
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
  category: Difference["category"] = "Material",
): Difference => ({
  id,
  kind: "Replaced",
  category,
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
  hasTextChange: true,
  defaultVisible: true,
  matchEvidence: { method: "test", score: null, details: [] },
  reviewReasons: [],
  occurrences: [],
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
  const r26 = (bare = false, amounts?: string[], rows?: Rows) => {
    const left = table("TEST-C941", bare, amounts, rows?.left),
      right = table("TEST-RENAMED", bare, amounts, rows?.right);
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
      ? { ...card, kind, right: [], newText: "", textOps: [card.textOps[0]] }
      : { ...card, kind, left: [], oldText: "", textOps: [{ ...card.textOps[1], text: loc.text, right: [loc] }] };
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
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
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
        "Cosmetic",
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
  it("R11: the label change attached to another field fails", () => {
    const x = r11();
    x.result.differences[0].structurePath!.field = "deductible.label";
    expect(grade(x.result, x.expected, x.layout, x.docs).status).toBe("FAIL");
  });
});
// One violating result per directly checked invariant; the fault must name that invariant.
const directViolations: Record<string, (x: ReturnType<typeof example>) => void> = {
  no_content_differences: () => {},
  no_material_differences: () => {},
  no_false_text_added_or_removed: (x) => {
    x.result.differences[0].category = "Cosmetic";
  },
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
    x.result.differences[0].structurePath!.field = "policy_period";
    x.result.differences[0].category = "RollForward";
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
});
