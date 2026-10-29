import {
  ResultSchema,
  resolveLocation,
  type CompareResult,
  type DocInput,
  type SourceLocation,
  type Difference,
} from "../../packages/contracts/index";
export type Expected = {
  case_id: string;
  required_status: string;
  events: {
    event_id: string;
    logical_path: string;
    old: string | null;
    new: string | null;
    operation: string;
    detection_requirement: string;
    acceptable_kinds: string[];
    acceptable_categories: string[];
  }[];
  invariants: string[];
  coverage_requirements: { side: string; page_index: number; reason: string }[];
  evidence_locations: Record<string, Record<"before" | "after", Evidence[]>>;
};
type Evidence = {
  page_index: number;
  run_id?: string;
  image_bbox_top_left_pt?: number[];
};
export type Layout = {
  before: { pages: LayoutPage[] };
  after: { pages: LayoutPage[] };
};
type LayoutPage = {
  text_runs: {
    run_id: string;
    text: string;
    direction: number[];
    characters: { quad_tl_tr_br_bl: number[][] }[];
  }[];
};
export type CaseStatus = "PASS" | "FAIL" | "NOT_EVALUATED";
export type IdentityCheck = {
  applicability: "checked" | "not_applicable" | "unsupported";
  pass: boolean | null;
  reason: string;
};
export type EventScore = {
  eventId: string;
  branch: "text" | "coverage_warning" | "unknown";
  verdict: CaseStatus;
  pass: boolean;
  discovery?: boolean;
  correspondence?: boolean;
  position?: boolean;
  visibility?: boolean;
  completeness?: boolean;
  identity: IdentityCheck | null;
  reason?: string;
};
const CLAUSE =
  "clause wording: no company/party or table-record identity to check; text, operation, category, position, visibility and completeness still apply";
// Known events whose company/table-record identity check does not apply. Keyed by event id and
// pinned to its logical path, so neither "every clause" nor an unknown new path is waived.
export const IDENTITY_NOT_APPLICABLE: Record<
  string,
  { logicalPath: string; reason: string }
> = {
  "R05_negation:E1": { logicalPath: "clauses.territory.text", reason: CLAUSE },
  "R06_and_or:E1": { logicalPath: "clauses.territory.text", reason: CLAUSE },
  "R12_exact_move:E1": { logicalPath: "clauses.loss_payment", reason: CLAUSE },
  "R13_move_and_replacement:E1": {
    logicalPath: "clauses.loss_payment",
    reason: CLAUSE,
  },
  "R13_move_and_replacement:E2": {
    logicalPath: "clauses.new_loss_payment",
    reason: CLAUSE,
  },
  "R14_short_paragraph:E1": {
    logicalPath: "clauses.loss_payment.text",
    reason: CLAUSE,
  },
  "R29_clause_add:E1": { logicalPath: "clauses.new_exclusion", reason: CLAUSE },
  "R30_clause_delete:E1": { logicalPath: "clauses.territory", reason: CLAUSE },
  "R31_punctuation:E1": { logicalPath: "clauses.territory.text", reason: CLAUSE },
  "R09_header_limit:E1": {
    logicalPath: "repeated_header.limit",
    reason:
      "repeated page-header limit: one value printed on every page, no party or record identity; all occurrence locations are checked by the grouping invariant",
  },
  "R19_rotated_status:E1": {
    logicalPath: "document.status",
    reason:
      "document status stamp: state of the whole document, no party or record identity",
  },
  "R16_repagination:E1": {
    logicalPath: "document.page_heading.policy_wording",
    reason:
      "page title added by the repagination: no party or record identity; text, operation, category, position, visibility and completeness still apply",
  },
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
// Which identity check applies to an event; test is null when no identity rule decides the match.
export function identityRule(e: Expected["events"][number]): {
  applicability: IdentityCheck["applicability"];
  reason: string;
  test: ((d: Difference) => boolean) | null;
} {
  const pathParts = e.logical_path.split(".");
  if (e.detection_requirement === "visible_text_delta_with_identity_review")
    return {
      applicability: "checked",
      reason: "duplicate identity must stay unresolved with no asserted row key",
      test: (d) =>
        d.structurePath?.confidence === "unresolved" &&
        d.structurePath.rowKey === null,
    };
  if (pathParts[0] === "risk_details") {
    const entity = ["original_insured", "reinsured"].includes(pathParts[1])
      ? pathParts[1]
      : null;
    const field = pathParts.slice(entity ? 2 : 1).join(".");
    return {
      applicability: "checked",
      reason: `party/field identity: entity=${entity ?? "none"}, field=${field}`,
      test: (d) =>
        d.structurePath?.entity === entity && d.structurePath?.field === field,
    };
  }
  if (pathParts[0] === "aircraft_schedule")
    return {
      applicability: "checked",
      reason: `table record identity: rowKey=${pathParts[1]}, field=${pathParts[2]}`,
      test: (d) =>
        d.structurePath?.rowKey === pathParts[1] &&
        d.structurePath?.field === pathParts[2],
    };
  const known = IDENTITY_NOT_APPLICABLE[e.event_id];
  if (known && known.logicalPath === e.logical_path)
    return { applicability: "not_applicable", reason: known.reason, test: null };
  return {
    applicability: "unsupported",
    reason: known
      ? `N/A entry for ${e.event_id} names ${known.logicalPath}, event has ${e.logical_path}`
      : `no identity check for logical path ${e.logical_path}`,
    test: null,
  };
}
// One status for a run: any failure is FAIL, otherwise any unevaluated case keeps it from PASS.
export function summarize(
  records: { caseId: string; status: string; events?: EventScore[] }[],
) {
  const ids = (keep: (s: string) => boolean) =>
    records.filter((r) => keep(r.status)).map((r) => r.caseId);
  const passed = ids((s) => s === "PASS"),
    notEvaluated = ids((s) => s === "NOT_EVALUATED"),
    failed = ids((s) => s !== "PASS" && s !== "NOT_EVALUATED");
  const events = records.flatMap((r) => r.events ?? []);
  const by = (keep: (e: EventScore) => boolean) =>
    events.filter(keep).map((e) => e.eventId);
  return {
    status: (failed.length
      ? "FAIL"
      : notEvaluated.length
        ? "NOT_EVALUATED"
        : "PASS") as CaseStatus,
    passed: passed.length,
    total: records.length,
    failed,
    notEvaluated,
    identityApplicability: {
      checked: by((e) => e.identity?.applicability === "checked"),
      notApplicable: by((e) => e.identity?.applicability === "not_applicable"),
      unsupported: by((e) => e.identity?.applicability === "unsupported"),
      coverageWarningEvents: by((e) => e.branch === "coverage_warning"),
      unknownDetectionBranch: by((e) => e.branch === "unknown"),
    },
  };
}
const box = (points: number[][]) => [
  Math.min(...points.map((p) => p[0])),
  Math.min(...points.map((p) => p[1])),
  Math.max(...points.map((p) => p[0])),
  Math.max(...points.map((p) => p[1])),
];
const overlap = (a: number[], b: number[]) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const area = (a: number[]) =>
  Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
function located(
  locs: SourceLocation[],
  refs: Evidence[],
  layout: LayoutPage[],
  side: "left" | "right",
  everyQuad = false,
): boolean {
  return locs.some(
    (loc) =>
      loc.side === side &&
      refs.some((ref) => {
        if (loc.pageIndex !== ref.page_index || !ref.run_id) return false;
        const run = layout[ref.page_index]?.text_runs.find(
          (r) => r.run_id === ref.run_id,
        );
        if (!run) return false;
        const bbox = box(run.characters.flatMap((c) => c.quad_tl_tr_br_bl));
        const fine=loc.precision!=='run'||Boolean(loc.resolvedGeometry);
        const targets:number[][]=[];
        if(fine){const text=Array.from(run.text),needle=Array.from(loc.text);for(let i=0;i<=text.length-needle.length;i++)if(needle.length&&needle.every((c,j)=>c===text[i+j]))targets.push(box(run.characters.slice(i,i+needle.length).flatMap(c=>c.quad_tl_tr_br_bl)));}
        else targets.push(bbox);
        const direction =
          loc.direction[0] * run.direction[0] +
          loc.direction[1] * run.direction[1];
        return (
          direction > 0.98 &&
          (()=>{const quads=loc.resolvedGeometry?.quads ?? loc.quads;const valid=(q:number[]) => {
            const b = box([
              [q[0], q[1]],
              [q[2], q[3]],
              [q[4], q[5]],
              [q[6], q[7]],
            ]);
            return targets.some(target=>overlap(b,target)/Math.max(1,area(b))>.35&&(!fine||area(b)/Math.max(1,area(target))<2.5));
          };return quads.length>0&&(everyQuad?quads.every(valid):quads.some(valid));})()
        );
      }),
  );
}
// In a control that must have no substantive change, a text-changing card is still a false
// change unless it is exactly one declared non-Material event: the event's whole old and new
// text (not a part of the card), an accepted kind and category, the event's sides, default
// visibility, and every location of the card, its operations and occurrences resolving to the
// source and lying on the event's declared runs. The case, a title style or the category alone
// never excuse a card.
export function declaredChange(
  d: Difference,
  e: Expected["events"][number],
  refs: Record<"before" | "after", Evidence[]> | undefined,
  layout: Layout,
  docs: [DocInput, DocInput],
): boolean {
  if (
    !refs ||
    e.detection_requirement !== "must_detect" ||
    e.acceptable_categories.includes("Material") ||
    identityRule(e).applicability === "unsupported" ||
    !(identityRule(e).test?.(d) ?? true) ||
    !e.acceptable_kinds.includes(d.kind) ||
    !e.acceptable_categories.includes(d.category) ||
    !d.defaultVisible ||
    clean(d.oldText) !== clean(e.old ?? "") ||
    clean(d.newText) !== clean(e.new ?? "") ||
    (e.old === null) !== (d.left.length === 0) ||
    (e.new === null) !== (d.right.length === 0)
  )
    return false;
  return ([["left", "before"], ["right", "after"]] as const).every(([side, s]) =>
    [
      ...d[side],
      ...d.textOps.flatMap((o) => o[side]),
      ...d.occurrences.flatMap((o) => o[side]),
    ].every(
      (l) =>
        l.side === side &&
        resolveLocation(l, docs) &&
        located([l], refs[s], layout[s].pages, side, true),
    ),
  );
}
export function grade(
  input: unknown,
  expected: Expected,
  layout: Layout,
  docs: [DocInput, DocInput],
  requireFineGeometry = false,
): {
  caseId: string;
  status: CaseStatus;
  faults: string[];
  notEvaluated: { eventId: string; reason: string }[];
  events: EventScore[];
} {
  const faults: string[] = [];
  const parsed = ResultSchema.safeParse(input);
  if (!parsed.success)
    return {
      caseId: expected.case_id,
      status: "FAIL",
      faults: [
        "Invalid result schema: " +
          parsed.error.issues.map((x) => x.path.join(".")).join(","),
      ],
      notEvaluated: [],
      events: [],
    };
  const result = parsed.data;
  if (result.documentHashes.some((h, i) => h !== docs[i].contentHash))
    faults.push("Input hash or direction mismatch");
  const checkLoc = (loc: SourceLocation, side: "left" | "right") =>
    loc.side === side && resolveLocation(loc, docs);
  const finalGeometryValid=(loc:SourceLocation)=>{
    if(loc.precision==='run'&&(!loc.resolvedGeometry||loc.resolvedGeometry.method!=='text_layer_range'||loc.resolvedGeometry.text!==loc.text))return false;
    const page=layout[loc.side==='left'?'before':'after'].pages[loc.pageIndex];if(!page)return false;
    const quadBox=(q:number[])=>box([[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]]);
    const sourceBox=box(loc.quads.flatMap(q=>[[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]]));
    const final=loc.resolvedGeometry?.quads??loc.quads;
    if(!final.length||!final.every(q=>overlap(quadBox(q),sourceBox)/Math.max(1,area(quadBox(q)))>.35))return false;
    return located([loc],page.text_runs.map(r=>({page_index:loc.pageIndex,run_id:r.run_id})),layout[loc.side==='left'?'before':'after'].pages,loc.side,true);
  };
  for (const d of result.differences) {
    if(requireFineGeometry){
      const finalLocations=d.hasTextChange?d.textOps.filter(o=>o.kind!=='equal').flatMap(o=>[...o.left,...o.right]):[...d.left,...d.right];
      if(!finalLocations.length||!finalLocations.every(finalGeometryValid))faults.push('Invalid final changed geometry on one or more sides: '+d.id);
    }
    const compact=(text:string)=>text.replace(/\s/gu,'');
    for(const operation of d.textOps){for(const [side,needed] of [['left',operation.kind!=='insert'],['right',operation.kind!=='delete']] as const)if(needed&&compact(operation.text)!==compact(operation[side].map(l=>l.text).join('')))faults.push('Operation text is not backed by the referenced source characters');}
    if (
      d.textOps
        .filter((o) => o.kind !== "insert")
        .map((o) => o.text)
        .join("") !== d.oldText ||
      d.textOps
        .filter((o) => o.kind !== "delete")
        .map((o) => o.text)
        .join("") !== d.newText
    )
      faults.push("Text operations do not reconstruct both raw sides");
    for (const [locs, side] of [
      [d.left, "left"],
      [d.right, "right"],
    ] as const)
      if (locs.some((l) => !checkLoc(l, side)))
        faults.push("Invalid source reference or geometry: " + d.id);
    if (
      (d.kind !== "Added" && !d.left.length) ||
      (d.kind !== "Removed" && !d.right.length)
    )
      faults.push("Missing source: " + d.id);
    for (const op of d.textOps) {
      if (
        op.left.some((l) => !checkLoc(l, "left")) ||
        op.right.some((l) => !checkLoc(l, "right"))
      )
        faults.push("Invalid operation source");
      if (
        (op.kind === "insert" && op.left.length) ||
        (op.kind === "delete" && op.right.length)
      )
        faults.push("Operation side reversed");
    }
    for (const o of d.occurrences)
      if (
        o.left.some((l) => !checkLoc(l, "left")) ||
        o.right.some((l) => !checkLoc(l, "right"))
      )
        faults.push("Invalid occurrence source");
  }
  const required = expected.required_status;
  const completeness =
    required === "partial_or_explicit_review"
      ? result.status === "partial" &&
        result.unresolved.some((u) => u.reason === "ambiguous_identity")
      : result.status === required;
  if (!completeness) faults.push("Wrong global completeness state");
  const events = expected.events.map((e): EventScore => {
    if (e.detection_requirement === "coverage_warning_required") {
      const findings = expected.coverage_requirements.every((req) =>
        (req.side === "both" ? ["left", "right"] : [req.side]).every((side) => {
          const refs =
            expected.evidence_locations[e.event_id][
              side === "left" ? "before" : "after"
            ];
          return result.coverage.some(
            (c) =>
              c.side === side &&
              c.pageIndex === req.page_index &&
              c.reason === req.reason &&
              c.defaultVisible &&
              c.evidence.length > 0 &&
              refs.some(
                (r) =>
                  r.image_bbox_top_left_pt &&
                  overlap(c.region, r.image_bbox_top_left_pt) /
                    Math.max(1, area(r.image_bbox_top_left_pt)) >
                    0.7 &&
                  area(c.region) / Math.max(1, area(r.image_bbox_top_left_pt)) <
                    1.3,
              ),
          );
        }),
      );
      const pass = findings && result.status === "partial";
      return {
        eventId: e.event_id,
        branch: "coverage_warning",
        verdict: pass ? "PASS" : "FAIL",
        discovery: findings,
        correspondence: findings,
        position: findings,
        visibility: findings,
        completeness: result.status === "partial",
        identity: null,
        pass,
      };
    }
    // The grader cannot judge an unknown requirement; that is a tool gap, not a product failure.
    if (
      !["must_detect", "visible_text_delta_with_identity_review"].includes(
        e.detection_requirement,
      )
    )
      return {
        eventId: e.event_id,
        branch: "unknown",
        verdict: "NOT_EVALUATED",
        identity: null,
        pass: false,
        reason: "Unknown detection branch: " + e.detection_requirement,
      };
    const candidates = result.differences.filter(
      (d) =>
        (e.old === null || clean(d.oldText).includes(clean(e.old))) &&
        (e.new === null || clean(d.newText).includes(clean(e.new))) &&
        (e.old !== null || d.kind === "Added") &&
        (e.new !== null || d.kind === "Removed"),
    );
    const discovery = candidates.length > 0;
    const acceptable = candidates.filter(
      (d) =>
        e.acceptable_kinds.includes(d.kind) &&
        e.acceptable_categories.includes(d.category),
    );
    const refs = expected.evidence_locations[e.event_id];
    const positioned = acceptable.filter(
      (d) =>
        (e.old === null ||
          located(d.left, refs.before, layout.before.pages, "left")) &&
        (e.new === null ||
          located(d.right, refs.after, layout.after.pages, "right")),
    );
    // N/A and unsupported events are matched without an identity rule; every other check still applies.
    const rule = identityRule(e);
    const identity = (d: Difference) => rule.test?.(d) ?? true;
    const matched = positioned.filter(identity);
    const correspondence = acceptable.some(identity) && matched.length > 0;
    const visibility = matched.some((d) => d.defaultVisible);
    // Changed-character evidence must land in the target run, not merely a broad field card.
    const changed=matched.flatMap(d=>d.textOps.filter(op=>op.kind!=='equal'));
    const kinds=[...new Set(changed.map(op=>op.kind))];
    const precise = matched.some(d=>e.operation==='move'&&!d.hasTextChange)||
      (kinds.length>0&&kinds.every(kind=>changed.some(op=>op.kind===kind&&
        (kind==='delete'?e.old!==null&&located(op.left,refs.before,layout.before.pages,'left'):e.new!==null&&located(op.right,refs.after,layout.after.pages,'right')))));
    const fineGeometry = matched.some((d) => {
      const locations = d.hasTextChange
        ? d.textOps
            .filter((o) => o.kind !== "equal")
            .flatMap((o) => [...o.left, ...o.right])
        : [...d.left, ...d.right];
      return (
        locations.length > 0 &&
        locations.every(
          (l) =>
            l.precision !== "run" ||
            (l.resolvedGeometry?.method === "text_layer_range" &&
              l.resolvedGeometry.text === l.text &&
              l.resolvedGeometry.quads.length > 0),
        )
      );
    });
    const position =
      matched.length > 0 && precise && (!requireFineGeometry || fineGeometry);
    // A failed check is a proven product fault; otherwise a missing identity check leaves it unjudged.
    const verdict: CaseStatus = !(
      discovery &&
      correspondence &&
      position &&
      visibility &&
      completeness
    )
      ? "FAIL"
      : rule.applicability === "unsupported"
        ? "NOT_EVALUATED"
        : "PASS";
    return {
      eventId: e.event_id,
      branch: "text",
      verdict,
      discovery,
      correspondence,
      position,
      visibility,
      completeness,
      identity: {
        applicability: rule.applicability,
        pass: rule.test ? acceptable.some(rule.test) && matched.length > 0 : null,
        reason: rule.reason,
      },
      pass: verdict === "PASS",
      ...(verdict === "NOT_EVALUATED" ? { reason: rule.reason } : {}),
    };
  });
  const notEvaluated = events
    .filter((ev) => ev.verdict === "NOT_EVALUATED")
    .map((ev) => ({ eventId: ev.eventId, reason: ev.reason ?? "" }));
  for (const ev of events)
    if (ev.verdict === "FAIL")
      faults.push("Required event failed: " + ev.eventId);
  const inv = expected.invariants;
  if (inv.includes("no_content_differences") && result.differences.length)
    faults.push("False content differences in control");
  if (
    inv.includes("no_false_text_added_or_removed") &&
    result.differences.some((d) => d.hasTextChange)
  )
    faults.push("False text delta in reflow control");
  if (
    inv.includes("no_false_clause_moves") &&
    result.differences.some((d) => d.kind === "Moved")
  )
    faults.push("False move caused by pagination");
  // Each declared event excuses at most one card.
  const declared = new Set<string>();
  const excused = (d: Difference) => {
    const e = expected.events.find(
      (e) =>
        !declared.has(e.event_id) &&
        declaredChange(d, e, expected.evidence_locations[e.event_id], layout, docs),
    );
    if (e) declared.add(e.event_id);
    return Boolean(e);
  };
  if (
    inv.includes("no_material_differences") &&
    result.differences.some(
      (d) =>
        d.category === "Material" ||
        (d.hasTextChange && d.category !== "Cosmetic" && !excused(d)),
    )
  )
    faults.push("False substantive change; Review is not an exemption");
  if (
    inv.includes("no_false_row_additions_or_deletions") &&
    result.differences.some((d) => d.structurePath?.table && d.hasTextChange)
  )
    faults.push("False table value/entity delta");
  if (
    inv.includes("moved_clause_has_no_internal_word_edits") &&
    result.differences.some((d) => d.kind === "Moved" && d.hasTextChange)
  )
    faults.push("False internal move edit");
  if (
    inv.includes("must_not_classify_as_unchanged_duration_roll_forward") &&
    result.differences.some(
      (d) =>
        d.structurePath?.field === "policy_period" &&
        d.category === "RollForward",
    )
  )
    faults.push("Changed duration mislabeled renewal");
  if (inv.includes("grouping_allowed_only_with_all_occurrence_locations")) {
    const event = expected.events[0],
      d = result.differences.find((d) =>
        clean(d.oldText).includes(clean(event.old ?? "")),
      );
    if (d) {
      for (const s of ["before", "after"] as const) {
        const side = s === "before" ? "left" : "right";
        const refs = expected.evidence_locations[event.event_id][s];
        const locs = d.occurrences.flatMap((o) => o[side]);
        if (!refs.every((r) => located(locs, [r], layout[s].pages, side)))
          faults.push("Missing repeated-header occurrence");
      }
    }
  }
  return {
    caseId: expected.case_id,
    status: faults.length ? "FAIL" : notEvaluated.length ? "NOT_EVALUATED" : "PASS",
    faults,
    notEvaluated,
    events,
  };
}
