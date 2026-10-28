import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { compare } from "../packages/compare-core/index";
import { textDoc } from "./helpers";
import {
  grade,
  identityRule,
  summarize,
  IDENTITY_NOT_APPLICABLE,
  type Expected,
  type Layout,
} from "./evaluation/scorer";
import type { CompareResult, DocInput } from "../packages/contracts/index";
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
