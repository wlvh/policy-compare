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
export type NotEvaluated = {
  eventId?: string;
  invariant?: string;
  kind:
    | "identity_unsupported"
    | "unknown_detection_branch"
    | "invariant_unsupported"
    | "invariant_unknown";
  reason: string;
};
export type InvariantScore = {
  name: string;
  coverage: "direct" | "indirect" | "unsupported" | "unknown";
  result: CaseStatus;
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
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
// How each answer invariant is evaluated. "direct": its own check below; "indirect": it can only
// hold when the case's events and completeness pass, and the named tests show a violation fails
// them; "unsupported": the result does not carry the evidence, so the invariant is NOT_EVALUATED.
export const INVARIANTS: Record<
  string,
  { coverage: "direct" | "indirect" | "unsupported"; basis: string; tests: string[] }
> = {
  no_content_differences: { coverage: "direct", basis: "no difference card at all", tests: [] },
  no_material_differences: {
    coverage: "direct",
    basis: "no Material card and no text change outside Cosmetic",
    tests: ["Review does not excuse false text in control"],
  },
  no_false_text_added_or_removed: { coverage: "direct", basis: "no card with a text change", tests: [] },
  no_false_clause_moves: { coverage: "direct", basis: "no Moved card", tests: [] },
  no_false_row_additions_or_deletions: {
    coverage: "direct",
    basis: "no table card with a text change",
    tests: [],
  },
  moved_clause_has_no_internal_word_edits: {
    coverage: "direct",
    basis: "no Moved card with a text change",
    tests: [],
  },
  must_not_classify_as_unchanged_duration_roll_forward: {
    coverage: "direct",
    basis: "no policy_period card classified RollForward",
    tests: [],
  },
  grouping_allowed_only_with_all_occurrence_locations: {
    coverage: "direct",
    basis: "the grouped card lists every expected occurrence location on both sides",
    tests: [],
  },
  agreed_value_unchanged: {
    coverage: "direct",
    basis: "no card pairs or adds/removes amounts or currencies beyond the case's events; bare numbers count on cards that declare an amount field",
    tests: ["R26: correct registration card plus a wrong agreed-value card fails"],
  },
  no_amount_or_currency_change: {
    coverage: "direct",
    basis: "no card pairs or adds/removes amounts or currencies beyond the case's events; bare numbers count on cards that declare an amount field",
    tests: ["R11: correct label card plus a wrong"],
  },
  header_role_must_not_exclude_text: {
    coverage: "indirect",
    basis: "the header-limit event needs a visible card at the header runs; excluded header text leaves none",
    tests: ["empty required output"],
  },
  rotation_must_not_exclude_text: {
    coverage: "indirect",
    basis: "the rotated-status event needs a visible card at the rotated run; excluded text leaves none",
    tests: ["empty required output"],
  },
  must_not_match_values_across_party_identity: {
    coverage: "indirect",
    basis: "each address event checks the party entity and field of its card",
    tests: ["wrong subject"],
  },
  same_field_identity: {
    coverage: "indirect",
    basis: "the label event checks entity and field (sum_insured.label) and requires Replaced",
    tests: ["R11: the label change attached to another field fails", "wrong operation"],
  },
  same_address_identity: {
    coverage: "indirect",
    basis: "the ligature event checks entity original_insured and field address",
    tests: ["wrong subject"],
  },
  exact_move_must_not_be_consumed_by_local_replacement: {
    coverage: "indirect",
    basis: "the move event needs a Moved card and the add event an Added card at their own positions",
    tests: ["R13: the exact move and the similar new clause are not interchangeable"],
  },
  match_row_by_registration_or_declared_serial: {
    coverage: "indirect",
    basis: "the value event checks the row key (declared serial) and field of its card; a registration-keyed match is not accepted by the scorer (stricter than the answer)",
    tests: ["R26: matching the row by the renamed registration instead of the serial fails"],
  },
  secondary_key_or_explicit_identity_review: {
    coverage: "indirect",
    basis: "the registration event requires the serial as row key; an explicit identity review is not accepted by the scorer (stricter than the answer)",
    tests: ["R26: matching the row by the renamed registration instead of the serial fails"],
  },
  duplicate_identity_must_be_reported: {
    coverage: "indirect",
    basis: "required status partial_or_explicit_review needs status partial with an ambiguous_identity group",
    tests: ["R25: an unreported duplicate identity fails"],
  },
  must_not_assert_unique_row_identity_without_evidence: {
    coverage: "indirect",
    basis: "the duplicate event requires confidence unresolved and no row key on its card",
    tests: ["R25: asserting a unique row key without evidence fails"],
  },
  must_not_claim_no_changes: {
    coverage: "indirect",
    basis: "the duplicate event must be discovered as a visible card",
    tests: ["duplicate-key warning alone cannot waive amount evidence"],
  },
  old_and_new_amount_delta_must_remain_visible: {
    coverage: "indirect",
    basis: "the duplicate event needs both amounts on one visible card at their positions",
    tests: ["duplicate-key warning alone cannot waive amount evidence", "hidden event"],
  },
  unresolved_identity_does_not_waive_text_change_detection: {
    coverage: "indirect",
    basis: "an unresolved group does not replace the required card",
    tests: ["duplicate-key warning alone cannot waive amount evidence"],
  },
  duplicate_key_warning_alone_is_not_a_pass: {
    coverage: "indirect",
    basis: "an ambiguous_identity group without the card fails the event",
    tests: ["duplicate-key warning alone cannot waive amount evidence"],
  },
  must_not_claim_complete_or_no_changes: {
    coverage: "indirect",
    basis: "the coverage event needs status partial and a visible coverage region",
    tests: ["incorrect complete"],
  },
  text_elsewhere_on_page_does_not_prove_full_coverage: {
    coverage: "indirect",
    basis: "the coverage region must cover the image region, not the whole page",
    tests: ["generic warning", "wrong region"],
  },
  renewal_classification_must_not_hide_amount_change: {
    coverage: "indirect",
    basis: "the amount event needs its own visible Material/Review card; a RollForward card does not satisfy it",
    tests: ["wrong category"],
  },
  all_source_text_preserved: {
    coverage: "unsupported",
    basis: "the result lists only differences, so it cannot show that every extracted character was compared; the scorer also does not compare extraction with layout.json; R16's other invariants only rule out false claims",
    tests: [],
  },
  ligature_geometry_not_uniformly_guessed: {
    coverage: "unsupported",
    basis: "the fine-geometry check (browser only) accepts boxes inside the ligature glyph and cannot tell a uniform split from glyph geometry; Node runs check no final geometry",
    tests: [],
  },
  all_aircraft_values_attached_to_original_identity: {
    coverage: "unsupported",
    basis: "unchanged rows produce no card, so the result does not show which old row each new row was matched to; R23's other invariants only catch a reported false value change",
    tests: [],
  },
  same_logical_row_order: {
    coverage: "unsupported",
    basis: "row correspondence and order are not observable in the result; zero cards or equal row counts are not evidence of order",
    tests: [],
  },
};
// Amounts: thousands-separated numbers or numbers right after a currency code; on a card or event
// that names an amount field of the answers (R22/R26 agreed_value, R02/R03/R11 sum_insured, R09
// limit) any standalone number counts too. Identifiers such as an MSN stay out unless so declared.
const CODES = "USD|EUR|GBP|JPY|CHF|CNY|HKD|SGD|MYR|AUD|CAD",
  AMOUNT_FIELDS = ["agreed_value", "sum_insured", "limit", "header_limit", "deductible"],
  CURRENCY = new RegExp(`\\b(?:${CODES})(?![A-Za-z])`, "g"),
  NUMBER = `\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|(?<=\\b(?:${CODES})\\s?)\\d+(?:\\.\\d+)?`,
  AMOUNT = new RegExp(NUMBER, "g"),
  DECLARED_AMOUNT = new RegExp(`${NUMBER}|(?<![\\w.,-])\\d+(?:\\.\\d+)?(?![\\w,-]|\\.\\d)`, "g");
const amountField = (path: string | null | undefined) =>
  (path ?? "").split(".").some((p) => AMOUNT_FIELDS.includes(p));
const money = (text: string, declared = false) => [
  ...[...text.matchAll(declared ? DECLARED_AMOUNT : AMOUNT)].map((m) => m[0]),
  ...[...text.matchAll(CURRENCY)].map((m) => m[0]),
];
const minus = (a: string[], b: string[]) => {
  const rest = [...b];
  return a.filter((x) => {
    const i = rest.indexOf(x);
    if (i < 0) return true;
    rest.splice(i, 1);
    return false;
  });
};
// Amount or currency changes asserted by any card, apart from the deltas the case's events declare.
function moneyChanges(result: CompareResult, expected: Expected): string[] {
  const of = (e: Expected["events"][number], text: string | null) =>
    money(text ?? "", amountField(e.logical_path));
  const removed = expected.events.flatMap((e) => minus(of(e, e.old), of(e, e.new))),
    added = expected.events.flatMap((e) => minus(of(e, e.new), of(e, e.old)));
  const cardMoney = (d: Difference, text: string) => money(text, amountField(d.structurePath?.field));
  const allowed = (r: string[], a: string[]) =>
    !minus(r, removed).length && !minus(a, added).length;
  const out: string[] = [];
  for (const d of result.differences.filter((d) => d.kind === "Replaced" || d.kind === "Moved")) {
    const r = minus(cardMoney(d, d.oldText), cardMoney(d, d.newText)),
      a = minus(cardMoney(d, d.newText), cardMoney(d, d.oldText));
    if ((r.length || a.length) && !allowed(r, a))
      out.push(`card ${d.id} changes ${r.join(",") || "-"} to ${a.join(",") || "-"}`);
  }
  const gone = result.differences.filter((d) => d.kind === "Removed").flatMap((d) => cardMoney(d, d.oldText)),
    come = result.differences.filter((d) => d.kind === "Added").flatMap((d) => cardMoney(d, d.newText));
  const r = minus(gone, come),
    a = minus(come, gone);
  if ((r.length || a.length) && !allowed(r, a))
    out.push(`added/removed cards change ${r.join(",") || "-"} to ${a.join(",") || "-"}`);
  return out;
}
type Checked = { result: CompareResult; expected: Expected; layout: Layout };
// Directly checked invariants: each returns the violations it finds.
const DIRECT: Record<string, (c: Checked) => string[]> = {
  no_content_differences: ({ result }) =>
    result.differences.length ? ["False content differences in control"] : [],
  no_false_text_added_or_removed: ({ result }) =>
    result.differences.some((d) => d.hasTextChange) ? ["False text delta in reflow control"] : [],
  no_false_clause_moves: ({ result }) =>
    result.differences.some((d) => d.kind === "Moved") ? ["False move caused by pagination"] : [],
  no_material_differences: ({ result }) =>
    result.differences.some(
      (d) => d.category === "Material" || (d.hasTextChange && d.category !== "Cosmetic"),
    )
      ? ["False substantive change; Review is not an exemption"]
      : [],
  no_false_row_additions_or_deletions: ({ result }) =>
    result.differences.some((d) => d.structurePath?.table && d.hasTextChange)
      ? ["False table value/entity delta"]
      : [],
  moved_clause_has_no_internal_word_edits: ({ result }) =>
    result.differences.some((d) => d.kind === "Moved" && d.hasTextChange)
      ? ["False internal move edit"]
      : [],
  must_not_classify_as_unchanged_duration_roll_forward: ({ result }) =>
    result.differences.some(
      (d) => d.structurePath?.field === "policy_period" && d.category === "RollForward",
    )
      ? ["Changed duration mislabeled renewal"]
      : [],
  grouping_allowed_only_with_all_occurrence_locations: ({ result, expected, layout }) => {
    const event = expected.events[0],
      d = result.differences.find((d) => clean(d.oldText).includes(clean(event.old ?? "")));
    if (!d) return [];
    return (["before", "after"] as const).flatMap((s) => {
      const side = s === "before" ? "left" : "right";
      const locs = d.occurrences.flatMap((o) => o[side]);
      return expected.evidence_locations[event.event_id][s].every((r) =>
        located(locs, [r], layout[s].pages, side),
      )
        ? []
        : ["Missing repeated-header occurrence"];
    });
  },
  agreed_value_unchanged: ({ result, expected }) => moneyChanges(result, expected),
  no_amount_or_currency_change: ({ result, expected }) => moneyChanges(result, expected),
};
// Process exit: 0 strict PASS, 2 only registered coverage gaps, 1 any failure or unregistered gap.
export const exitCode = (s: ReturnType<typeof summarize>) =>
  s.status === "PASS" ? 0 : s.knownGapsOnly ? 2 : 1;
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
  records: {
    caseId: string;
    status: string;
    eventStatus?: string;
    events?: EventScore[];
    notEvaluated?: NotEvaluated[];
    invariants?: InvariantScore[];
  }[],
) {
  const ids = (keep: (s: string) => boolean) =>
    records.filter((r) => keep(r.status)).map((r) => r.caseId);
  const passed = ids((s) => s === "PASS"),
    notEvaluated = ids((s) => s === "NOT_EVALUATED"),
    failed = ids((s) => s !== "PASS" && s !== "NOT_EVALUATED");
  const events = records.flatMap((r) => r.events ?? []);
  const byEvents = (keep: (s: string) => boolean) =>
    records.filter((r) => keep(r.eventStatus ?? r.status)).map((r) => r.caseId);
  const eventFailed = byEvents((s) => s !== "PASS" && s !== "NOT_EVALUATED"),
    eventOpen = byEvents((s) => s === "NOT_EVALUATED");
  const coverageGaps = records.flatMap((r) =>
    (r.notEvaluated ?? []).map((n) => ({ caseId: r.caseId, ...n })),
  );
  const invariantNames = (c: InvariantScore["coverage"]) => [
    ...new Set(records.flatMap((r) => (r.invariants ?? []).filter((i) => i.coverage === c).map((i) => i.name))),
  ];
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
    // Only gaps that are registered as unsupported invariants; anything else exits as a failure.
    knownGapsOnly: !failed.length && coverageGaps.every((g) => g.kind === "invariant_unsupported"),
    coverageGaps,
    eventRegression: {
      status: (eventFailed.length ? "FAIL" : eventOpen.length ? "NOT_EVALUATED" : "PASS") as CaseStatus,
      passed: byEvents((s) => s === "PASS").length,
      total: records.length,
      failed: eventFailed,
      notEvaluated: eventOpen,
    },
    invariantCoverage: {
      direct: invariantNames("direct"),
      indirect: invariantNames("indirect"),
      unsupported: invariantNames("unsupported"),
      unknown: invariantNames("unknown"),
    },
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
export function grade(
  input: unknown,
  expected: Expected,
  layout: Layout,
  docs: [DocInput, DocInput],
  requireFineGeometry = false,
): {
  caseId: string;
  status: CaseStatus;
  eventStatus: CaseStatus;
  faults: string[];
  notEvaluated: NotEvaluated[];
  events: EventScore[];
  invariants: InvariantScore[];
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
      eventStatus: "FAIL",
      notEvaluated: [],
      events: [],
      invariants: [],
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
  const notEvaluated: NotEvaluated[] = events
    .filter((ev) => ev.verdict === "NOT_EVALUATED")
    .map((ev) => ({
      eventId: ev.eventId,
      kind: ev.branch === "unknown" ? "unknown_detection_branch" : "identity_unsupported",
      reason: ev.reason ?? "",
    }));
  for (const ev of events)
    if (ev.verdict === "FAIL")
      faults.push("Required event failed: " + ev.eventId);
  // Each declared invariant is checked directly, follows from the event checks, or is not evaluated.
  const eventVerdict: CaseStatus = events.some((e) => e.verdict === "FAIL") || !completeness
    ? "FAIL"
    : events.some((e) => e.verdict === "NOT_EVALUATED")
      ? "NOT_EVALUATED"
      : "PASS";
  const invariants = expected.invariants.map((name): InvariantScore => {
    const entry = INVARIANTS[name];
    if (!entry) {
      notEvaluated.push({ invariant: name, kind: "invariant_unknown", reason: "unknown invariant " + name });
      return { name, coverage: "unknown", result: "NOT_EVALUATED", reason: "no registered check" };
    }
    if (entry.coverage === "unsupported") {
      notEvaluated.push({ invariant: name, kind: "invariant_unsupported", reason: entry.basis });
      return { name, coverage: "unsupported", result: "NOT_EVALUATED", reason: entry.basis };
    }
    if (entry.coverage === "indirect")
      return { name, coverage: "indirect", result: eventVerdict, reason: entry.basis };
    const violations = DIRECT[name]({ result, expected, layout });
    faults.push(...violations.map((v) => name + ": " + v));
    return { name, coverage: "direct", result: violations.length ? "FAIL" : "PASS", reason: violations.join("; ") || entry.basis };
  });
  const eventsOpen = notEvaluated.some((n) => n.eventId);
  return {
    caseId: expected.case_id,
    status: faults.length ? "FAIL" : notEvaluated.length ? "NOT_EVALUATED" : "PASS",
    eventStatus: faults.length ? "FAIL" : eventsOpen ? "NOT_EVALUATED" : "PASS",
    faults,
    notEvaluated,
    events,
    invariants,
  };
}
