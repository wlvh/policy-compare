import {
  ResultSchemaV2,
  resolveLocation,
  type CompareResultV2 as CompareResult,
  type DocInput,
  type Fact,
  type SourceLocation,
  type DifferenceV2 as Difference,
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
  // Generated text whose number of occurrences differs between the versions, with every occurrence
  // (page and run) on each side, taken from the generator's layout records (R16, R24).
  repeated_text_requirements?: {
    requirement_id: string;
    text: string;
    counts: Record<"before" | "after", number>;
    occurrences: Record<"before" | "after", (Evidence & { text: string })[]>;
  }[];
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
type LayoutRun = LayoutPage["text_runs"][number];
type LayoutPage = {
  text_runs: {
    run_id: string;
    logical_path?: string | null;
    text: string;
    direction: number[];
    characters: { quad_tl_tr_br_bl: number[][] }[];
  }[];
};
export type CaseStatus = "PASS" | "FAIL" | "NOT_EVALUATED";
export type IdentityCheck = {
  applicability: "checked" | "not_applicable" | "unsupported";
  // Presented as the answer requires: an accepted identity claim on a visible card attributed by source.
  pass: boolean | null;
  // A determined identity the answer accepts (an allowed unresolved one is presented, not determined).
  determined?: boolean | null;
  // The identity claims of the cards attributed to the event by source.
  claims?: IdentityClaim[];
  // determined; presented as an allowed explicit review; requirement_unmet (no identity, or an
  // unresolved one the answer does not allow: not met, but no false statement); wrong_statement
  // (another record, party or field named); null when no card is attributed or no rule applies.
  outcome?: "determined" | "presented_unresolved" | "requirement_unmet" | "wrong_statement" | null;
  reason: string;
};
export type NotEvaluated = {
  eventId?: string;
  invariant?: string;
  kind:
    | "identity_unsupported"
    | "unknown_detection_branch"
    | "invariant_unsupported"
    | "invariant_unknown"
    | "invariant_unverifiable"
    | "claim_unverifiable";
  card?: string;
  reason: string;
};
// One fixed set of repeated generated text: the cards reporting it and what they get wrong.
export type RepeatedTextScore = { requirementId: string; pass: boolean; cards: string[]; problems: string[] };
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
  // The edit sources of a card (or of an allowed delete + add pair) lie on the event's runs.
  attribution?: boolean;
  representation?: "card" | "delete+add" | null;
  position?: boolean;
  visibility?: boolean;
  completeness?: boolean;
  identity: IdentityCheck | null;
  // Stated facts of the attributed cards that their sources disprove.
  falseFacts?: string[];
  reason?: string;
};
const CLAUSE =
  "clause wording: no company/party or table-record identity to check; text, operation, stated facts, position, visibility and completeness still apply";
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
      "page title added by the repagination: no party or record identity; text, operation, stated facts, position, visibility and completeness still apply",
  },
  "R24_table_cross_page:E1": {
    logicalPath: "document.page_heading.schedule_of_aircraft_continued",
    reason:
      "continued title added by the table's page break: no party or record identity; text, operation, stated facts, position, visibility and completeness still apply",
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
    // Migrated in round 18 from "no Material card and no text change outside Cosmetic", to result
    // format 2 in round 19, and narrowed in round 20 to the case's own declarations.
    basis:
      "every source-validated text change is a declared event of the case (one card per event, matching its whole text, kind, sides, identity, visibility and every source location); an undeclared change its sources prove form only by the shared definitions (whitespace, confirmed page numbers of explicit page expressions, continued heading) is not allowed by that fact alone: NOT_EVALUATED, as is one whose form cannot be decided here; any other undeclared text change fails; a card that fails source validation fails; a card without a text change is not judged here",
    tests: [
      "an undeclared text change in a control fails, whatever fact the card states",
      "an undeclared form-only change the sources prove is not allowed by that fact: NOT_EVALUATED, stated or not",
      "a card that fails source validation cannot show that a control holds",
      "R16",
      "R24: an undeclared continued schedule heading is NOT_EVALUATED until the case declares it",
    ],
  },
  no_false_text_added_or_removed: {
    coverage: "direct",
    basis: "no card whose source-validated raw texts differ, and no card that fails source validation; the card's own hasTextChange flag is not used",
    tests: ["a false hasTextChange flag fails, and the control still sees the source text change"],
  },
  no_false_clause_moves: { coverage: "direct", basis: "no Moved card", tests: [] },
  no_false_row_additions_or_deletions: {
    coverage: "direct",
    basis: "no card with a source-validated text change that labels itself a table card or whose delete/insert operations lie on a table record's layout.json runs; no card that fails source validation",
    tests: ["a table card that changes a record's text fails the row control by its sources, without a table label"],
  },
  moved_clause_has_no_internal_word_edits: {
    coverage: "direct",
    basis: "no Moved card whose source-validated raw texts differ; no card that fails source validation",
    tests: [],
  },
  must_not_classify_as_unchanged_duration_roll_forward: {
    coverage: "direct",
    basis: "no card states dates_rolled_forward_one_year when its source texts disprove it (two dates, each moved by exactly one calendar year, the rest equal); the card's field label is not used",
    tests: ["a stated fact its sources disprove fails; discovery and attribution still pass"],
  },
  grouping_allowed_only_with_all_occurrence_locations: {
    coverage: "direct",
    basis: "the grouped card lists every expected occurrence location on both sides",
    tests: [],
  },
  agreed_value_unchanged: {
    coverage: "direct",
    basis: "no card pairs or adds/removes amounts or currencies beyond the case's events; the bare value of every layout.json amount cell a card cites, at any granularity, counts (on a card that declares an amount field, every run it cites is an amount cell) (the amount or currency text a card's delete/insert operations assert in each cell, joined in its own citation order across locations, operations and a record's delete/add cards, must not change inside cells that keep their values, which cells whose whole amounts change only as the case's events declare do not; in a currency cell, letters outside every whole token, such as part of a code, are claimed text too, and so is, in an amount cell whose amount carries a sign, a sign claimed without its digits, on one side or both; two delete or two add edits citing the same source characters of such a cell report one edit twice and fail, whatever records they claim); delete/add amounts cancel only within one record and field, and only where the cells the record's cards cite lie in one layout.json record (a shared claimed key alone, across cards without a record, bare digits outside every layout run, run-level geometry changing an amount cell together with other cells, claims on several amount (or currency) cells of one side, part of a code or a lone sign or separator included, whose correspondence a multiset cannot show, a record whose delete/add values balance only once a cell cited by several cards counts once, claims that differ only in letters inside an amount cell that form no whole amount or currency code, or a delete/add group whose values fail to balance only by cells split over several of its cards while its joined claims agree: NOT_EVALUATED)",
    tests: [
      "R26: correct registration card plus a wrong agreed-value card fails",
      "R26: a wrong bare-number amount card fails whatever field it claims",
      "R26: a wrong amount card cannot hide the change by citing one location per digit",
      "R26: a wrong card citing whole rows cannot hide the amount change",
      "R26: a card claiming a change inside an unchanged amount cell by citing part of it fails",
      "R26: citing an unchanged amount's glyphs in another order cannot hide the claimed change",
      "R26: splitting the claimed amount into one operation per glyph cannot hide the change",
      "R26: delete + add cards declaring agreed_value cannot hide a claim by splitting it across cards",
      "R26: removing an unchanged currency letter by letter across cards fails",
      "R26: removing or changing part of an unchanged currency code fails",
      "R26: one card swapping two unchanged amount cells cannot pass",
      "R26: one card swapping parts of two unchanged currency codes cannot pass",
      "R26: one record's unchanged cell split differently on the two sides",
      "R26: the saved segmentation inputs",
      "R26: a split cell left unevaluated does not hide a wrong pairing in another record",
      "R26: run-level geometry that leaves a cited amount outside layout.json is NOT_EVALUATED",
      "R26: with run-level geometry a wrong row pairing still fails",
      "R26: delete + add cards claiming different parts of an unchanged amount cell fail",
      "R26: delete + add amounts of two records cancel only under a shared claimed key: NOT_EVALUATED",
      "R26: one card swapping the signs of two unchanged amount cells cannot pass; their correspondence is NOT_EVALUATED",
      "R26: two delete + add pairs citing the same source characters fail, whatever keys they claim",
      "R26: delete + add cards without a record that move a sign between two unchanged amounts fail",
      "R26: a lone delete or add card citing only the sign of an unchanged amount fails, with or without a record",
      "R26: claims inside an amount cell that changes as the case declares are not reported as a change inside an unchanged cell",
      "R26: row-wide locations that layout.json does not cover are NOT_EVALUATED",
    ],
  },
  no_amount_or_currency_change: {
    coverage: "direct",
    basis: "no card pairs or adds/removes amounts or currencies beyond the case's events; the bare value of every layout.json amount cell a card cites, at any granularity, counts (on a card that declares an amount field, every run it cites is an amount cell) (the amount or currency text a card's delete/insert operations assert in each cell, joined in its own citation order across locations, operations and a record's delete/add cards, must not change inside cells that keep their values, which cells whose whole amounts change only as the case's events declare do not; in a currency cell, letters outside every whole token, such as part of a code, are claimed text too, and so is, in an amount cell whose amount carries a sign, a sign claimed without its digits, on one side or both; two delete or two add edits citing the same source characters of such a cell report one edit twice and fail, whatever records they claim); delete/add amounts cancel only within one record and field, and only where the cells the record's cards cite lie in one layout.json record (a shared claimed key alone, across cards without a record, bare digits outside every layout run, run-level geometry changing an amount cell together with other cells, claims on several amount (or currency) cells of one side, part of a code or a lone sign or separator included, whose correspondence a multiset cannot show, a record whose delete/add values balance only once a cell cited by several cards counts once, claims that differ only in letters inside an amount cell that form no whole amount or currency code, or a delete/add group whose values fail to balance only by cells split over several of its cards while its joined claims agree: NOT_EVALUATED)",
    tests: [
      "R11: correct label card plus a wrong",
      "R11: a wrong bare-number amount card filed under a non-amount field fails",
      "R11: claiming part of the code inside an unchanged amount cell is NOT_EVALUATED",
      "R11: swapping parts of the codes of two unchanged amount cells is NOT_EVALUATED",
    ],
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
    basis: "the value event's card must lie on the record's value cell by its edit sources; its row key may be the declared serial or the record's registration (from layout.json); another record's key is a false identity claim and fails; an explicit identity review is not allowed by this answer",
    tests: [
      "R22: the record's declared serial or its registration is an accepted row key",
      "R22: another record's serial or registration on a correctly sourced card fails as a false identity claim",
      "R22: an explicitly unresolved identity is not wrong, but this answer does not allow it",
      "R22: the correct record label on a card that deletes the same value from another record does not attribute the event",
    ],
  },
  secondary_key_or_explicit_identity_review: {
    coverage: "indirect",
    basis: "the registration event's card (or one delete + one add card) must lie on the record's registration cells by its edit sources; its row key must be the declared serial, or an explicit identity review (confidence unresolved, naming no other record), which is presented but not determined; the renamed registration or another record's key is a false identity claim and fails",
    tests: [
      "R26: matching the row by the renamed registration instead of the serial fails",
      "R26: an explicit identity review is accepted as presented, not as determined",
      "R26: a missing row key without an explicit review is not a wrong claim, but does not meet the answer",
      "R26: one delete + one add card on the record's registration cell is accepted once",
      "R26: a delete + add pair is not the event when the added text lies in another record, or is the old text moved",
    ],
  },
  duplicate_identity_must_be_reported: {
    coverage: "indirect",
    basis: "required status partial_or_explicit_review needs status partial with an ambiguous_identity group",
    tests: ["R25: an unreported duplicate identity fails"],
  },
  must_not_assert_unique_row_identity_without_evidence: {
    coverage: "indirect",
    basis: "the duplicate event's card, attributed by its edit sources, must be explicitly unresolved (confidence unresolved, no row key); a row key or party on it is a false identity claim and fails",
    tests: ["R25: asserting a unique row key without evidence fails", "R25: asserting a party for the duplicate group is a false identity claim"],
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
    basis: "the amount event needs its own visible card attributed by its edit sources; a one-year roll-forward stated on a card whose amount changes is disproved by its texts and fails",
    tests: ["a stated fact its sources disprove fails; discovery and attribution still pass"],
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
// Amounts: thousands-separated numbers or numbers right after a currency code or sign; on a card or
// event that names an amount field of the answers (R22/R26 agreed_value, R02/R03/R11 sum_insured, R09
// limit), or in a card location on a layout.json run whose logical path ends in such a field, any
// standalone number counts too. The layout says what a cell is whatever field the card claims;
// identifiers such as an MSN stay out. A sign written right before the number ("-", "−", "+", not
// after a letter, digit, "." or ",", except right after a currency code: USD−100,020, Codex PR #11
// comment 6515830550) is part of the amount: -100,020 and 100,020 differ. A hyphen
// between numbers ("1-100,000") is no sign; accounting parentheses are not read as one. A currency
// sign (a Unicode currency symbol such as €, $, £) is a currency as a code is (Codex PR #11 comment
// 6513014284: € paired with $ read as no currency at all).
const CODES = "USD|EUR|GBP|JPY|CHF|CNY|HKD|SGD|MYR|AUD|CAD",
  AMOUNT_FIELDS = ["agreed_value", "sum_insured", "limit", "header_limit", "deductible"],
  CURRENCY = new RegExp(`\\b(?:${CODES})(?![A-Za-z])|\\p{Sc}`, "gu"),
  SIGN = `(?:(?:(?<![\\w.,])|(?<=\\b(?:${CODES})))[-\\u2212+](?=\\d))?`,
  NUMBER = `${SIGN}\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|(?<=(?:\\b(?:${CODES})|\\p{Sc})\\s?)${SIGN}\\d+(?:\\.\\d+)?`,
  AMOUNT = new RegExp(NUMBER, "gu"),
  DECLARED_AMOUNT = new RegExp(`${NUMBER}|(?:(?<![\\w.,])[-\\u2212+](?=\\d)|(?<![\\w.,\\u2212+-]))\\d+(?:\\.\\d+)?(?![\\w,-]|\\.\\d)`, "gu");
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
// Delete and add cards cancel only within one record and field, and only where the cells they cite lie
// in one layout.json record; amounts that cancel only across cards showing no record, or only under a
// shared claimed key, cannot be verified either way.
function moneyChanges(
  result: CompareResult,
  expected: Expected,
  layout: Layout,
): { violations: string[]; open: string[] } {
  const of = (e: Expected["events"][number], text: string | null) =>
    money(text ?? "", amountField(e.logical_path));
  const removed = expected.events.flatMap((e) => minus(of(e, e.old), of(e, e.new))),
    added = expected.events.flatMap((e) => minus(of(e, e.new), of(e, e.old)));
  const unexplained = new Set<string>();
  const bare = (t: string) => minus(money(t, true), money(t));
  const inside = (a: number[], b: number[]) => overlap(a, b) > 0.5 * Math.min(area(a), area(b));
  const isAmount = (r: LayoutRun) => AMOUNT_FIELDS.includes(r.logical_path?.split(".").at(-1) ?? "");
  // The layout.json cells a card cites are found by geometry, whether it cites glyphs, cells or whole
  // rows. `all` holds the bare value of every cited amount cell from the layout, whatever field the
  // card claims. `claimed` maps each amount cell to the text the card's delete or insert operations
  // assert in it, joined in the card's own citation order across locations and operations, so neither
  // reordering nor splitting citations can hide a claimed change. Evidence the geometry cannot
  // attribute is unverifiable: digits of a bare number outside every run, or a run-level location
  // that changes text across an amount cell and other cells.
  const cardMoney = (d: Difference, side: "left" | "right") => {
    const text = side === "left" ? d.oldText : d.newText;
    // A card that declares an amount field makes every run it cites an amount cell; currency cells
    // carry claims too, though their codes are counted from the card text only. Whatever field the
    // card declares, keys of layout.json currency cells end in ":code" and of its amount cells in ":value".
    const declared = amountField(d.structurePath?.field),
      amountRun = (r: LayoutRun) => declared || isAmount(r),
      codeRun = (r: LayoutRun) => r.logical_path?.split(".").at(-1) === "currency",
      claimRun = (r: LayoutRun) => amountRun(r) || codeRun(r),
      cellKey = (r: LayoutRun, page: number) =>
        `${amountRun(r) ? "amount" : "currency"}:${page}/${r.run_id}${codeRun(r) ? ":code" : isAmount(r) ? ":value" : ""}`;
    const pages = layout[side === "left" ? "before" : "after"].pages;
    const cells = new Map<string, string>(),
      claimed = new Map<string, string>(),
      cellText = new Map<string, string>(),
      editedCells = new Map<string, string>(),
      edited: string[] = [],
      // The layout.json table records (by their logical path) of the runs the card cites.
      records = new Set<string>();
    // Each claimed character is also kept by its source identity, to tell one edit reported twice
    // from complementary pieces of a cell.
    const claim = (key: string, t: string, r: LayoutRun, ids: (string | undefined)[], page: number) => {
      claimed.set(key, (claimed.get(key) ?? "") + t);
      cellText.set(key, r.text);
      if (key.startsWith("amount:")) editedCells.set(key, r.text);
      for (const id of ids) if (id !== undefined) edited.push(`${page}/${id}`);
    };
    const cite = (loc: SourceLocation) => {
      const runs = (pages[loc.pageIndex]?.text_runs ?? [])
        .filter((r) => r.characters.length)
        .map((r) => ({ r, b: box(r.characters.flatMap((c) => c.quad_tl_tr_br_bl)) }));
      const hits = loc.quads.map((q) => {
        const b = box([[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]]);
        return runs.filter((x) => inside(b, x.b)).map((x) => x.r);
      });
      for (const r of hits.flat()) {
        if (amountRun(r)) cells.set(`${loc.pageIndex}/${r.run_id}`, r.text);
        const record = /^aircraft_schedule\.(?!header\.)([^.]+)\./.exec(r.logical_path ?? "")?.[1];
        if (record) records.add(record);
      }
      const chars = Array.from(loc.text),
        exact = chars.length === hits.length,
        covered = [...new Set(hits.flat())];
      if (
        bare(loc.text).length &&
        (exact
          ? chars.some((c, i) => /\d/.test(c) && !hits[i].length)
          : minus(bare(loc.text), covered.flatMap((r) => bare(r.text))).length)
      )
        unexplained.add(`card ${d.id} cites "${loc.text}" outside every layout.json run`);
      return { chars, exact, hits, covered };
    };
    for (const loc of d[side]) cite(loc);
    for (const op of d.textOps)
      for (const loc of op[side]) {
        const { chars, exact, hits, covered } = cite(loc);
        if (op.kind === "equal") continue;
        if (exact)
          chars.forEach((c, i) => {
            const r = hits[i].find(claimRun);
            if (r) claim(cellKey(r, loc.pageIndex), c, r, [loc.charIds[i]], loc.pageIndex);
          });
        else if (covered.length === 1 && claimRun(covered[0]))
          claim(cellKey(covered[0], loc.pageIndex), loc.text, covered[0], loc.charIds, loc.pageIndex);
        else if (covered.some(claimRun) && (/\d/.test(loc.text) || money(loc.text).length))
          unexplained.add(`card ${d.id} changes "${loc.text}" across an amount cell and other cells with run-level geometry`);
      }
    return {
      all: [...money(text), ...[...cells.values()].flatMap(bare)],
      claimed,
      textTokens: money(text),
      cells,
      editedCells,
      records,
      edit: { id: d.id, cellText, edited },
    };
  };
  // The whole amounts of the amount cells a card's operations edit, each cell once: an edit of a
  // sign, separator or digit inside such a cell changes the amount it belongs to, even when the
  // edited characters form no amount themselves (r4417081378: "-" -> "+" in -100,020 -> +100,020).
  const cellAmounts = (m: Map<string, string>) => [...m.values()].flatMap((t) => money(t, true));
  // Claimed amounts per cell; claims of several cards on one cell join in card order.
  const merge = (into: Map<string, string>, from: Map<string, string>) => {
    for (const [k, t] of from) into.set(k, (into.get(k) ?? "") + t);
  };
  // Letters or digits a claim holds outside every amount or currency token, such as the "U" of "USD".
  const rest = (t: string) => t.replace(DECLARED_AMOUNT, " ").replace(CURRENCY, " ").replace(/[^\p{L}\p{N}]+/gu, "");
  // In a currency cell they are part of a code, so they count as claimed text. A sign claimed without
  // its digits, in an amount cell whose amount carries a sign, is claimed text of that amount (Codex
  // PR #11 comment 6516045905: the "-" of -100,020 removed on one side only); `cells` holds the
  // claimed amount cells' text. A hyphen in a cell without a signed amount ("1-100,000") is no sign.
  const signs = (t: string, cell = "") =>
    money(cell, true).some((x) => /^[-−+]/u.test(x)) ? (t.replace(DECLARED_AMOUNT, " ").match(/[-−+]/gu) ?? []) : [];
  const tokens = (m: Map<string, string>, cells: Map<string, string>) =>
    [...m].flatMap(([key, t]) => [...money(t, true), ...(key.endsWith(":code") && rest(t) ? [rest(t)] : []), ...signs(t, cells.get(key))]);
  // In an amount cell they may be part of a code or wording such as "each loss": when only they
  // differ between the sides, the claim is not verified either way.
  const partial = (L: Map<string, string>, R: Map<string, string>) => {
    const of = (m: Map<string, string>) => [...m].filter(([key]) => key.endsWith(":value")).map(([, t]) => rest(t)).filter(Boolean);
    return minus(of(L), of(R)).length > 0 || minus(of(R), of(L)).length > 0;
  };
  // Claims on several amount (or several currency) cells of one side are compared as a multiset, so
  // which cell corresponds to which is not verified: when they match only that way, it stays open.
  // A cell counts when its claim holds a token, or, in a layout.json currency or amount cell, any
  // character but whitespace: part of a code, or a sign or separator that forms no amount itself
  // (Codex PR #11 comment 6514897964: "-+" -> "+-" across -100,020 and +100,020).
  const severalCells = (m: Map<string, string>) =>
    ["amount:", "currency:"].some(
      (k) =>
        [...m].filter(([key, t]) => key.startsWith(k) && (money(t, true).length || (/:(code|value)$/.test(key) && /\S/u.test(t)))).length > 1,
    );
  const allowed = (r: string[], a: string[]) =>
    !minus(r, removed).length && !minus(a, added).length;
  // Edited amount cells whose whole amounts change only as the case's events declare: claims inside
  // them belong to that change, as when the card text itself shows it, so they are not compared as a
  // change inside cells that keep their values (a card citing only the "1" -> "2" of a declared
  // 100,020 -> 200,020 still fails its event, which it does not show).
  const declaredChange = (rv: string[], av: string[]) => (rv.length > 0 || av.length > 0) && allowed(rv, av);
  // Delete (or add) cards of one side in a group: the values of cells several of them edit, and the
  // cards that cite one source character in more than one edit. Card text and per-card cell values
  // cannot count a cell split over cards reliably; one character edited twice is one edit reported twice.
  type Edit = ReturnType<typeof cardMoney>["edit"];
  const spread = (edits: Edit[]) => {
    const byCell = new Map<string, Set<string>>(),
      byChar = new Map<string, string[]>(),
      text = new Map<string, string>();
    for (const e of edits) {
      for (const [k, t] of e.cellText) {
        byCell.set(k, (byCell.get(k) ?? new Set()).add(e.id));
        text.set(k, t);
      }
      for (const c of e.edited) byChar.set(c, [...(byChar.get(c) ?? []), e.id]);
    }
    const twice = [...byChar.values()].filter((ids) => ids.length > 1).map((ids) => [...new Set(ids)]);
    return {
      split: [...byCell].filter(([, ids]) => ids.size > 1).flatMap(([k]) => money(text.get(k)!, true)),
      twice: twice.map((ids) => ids.join(" and ")),
      twiceIds: twice,
    };
  };
  // A group whose values do not balance while one of its cells is split over cards: its joined claims
  // decide when they differ; otherwise, values the split cells alone can explain are not counted.
  const splitVerdict = (r: string[], a: string[], rc: string[], ac: string[], gone: Edit[], come: Edit[]) => {
    const split = new Set([...spread(gone).split, ...spread(come).split]);
    if (!split.size || (!r.length && !a.length) || allowed(r, a)) return null;
    if ((rc.length || ac.length) && !allowed(rc, ac)) return "claims";
    return !rc.length && !ac.length && [...r, ...a].every((t) => split.has(t)) ? "unsure" : null;
  };
  const out: string[] = [];
  for (const d of result.differences.filter((d) => d.kind === "Replaced" || d.kind === "Moved")) {
    const L = cardMoney(d, "left"),
      R = cardMoney(d, "right");
    const r = minus(L.all, R.all),
      a = minus(R.all, L.all),
      rc = minus(tokens(L.claimed, L.editedCells), tokens(R.claimed, R.editedCells)),
      ac = minus(tokens(R.claimed, R.editedCells), tokens(L.claimed, L.editedCells));
    const rv = minus(cellAmounts(L.editedCells), cellAmounts(R.editedCells)),
      av = minus(cellAmounts(R.editedCells), cellAmounts(L.editedCells));
    if ((r.length || a.length) && !allowed(r, a))
      out.push(`card ${d.id} changes ${r.join(",") || "-"} to ${a.join(",") || "-"}`);
    // The card's text shows no amount change, yet the amount cells it edits change their amounts.
    else if (!r.length && !a.length && (rv.length || av.length) && !allowed(rv, av))
      out.push(`card ${d.id} edits amount cells whose amounts change ${rv.join(",") || "-"} to ${av.join(",") || "-"}`);
    // The cited cells keep their values, yet the card's operations assert a change inside them.
    else if (!r.length && !a.length && (rc.length || ac.length) && !declaredChange(rv, av))
      out.push(`card ${d.id} claims ${rc.join(",") || "-"} to ${ac.join(",") || "-"} inside amount or currency cells that keep their values`);
    else if (!r.length && !a.length && (severalCells(L.claimed) || severalCells(R.claimed)))
      unexplained.add(`card ${d.id} changes several amount or currency cells; their correspondence is not verified`);
    else if (!r.length && !a.length && partial(L.claimed, R.claimed))
      unexplained.add(`card ${d.id} changes letters inside an amount cell that form no whole amount or currency code`);
  }
  const group = () => ({
    gone: [] as string[],
    come: [] as string[],
    goneClaimed: new Map<string, string>(),
    comeClaimed: new Map<string, string>(),
    goneText: [] as string[],
    comeText: [] as string[],
    goneCells: new Map<string, string>(),
    comeCells: new Map<string, string>(),
    goneEdited: new Map<string, string>(),
    comeEdited: new Map<string, string>(),
    goneEdits: [] as Edit[],
    comeEdits: [] as Edit[],
    records: new Set<string>(),
  });
  const pool = group(),
    records = new Map<string, typeof pool>(),
    groupOf = new Map<string, string>();
  for (const d of result.differences.filter((d) => d.kind === "Removed" || d.kind === "Added")) {
    const who = d.structurePath?.rowKey ?? d.structurePath?.entity,
      key = who + "|" + (d.structurePath?.field ?? "");
    const g = who ? (records.get(key) ?? records.set(key, group()).get(key)!) : pool;
    groupOf.set(d.id, who ? key : "");
    const removed = d.kind === "Removed",
      m = cardMoney(d, removed ? "left" : "right");
    (removed ? g.gone : g.come).push(...m.all);
    merge(removed ? g.goneClaimed : g.comeClaimed, m.claimed);
    (removed ? g.goneText : g.comeText).push(...m.textTokens);
    for (const [k, t] of m.cells) (removed ? g.goneCells : g.comeCells).set(k, t);
    for (const [k, t] of m.editedCells) (removed ? g.goneEdited : g.comeEdited).set(k, t);
    (removed ? g.goneEdits : g.comeEdits).push(m.edit);
    for (const rec of m.records) g.records.add(rec);
  }
  // One edit reported twice is the same fault whatever records the cards claim (Codex PR #11 comment
  // 6514962741): source characters are compared across all delete (and all add) cards; pairs inside
  // one group are reported with that group below.
  const groups = [...records.values(), pool],
    across = [...spread(groups.flatMap((g) => g.goneEdits)).twiceIds, ...spread(groups.flatMap((g) => g.comeEdits)).twiceIds]
      .filter((ids) => new Set(ids.map((id) => groupOf.get(id))).size > 1);
  if (across.length)
    out.push(`cards ${across[0].join(" and ")} cite the same source characters of an amount or currency cell under different claimed records: one edit is reported twice`);
  for (const [key, g] of records) {
    // Within a record, a source cell that several cards of one side cite counts once; the per-card
    // sums (g.gone / g.come) only tell whether that alone made the values balance.
    const gone = [...g.goneText, ...[...g.goneCells.values()].flatMap(bare)],
      come = [...g.comeText, ...[...g.comeCells.values()].flatMap(bare)];
    const r = minus(gone, come),
      a = minus(come, gone),
      rc = minus(tokens(g.goneClaimed, g.goneEdited), tokens(g.comeClaimed, g.comeEdited)),
      ac = minus(tokens(g.comeClaimed, g.comeEdited), tokens(g.goneClaimed, g.goneEdited)),
      rv = minus(cellAmounts(g.goneEdited), cellAmounts(g.comeEdited)),
      av = minus(cellAmounts(g.comeEdited), cellAmounts(g.goneEdited));
    const twice = [...spread(g.goneEdits).twice, ...spread(g.comeEdits).twice],
      split = splitVerdict(r, a, rc, ac, g.goneEdits, g.comeEdits);
    if (twice.length)
      out.push(`record ${key} cards ${twice[0]} cite the same source characters of an amount or currency cell: one edit is reported twice`);
    else if (split === "claims")
      out.push(`record ${key} delete/add cards claim ${rc.join(",") || "-"} to ${ac.join(",") || "-"} inside amount or currency cells split over several cards`);
    else if (split === "unsure")
      unexplained.add(`record ${key} delete/add cards split one amount or currency cell over several cards; their values cannot be counted reliably`);
    else if (r.length && a.length) {
      if (!allowed(r, a)) out.push(`record ${key} delete/add cards change ${r.join(",")} to ${a.join(",")}`);
    } else {
      pool.gone.push(...r);
      pool.come.push(...a);
      // A shared claimed key is not a common record (Codex PR #11 comment 6514810449): amounts that
      // cancel here count as one record's only when the cited cells lie in one layout.json record.
      const cancelled = gone.length - r.length;
      if (cancelled && g.records.size !== 1)
        unexplained.add(`record ${key} delete/add cards cancel ${cancelled} amount(s) under the claimed key only: their cited cells lie in ${g.records.size ? [...g.records].sort().join(" and ") : "no layout.json record"}`);
      // The record's delete and add cards show no amount change, yet the amount cells they edit change.
      if (!r.length && !a.length && (rv.length && av.length) && !allowed(rv, av))
        out.push(`record ${key} delete/add cards edit amount cells whose amounts change ${rv.join(",")} to ${av.join(",")}`);
      // The record's cells cancel, yet its delete and add cards assert different amount text.
      else if (!r.length && !a.length && (rc.length || ac.length) && !declaredChange(rv, av))
        out.push(`record ${key} delete/add cards claim ${rc.join(",") || "-"} to ${ac.join(",") || "-"} inside amount or currency cells that keep their values`);
      else if (!r.length && !a.length && (minus(g.gone, g.come).length || minus(g.come, g.gone).length))
        unexplained.add(`record ${key} delete/add cards cite one amount cell in several cards; the values balance only when each cell counts once`);
      else if (!r.length && !a.length && (severalCells(g.goneClaimed) || severalCells(g.comeClaimed)))
        unexplained.add(`record ${key} delete/add cards change several amount or currency cells; their correspondence is not verified`);
      else if (!r.length && !a.length && partial(g.goneClaimed, g.comeClaimed))
        unexplained.add(`record ${key} delete/add cards change letters inside an amount cell that form no whole amount or currency code`);
    }
  }
  const r = minus(pool.gone, pool.come),
    a = minus(pool.come, pool.gone),
    rc = minus(tokens(pool.goneClaimed, pool.goneEdited), tokens(pool.comeClaimed, pool.comeEdited)),
    ac = minus(tokens(pool.comeClaimed, pool.comeEdited), tokens(pool.goneClaimed, pool.goneEdited)),
    rv = minus(cellAmounts(pool.goneEdited), cellAmounts(pool.comeEdited)),
    av = minus(cellAmounts(pool.comeEdited), cellAmounts(pool.goneEdited));
  const twice = [...spread(pool.goneEdits).twice, ...spread(pool.comeEdits).twice],
    split = splitVerdict(r, a, rc, ac, pool.goneEdits, pool.comeEdits);
  if (twice.length)
    out.push(`added/removed cards ${twice[0]} without a record cite the same source characters of an amount or currency cell: one edit is reported twice`);
  else if (split === "claims")
    out.push(`added/removed cards without a record claim ${rc.join(",") || "-"} to ${ac.join(",") || "-"} inside amount or currency cells split over several cards`);
  else if (split === "unsure")
    unexplained.add("added/removed cards without a record split one amount or currency cell over several cards; their values cannot be counted reliably");
  else if ((r.length || a.length) && !allowed(r, a))
    out.push(`added/removed cards change ${r.join(",") || "-"} to ${a.join(",") || "-"}`);
  // Their text shows no amount change, yet the amount cells their delete and add cards edit change their
  // whole amounts, as for a record's delete + add cards (Codex PR #11 comment 6515705013: a sign moved
  // between two records' cells). An edit on one side only is judged by its claims below.
  else if (!r.length && !a.length && rv.length && av.length && !allowed(rv, av))
    out.push(`added/removed cards without a record edit amount cells whose amounts change ${rv.join(",") || "-"} to ${av.join(",") || "-"}`);
  else if (!r.length && !a.length && (rc.length || ac.length) && !declaredChange(rv, av))
    out.push(`added/removed cards without a record claim ${rc.join(",") || "-"} to ${ac.join(",") || "-"} inside cells that keep their values`);
  else if (!r.length && !a.length && (severalCells(pool.goneClaimed) || severalCells(pool.comeClaimed)))
    unexplained.add("added/removed cards without a record change several amount or currency cells; their correspondence is not verified");
  else if (!r.length && !a.length && partial(pool.goneClaimed, pool.comeClaimed))
    unexplained.add("added/removed cards without a record change letters inside an amount cell that form no whole amount or currency code");
  const cancelled = pool.gone.length - r.length;
  return {
    violations: out,
    open: out.length
      ? []
      : [
          ...(cancelled ? [`${cancelled} removed amount(s) cancel only against added cards that show no common record`] : []),
          ...unexplained,
        ],
  };
}
type Checked = {
  result: CompareResult;
  expected: Expected;
  layout: Layout;
  docs: [DocInput, DocInput];
  // Cards that failed source validation.
  unsourced: Set<string>;
};
// A control is judged from source-validated text only: a card that failed source validation
// violates it, so forged text never shows "no change".
const unbacked = ({ result, unsourced }: Checked) =>
  result.differences
    .filter((d) => unsourced.has(d.id))
    .map((d) => `card ${d.id} is not backed by its sources`);
// layout.json runs of table records (header excluded), as evidence references of one side.
const recordRuns = (layout: Layout, s: "before" | "after"): Evidence[] =>
  layout[s].pages.flatMap((p, page_index) =>
    p.text_runs
      .filter((r) => /^aircraft_schedule\.(?!header\.)[^.]+\.[^.]+$/.test(r.logical_path ?? ""))
      .map((r) => ({ page_index, run_id: r.run_id })),
  );
// Directly checked invariants: each returns the violations it finds, plus what it could not decide.
const DIRECT: Record<string, (c: Checked) => string[] | { violations: string[]; open: string[] }> = {
  no_content_differences: ({ result }) =>
    result.differences.length ? ["False content differences in control"] : [],
  no_false_text_added_or_removed: (c) => [
    ...unbacked(c),
    ...(c.result.differences.some(changes) ? ["False text delta in reflow control"] : []),
  ],
  no_false_clause_moves: ({ result }) =>
    result.differences.some((d) => d.kind === "Moved") ? ["False move caused by pagination"] : [],
  // Migrated in round 18 from "no Material card and no text change outside Cosmetic", to result
  // format 2 in round 19, and narrowed in round 20. The control declares no edit beyond its events,
  // and only the case's own declarations allow one: every source-validated text change must be a
  // declared event (one card each). An undeclared change the sources prove form only by the shared
  // definitions (whitespace, confirmed page numbers, continued heading) is still not allowed by that
  // fact alone, so whether this control permits it is NOT_EVALUATED; so is one whose form cannot be
  // decided here. Any other undeclared text change contradicts the control and fails. A card without
  // a text change is not an edit here; moves and extra cards are judged by the case's move and
  // content invariants.
  no_material_differences: (c) => {
    const { result, expected, layout, docs, unsourced } = c;
    // Each declared event excuses at most one card.
    const declared = new Set<string>();
    const excused = (d: Difference) => {
      const e = expected.events.find(
        (e) =>
          !declared.has(e.event_id) &&
          declaredChange(d, e, expected.evidence_locations[e.event_id], layout, docs, expected.invariants),
      );
      if (e) declared.add(e.event_id);
      return Boolean(e);
    };
    const undeclared = result.differences
      .filter((d) => !unsourced.has(d.id) && changes(d) && !excused(d))
      .map((d) => ({ d, form: formOnly(d, docs) }));
    return {
      violations: [
        ...unbacked(c),
        ...(undeclared.some((u) => u.form === false) ? ["Undeclared text change in a no-change control"] : []),
      ],
      open: undeclared
        .filter((u) => u.form !== false)
        .map((u) =>
          u.form
            ? `card ${u.d.id} changes text undeclared; its sources prove ${FORM_ONLY.filter((f) => factHolds(f, u.d, docs)).join(", ")}, but this control declares no such change`
            : `card ${u.d.id} changes text undeclared; whether the change is form only cannot be decided here`,
        ),
    };
  },
  // A table card that changes text, by its own table label or by its edit sources on a record's
  // layout.json runs.
  no_false_row_additions_or_deletions: (c) => {
    const { result, layout } = c;
    const before = recordRuns(layout, "before"),
      after = recordRuns(layout, "after");
    const onRecord = (d: Difference) =>
      d.textOps.some(
        (o) =>
          (o.kind === "delete" && located(o.left, before, layout.before.pages, "left")) ||
          (o.kind === "insert" && located(o.right, after, layout.after.pages, "right")),
      );
    return [
      ...unbacked(c),
      ...(result.differences.some((d) => changes(d) && (d.structurePath?.table || onRecord(d)))
        ? ["False table value/entity delta"]
        : []),
    ];
  },
  moved_clause_has_no_internal_word_edits: (c) => [
    ...unbacked(c),
    ...(c.result.differences.some((d) => d.kind === "Moved" && changes(d))
      ? ["False internal move edit"]
      : []),
  ],
  // A card stating a one-year roll-forward that its source texts disprove (format 2 has no
  // category; the card's field label is not used).
  must_not_classify_as_unchanged_duration_roll_forward: ({ result, docs, unsourced }) =>
    result.differences.some(
      (d) =>
        !unsourced.has(d.id) &&
        d.facts.includes("dates_rolled_forward_one_year") &&
        factHolds("dates_rolled_forward_one_year", d, docs) === false,
    )
      ? ["Changed duration stated as a one-year roll-forward"]
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
  agreed_value_unchanged: ({ result, expected, layout }) => moneyChanges(result, expected, layout),
  no_amount_or_currency_change: ({ result, expected, layout }) => moneyChanges(result, expected, layout),
};
// Process exit: 0 strict PASS, 2 only registered coverage gaps, 1 any failure or unregistered gap.
export const exitCode = (s: ReturnType<typeof summarize>) =>
  s.status === "PASS" ? 0 : s.knownGapsOnly ? 2 : 1;
// What a card says about the record or party of its change. Where the change belongs is decided by
// its edit sources (the event check); these values only judge the card's outward claim. "determined"
// names an identity the answer accepts, "unresolved" is an explicit open identity (confidence
// unresolved, which the contract reads as "not determined", so a right label beside it names a
// candidate and determines nothing), "absent" names none, and "wrong" names another identity: only
// "wrong" is a false claim, checked first, and a missing or unresolved identity counts only where the
// answer allows it.
export type IdentityClaim = "determined" | "unresolved" | "absent" | "wrong";
// Which identity check applies to an event; claim is null when no identity rule applies.
export function identityRule(
  e: Expected["events"][number],
  invariants: string[] = [],
  layout?: Layout,
): {
  applicability: IdentityCheck["applicability"];
  reason: string;
  claim: ((d: Difference) => IdentityClaim) | null;
  // The claims that present the identity as the answer requires.
  accepts: IdentityClaim[];
} {
  const pathParts = e.logical_path.split(".");
  const open = (d: Difference) => d.structurePath?.confidence === "unresolved";
  if (e.detection_requirement === "visible_text_delta_with_identity_review") {
    const field = pathParts.at(-1);
    return {
      applicability: "checked",
      reason: "duplicate identity must stay explicitly unresolved, with no asserted row key or party",
      claim: (d) => {
        const p = d.structurePath;
        if (p && (p.rowKey !== null || p.entity !== null || (p.field !== null && p.field !== field)))
          return "wrong";
        return open(d) ? "unresolved" : "absent";
      },
      accepts: ["unresolved"],
    };
  }
  if (pathParts[0] === "risk_details") {
    const entity = ["original_insured", "reinsured"].includes(pathParts[1])
      ? pathParts[1]
      : null;
    const field = pathParts.slice(entity ? 2 : 1).join(".");
    return {
      applicability: "checked",
      reason: `party/field identity: entity=${entity ?? "none"}, field=${field}`,
      claim: (d) => {
        const p = d.structurePath;
        if (!p) return "absent";
        if ((p.entity !== null && p.entity !== entity) || (p.field !== null && p.field !== field))
          return "wrong";
        return open(d) ? "unresolved" : p.entity === entity && p.field === field ? "determined" : "absent";
      },
      accepts: ["determined"],
    };
  }
  if (pathParts[0] === "aircraft_schedule") {
    const [, serial, field] = pathParts;
    // The answer's keys for the record: its declared serial; its registration (from layout.json,
    // either side) where the case matches rows by registration or serial; and an explicit identity
    // review where the case allows one.
    const registrations = invariants.includes("match_row_by_registration_or_declared_serial")
      ? (["before", "after"] as const).flatMap(
          (s) =>
            layout?.[s].pages.flatMap((p) =>
              p.text_runs
                .filter((r) => r.logical_path === `aircraft_schedule.${serial}.registration`)
                .map((r) => r.text.trim()),
            ) ?? [],
        )
      : [];
    const keys = new Set([serial, ...registrations]);
    const review = invariants.includes("secondary_key_or_explicit_identity_review");
    return {
      applicability: "checked",
      reason: `table record identity: rowKey ${[...keys].join(" or ")}${review ? " or an explicit identity review" : ""}, field=${field}`,
      claim: (d) => {
        const p = d.structurePath;
        if (!p) return "absent";
        if (
          (p.rowKey !== null && !keys.has(p.rowKey)) ||
          (p.entity !== null && !keys.has(p.entity)) ||
          (p.field !== null && p.field !== field)
        )
          return "wrong";
        return open(d) ? "unresolved" : p.rowKey !== null && p.field === field ? "determined" : "absent";
      },
      accepts: review ? ["determined", "unresolved"] : ["determined"],
    };
  }
  const known = IDENTITY_NOT_APPLICABLE[e.event_id];
  if (known && known.logicalPath === e.logical_path)
    return { applicability: "not_applicable", reason: known.reason, claim: null, accepts: [] };
  return {
    applicability: "unsupported",
    reason: known
      ? `N/A entry for ${e.event_id} names ${known.logicalPath}, event has ${e.logical_path}`
      : `no identity check for logical path ${e.logical_path}`,
    claim: null,
    accepts: [],
  };
}
// The facts a format-2 card may state (contract FactSchema), recomputed from the card's
// source-validated texts and the two documents, never taken from the product: true when the
// sources prove the fact, false when they disprove it, null when the scorer cannot decide it.
const words = (t: string) => t.trim().split(/\s+/u).join(" ");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// A date's day and year are whole numbers of the text, as page numbers are: the "2024" of "20240"
// or the "21" of "121" is none (Codex PR #11 comment 6513158877).
const DATE = /(?<!\d[.,]?)(\d{1,2}) ([A-Za-z]+) (\d{4})(?![.,]?\d)/g;
const lineTexts = (doc: DocInput) =>
  doc.pages.flatMap((p) =>
    p.lines.map((l) => words(l.charIds.map((id) => p.chars.find((c) => c.id === id)?.text ?? "").join(""))),
  );
// A text's explicit page expressions ("Page n", "Page n of N", "Page n/N"): their numbers, in
// order, and the text with those numbers masked (the words "Page" and "of" kept). Whether a printed
// number is the page's real place in the PDF is not part of the fact. n and N are whole numbers of
// the text: the "1" of "Page 1.1" or the "10" of "of 10,5" is not one.
const PAGE_EXPRESSION = /\bpage\s*(\p{N}+)(?![.,]?\p{N})(?:\s*(?:of|\/)\s*(\p{N}+)(?![.,]?\p{N}))?/giu;
function pageNumbers(text: string) {
  const numbers: string[] = [];
  const masked = text.replace(PAGE_EXPRESSION, (m, n: string, of?: string) => {
    numbers.push(n, of ?? "");
    return m.replace(/\p{N}+/gu, "\u0000");
  });
  return { numbers, masked, count: numbers.length / 2 };
}
export function factHolds(fact: Fact, d: Difference, docs: [DocInput, DocInput]): boolean | null {
  const [a, b] = [d.left.length ? d.oldText : null, d.right.length ? d.newText : null];
  if (!changes(d)) return false;
  switch (fact) {
    // The raw texts differ only in whitespace; an absent side reads as empty text.
    case "whitespace_only":
      return words(a ?? "") === words(b ?? "");
    // Both sides: only numbers inside explicit page expressions differ, the rest of the text (the
    // expressions' words and every whitespace character included, r4417386694) is the same; a
    // one-sided text is nothing but such expressions and whitespace. It says nothing about the
    // printed numbers being right, nor about the line's role: the shared definition is the text form
    // alone (#2's round 11), so a single heading or a body sentence holds it as a repeated page line
    // does. Where the product chooses to state it is the product's policy, not part of the fact.
    case "page_number_only": {
      let form: boolean;
      if (a !== null && b !== null) {
        const [x, y] = [pageNumbers(a), pageNumbers(b)];
        form = x.masked === y.masked && x.numbers.join("\u0000") !== y.numbers.join("\u0000");
      } else {
        const one = (a ?? b)!;
        form = pageNumbers(one).count > 0 && !/\S/u.test(one.replace(PAGE_EXPRESSION, ""));
      }
      return form;
    }
    // One side only: a heading with an explicit "continued" suffix whose base is the whole text
    // of a line in both documents.
    case "continued_heading": {
      if ((a === null) === (b === null)) return false;
      const base = (a ?? b)!.trim().match(/^(.+?)[\s(,:–-]*\b(?:continued|cont['’]d|cont\.?)\)?\.?$/iu)?.[1];
      return base !== undefined && docs.every((doc) => lineTexts(doc).includes(words(base)));
    }
    // Both sides: two dates each, each date moved by exactly one calendar year, the text outside
    // the dates equal.
    case "dates_rolled_forward_one_year": {
      if (a === null || b === null) return false;
      const dates = (t: string) =>
        [...t.matchAll(DATE)].map((m) => {
          const [day, month, year] = [Number(m[1]), MONTHS.indexOf(m[2]), Number(m[3])];
          const at = new Date(Date.UTC(year, month, day));
          return month >= 0 && at.getUTCDate() === day && at.getUTCMonth() === month ? [day, month, year] : null;
        });
      const [x, y] = [dates(a), dates(b)];
      return (
        x.length === 2 &&
        y.length === 2 &&
        [...x, ...y].every(Boolean) &&
        x.every((v, i) => v![0] === y[i]![0] && v![1] === y[i]![1] && v![2] + 1 === y[i]![2]) &&
        a.replace(DATE, "\u0000") === b.replace(DATE, "\u0000")
      );
    }
  }
}
// The variants of a card's repeated line (shared definition): an occurrence's text as the source has
// it, whitespace included (a space added on one page makes that page's own variant), with the
// counter of an explicit page expression read against its own page ("Page 3" on
// page 3 and "Page 4" on page 4 are one variant, "Page 99" on page 3 another) when that counter
// counts with the pages. Each side decides from the occurrences the card cites there: the counter
// counts when they show it with different values and one offset to their pages, and it is fixed
// when they show one value on two or more pages; a side that shows neither takes the other side's
// reading (#2's r4417303223: the product recognises a repeated line of either document in both, its
// own document's reading first). A fixed counter (the same "Page 1" printed on every page), a page
// total and every other number stay as printed.
const counters = (t: string) => [...t.matchAll(PAGE_EXPRESSION)].map((m) => m[1]);
// Only a counter printed plainly (its value written the usual way) is read against its page: "Page
// 03" or a counter in digits Number() cannot read stays as printed, its own variant.
const plain = (n: string) => String(Number(n)) === n;
const sideText = (locs: SourceLocation[]) => locs.map((l) => l.text).join("");
// The source text of some locations, read location by location in the order the card cites them:
// each location's own line from its first to its last character, in the line's order, so whitespace
// inside it is kept as printed; when a location follows the previous one on the same line, the line's
// characters between them too (whitespace between two cited pieces). Another line's characters are
// not part of it, even where the raw order puts them between two cited pieces (a table extracted
// column by column, Codex PR #9 comment 6510906577), and raw extraction order is not imposed across
// cells (a heading whose columns one page extracts from the right, Codex PR #9 comment 6514840841).
const sourceText = (locs: SourceLocation[], doc: DocInput) =>
  [...new Set(locs.map((l) => l.pageIndex))]
    .sort((a, b) => a - b)
    .map((page) => {
      const chars = new Map((doc.pages[page]?.chars ?? []).map((c) => [c.id, c.text])),
        lines = doc.pages[page]?.lines ?? [],
        at = new Map(lines.flatMap((l, n) => l.charIds.map((id, k): [string, [number, number]] => [id, [n, k]])));
      let text = "";
      // The line and span (in that line's order) read so far, when the last location had one.
      let line = -1,
        lo = 0,
        hi = -1;
      for (const loc of locs.filter((l) => l.pageIndex === page)) {
        const spots = loc.charIds.map((id) => at.get(id));
        const n = spots[0]?.[0];
        // A location not on one line of its page fails source validation; its own text stands.
        if (n === undefined || spots.some((p) => p?.[0] !== n)) {
          text += loc.text;
          line = -1;
          continue;
        }
        const ks = spots.map((p) => p![1]),
          from = Math.min(...ks),
          to = Math.max(...ks);
        const after: boolean = n === line && from > lo;
        text += lines[n].charIds.slice(after ? hi + 1 : from, to + 1).map((id) => chars.get(id) ?? "").join("");
        [line, lo, hi] = [n, from, after ? Math.max(to, hi) : to];
      }
      return text;
    })
    .join(" ");
function variants(d: Difference) {
  // Per side and counter position: true when it counts, false when it is fixed, absent when the
  // side shows neither.
  const reading = { left: new Map<number, boolean>(), right: new Map<number, boolean>() };
  for (const side of ["left", "right"] as const) {
    const lines = d.occurrences
      .filter((o) => o[side].length)
      .map((o) => ({ cs: counters(sideText(o[side])), page: o[side][0].pageIndex + 1 }));
    for (let k = 0; k < Math.max(0, ...lines.map((l) => l.cs.length)); k++) {
      const at = lines.filter((l) => l.cs[k] !== undefined && plain(l.cs[k])).map((l) => ({ v: Number(l.cs[k]), page: l.page }));
      if (at.length < 2) continue;
      if (new Set(at.map((x) => x.v)).size === 1) reading[side].set(k, false);
      else if (new Set(at.map((x) => x.v - x.page)).size === 1) reading[side].set(k, true);
    }
  }
  return (text: string, page: number, side: "left" | "right") => {
    let k = 0;
    const other = side === "left" ? "right" : "left";
    return text.replace(PAGE_EXPRESSION, (m, n: string) => {
      const j = k++;
      return (reading[side].get(j) ?? reading[other].get(j)) && plain(n) ? m.replace(n, `#${Number(n) - page}`) : m;
    });
  };
}
// A card's own text on a side, from the source of the locations it shows there, read as a variant;
// "" when the card shows nothing there.
const ownText = (d: Difference, side: "left" | "right", docs: [DocInput, DocInput], variant = variants(d)) => {
  const card = side === "left" ? d.left : d.right;
  return card.length ? variant(sourceText(card, docs[side === "left" ? 0 : 1]), card[0].pageIndex + 1, side) : "";
};
// A card's occurrences of its own text on a side, by their source texts and pages.
const ownOccurrences = (d: Difference, side: "left" | "right", docs: [DocInput, DocInput]) => {
  const variant = variants(d);
  if (!(side === "left" ? d.left : d.right).length) return [];
  const own = ownText(d, side, docs, variant);
  const doc = docs[side === "left" ? 0 : 1];
  return d.occurrences.filter((o) => o[side].length > 0 && variant(sourceText(o[side], doc), o[side][0].pageIndex + 1, side) === own);
};
const sameLocation = (a: SourceLocation, b: SourceLocation) =>
  a.side === b.side && a.pageIndex === b.pageIndex && a.charIds.join("\u0000") === b.charIds.join("\u0000");
// Whether a text change is form only by the shared definitions above (whitespace, confirmed page
// numbers, continued heading), whether or not the card states it. This only decides between a
// contradiction and an open question in a no-change control; it never allows a change there.
const FORM_ONLY: Fact[] = ["whitespace_only", "page_number_only", "continued_heading"];
const formOnly = (d: Difference, docs: [DocInput, DocInput]): boolean | null => {
  const held = FORM_ONLY.map((f) => factHolds(f, d, docs));
  return held.includes(true) ? true : held.includes(null) ? null : false;
};
// Whether a card changes text: its source-validated raw texts differ. Its own flag is a claim.
const changes = (d: Difference) => d.oldText !== d.newText;
// One status for a run: any failure is FAIL, otherwise any unevaluated case keeps it from PASS.
export function summarize(
  records: {
    caseId: string;
    status: string;
    eventStatus?: string;
    events?: EventScore[];
    notEvaluated?: NotEvaluated[];
    invariants?: InvariantScore[];
    repeatedText?: RepeatedTextScore[];
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
    // Identity outcomes of the checked events: a determination requirement not met is reported apart
    // from an identity statement that names another record.
    identityClaims: {
      determined: by((e) => e.identity?.outcome === "determined"),
      presentedUnresolved: by((e) => e.identity?.outcome === "presented_unresolved"),
      requirementUnmet: by((e) => e.identity?.outcome === "requirement_unmet"),
      wrong: by((e) => e.identity?.outcome === "wrong_statement"),
    },
    // The answers' fixed sets of repeated generated text: complete and correctly counted, or not.
    repeatedText: Object.fromEntries(
      (["pass", "fail"] as const).map((k) => [
        k,
        records.flatMap((r) => r.repeatedText ?? []).filter((t) => t.pass === (k === "pass")).map((t) => t.requirementId),
      ]),
    ) as Record<"pass" | "fail", string[]>,
    // Invariant results by coverage; indirect results restate the event checks and add no evidence.
    invariantResults: Object.fromEntries(
      (["direct", "indirect", "unsupported", "unknown"] as const).map((c) => [
        c,
        Object.fromEntries(
          (["PASS", "FAIL", "NOT_EVALUATED"] as const).map((r) => [
            r,
            records.flatMap((x) => x.invariants ?? []).filter((i) => i.coverage === c && i.result === r).length,
          ]),
        ),
      ]),
    ) as Record<InvariantScore["coverage"], Record<CaseStatus, number>>,
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
// A document's text in reading order: pages in order, each page's lines in their order, and in a
// line the non-whitespace scalars of its characters (a position is a character id and the scalar's
// index in it). `next` gives the following position and what separates them: nothing, whitespace
// in the line, or a line break.
function readingOrder(doc: DocInput) {
  const text = new Map<string, string>();
  const at = new Map<string, { line: number; i: number }>();
  const lines: { key: string; space: boolean }[][] = [];
  for (const p of doc.pages) {
    for (const c of p.chars) text.set(c.id, c.text);
    for (const l of p.lines) {
      const seq: { key: string; space: boolean }[] = [];
      let space = false;
      for (const id of l.charIds)
        Array.from(text.get(id) ?? "").forEach((s, k) => {
          if (/\s/u.test(s)) space = true;
          else {
            at.set(`${id}#${k}`, { line: lines.length, i: seq.length });
            seq.push({ key: `${id}#${k}`, space });
            space = false;
          }
        });
      lines.push(seq);
    }
  }
  const next = (key: string): { key: string; gap: "none" | "space" | "line" } | null => {
    const pos = at.get(key);
    if (!pos) return null;
    const after = lines[pos.line][pos.i + 1];
    if (after) return { key: after.key, gap: after.space ? "space" : "none" };
    const line = lines.slice(pos.line + 1).find((l) => l.length);
    return line ? { key: line[0].key, gap: "line" } : null;
  };
  const prev = (key: string): { key: string; gap: "none" | "space" | "line" } | null => {
    const pos = at.get(key);
    if (!pos) return null;
    const here = lines[pos.line][pos.i];
    if (pos.i > 0) return { key: lines[pos.line][pos.i - 1].key, gap: here.space ? "space" : "none" };
    const line = lines.slice(0, pos.line).reverse().find((l) => l.length);
    return line ? { key: line.at(-1)!.key, gap: "line" } : null;
  };
  const scalar = (key: string) => {
    const [id, k] = key.split("#");
    return Array.from(text.get(id) ?? "")[Number(k)] ?? "";
  };
  // Whether the character at a position continues a number of the source in the given direction:
  // a digit right beside it, or a "." or "," right beside it with a digit right beyond. Before it,
  // a sign right beside it is part of the number too (as for amounts), unless the sign itself
  // follows a letter, digit, "." or "," right beside it ("1-100", "SYN-1026").
  const continuesNumber = (key: string, step: typeof next) => {
    const a = step(key);
    if (!a || a.gap !== "none") return false;
    if (/\p{Nd}/u.test(scalar(a.key))) return true;
    if (step === prev && /^[-−+]$/u.test(scalar(a.key))) {
      const b = prev(a.key);
      return !b || b.gap !== "none" || !/^[\p{L}\p{N}_.,]$/u.test(scalar(b.key));
    }
    const b = /^[.,]$/.test(scalar(a.key)) ? step(a.key) : null;
    return b !== null && b.gap === "none" && /\p{Nd}/u.test(scalar(b.key));
  };
  // The positions of a location's non-whitespace characters, in its order.
  const keys = (loc: SourceLocation) =>
    loc.charIds.flatMap((id) => Array.from(text.get(id) ?? "").flatMap((s, k) => (/\s/u.test(s) ? [] : [`${id}#${k}`])));
  return { next, prev, keys, continuesNumber };
}
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
// In a no-change control, a text-changing card is an undeclared edit unless it is exactly one
// declared event: the event's whole old and new text (not a part of the card), an accepted kind,
// the event's sides, an accepted identity claim, default visibility, and every location of the card,
// its operations and occurrences resolving to the source and lying on the event's declared runs.
// Its stated facts are judged by the card checks, not here: the case or a title style never excuse
// a card.
export function declaredChange(
  d: Difference,
  e: Expected["events"][number],
  refs: Record<"before" | "after", Evidence[]> | undefined,
  layout: Layout,
  docs: [DocInput, DocInput],
  invariants: string[] = [],
): boolean {
  const rule = identityRule(e, invariants, layout);
  if (
    !refs ||
    e.detection_requirement !== "must_detect" ||
    rule.applicability === "unsupported" ||
    (rule.claim !== null && !rule.accepts.includes(rule.claim(d))) ||
    !e.acceptable_kinds.includes(d.kind) ||
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
  eventStatus: CaseStatus;
  faults: string[];
  notEvaluated: NotEvaluated[];
  events: EventScore[];
  invariants: InvariantScore[];
  repeatedText: RepeatedTextScore[];
} {
  const faults: string[] = [];
  const parsed = ResultSchemaV2.safeParse(input);
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
      repeatedText: [],
    };
  const result = parsed.data;
  if (result.documentHashes.some((h, i) => h !== docs[i].contentHash))
    faults.push("Input hash or direction mismatch");
  const checkLoc = (loc: SourceLocation, side: "left" | "right") =>
    loc.side === side && resolveLocation(loc, docs);
  const order = [readingOrder(docs[0]), readingOrder(docs[1])] as const;
  const finalGeometryValid=(loc:SourceLocation)=>{
    if(loc.precision==='run'&&(!loc.resolvedGeometry||loc.resolvedGeometry.method!=='text_layer_range'||loc.resolvedGeometry.text!==loc.text))return false;
    const page=layout[loc.side==='left'?'before':'after'].pages[loc.pageIndex];if(!page)return false;
    const quadBox=(q:number[])=>box([[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]]);
    const sourceBox=box(loc.quads.flatMap(q=>[[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]]));
    const final=loc.resolvedGeometry?.quads??loc.quads;
    if(!final.length||!final.every(q=>overlap(quadBox(q),sourceBox)/Math.max(1,area(quadBox(q)))>.35))return false;
    return located([loc],page.text_runs.map(r=>({page_index:loc.pageIndex,run_id:r.run_id})),layout[loc.side==='left'?'before':'after'].pages,loc.side,true);
  };
  // Cards whose texts or locations fail source validation: their text cannot show that a control holds.
  const unsourced = new Set<string>();
  // Stated facts the scorer cannot decide from the sources.
  const claimsOpen: NotEvaluated[] = [];
  for (const d of result.differences) {
    const before = faults.length;
    if(requireFineGeometry){
      const finalLocations=changes(d)?d.textOps.filter(o=>o.kind!=='equal').flatMap(o=>[...o.left,...o.right]):[...d.left,...d.right];
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
    if (faults.length > before) {
      unsourced.add(d.id);
      continue;
    }
    // hasTextChange means the two raw texts differ; a flag that says otherwise is a false claim.
    if (d.hasTextChange !== changes(d))
      faults.push("hasTextChange contradicts the card's source-validated texts: " + d.id);
    // Every stated fact is recomputed from the sources.
    for (const fact of d.facts) {
      const held = factHolds(fact, d, docs);
      if (held === false) faults.push(`card ${d.id} states ${fact}, which its source texts disprove`);
      if (held === null)
        claimsOpen.push({
          card: d.id,
          kind: "claim_unverifiable",
          reason: `card ${d.id} states ${fact}; its sources cannot decide it here`,
        });
    }
    // Two occurrences citing the same source characters on a side are one occurrence listed twice;
    // counting both would let the list back a count the documents do not hold (r4416805143).
    for (const side of ["left", "right"] as const) {
      const owner = new Map<string, number>();
      let shared = false;
      d.occurrences.forEach((o, i) => {
        for (const l of o[side])
          for (const c of l.charIds) {
            const k = `${l.pageIndex}\u0000${c}`;
            if ((owner.get(k) ?? i) !== i) shared = true;
            else owner.set(k, i);
          }
      });
      if (shared) faults.push(`card ${d.id} lists the same source characters in two occurrences on the ${side} side`);
    }
    // A repeated line's counts: the two documents' page counts, and on each side the occurrences of
    // the card's own text it cites; other variants it cites there are context, not counted (whether
    // a document holds further, uncited occurrences is not checked).
    if (
      d.repeat &&
      (d.repeat.leftPages !== docs[0].pages.length ||
        d.repeat.rightPages !== docs[1].pages.length ||
        d.repeat.left !== ownOccurrences(d, "left", docs).length ||
        d.repeat.right !== ownOccurrences(d, "right", docs).length)
    )
      faults.push(`card ${d.id} states occurrence or page counts that differ from the documents' page counts or from the occurrences of its own text it cites`);
    // An occurrence marked as context is the same line with another text; the mark is a claim.
    if (d.repeat) {
      const own = new Set([...ownOccurrences(d, "left", docs), ...ownOccurrences(d, "right", docs)]);
      if (d.occurrences.some((o) => o.context && own.has(o)))
        faults.push(`card ${d.id} marks an occurrence of its own text as context`);
      // The text a card shows on a side is one of the occurrences it counts there.
      for (const side of ["left", "right"] as const) {
        const counted = ownOccurrences(d, side, docs).flatMap((o) => o[side]);
        if ((side === "left" ? d.left : d.right).some((l) => !counted.some((c) => sameLocation(l, c))))
          faults.push(`card ${d.id} shows its own text on the ${side} side outside the occurrences it counts there`);
      }
    }
  }
  const required = expected.required_status;
  const completeness =
    required === "partial_or_explicit_review"
      ? result.status === "partial" &&
        result.unresolved.some((u) => u.reason === "ambiguous_identity")
      : result.status === required;
  if (!completeness) faults.push("Wrong global completeness state");
  // The answer's fixed sets of repeated generated text (R16, R24). Every card reporting such a text
  // (an occurrence on one of the set's runs) must cite exactly the set's runs on each side and state
  // its counts, and one of them must be visible. The form is free: a text may be split over several
  // cards. Only these sets are checked for completeness; other repeat counts are checked within the
  // card's own citations.
  const repeatedText = (expected.repeated_text_requirements ?? []).map((req): RepeatedTextScore => {
    const sides = ["left", "right"] as const;
    const runs = { left: req.occurrences.before, right: req.occurrences.after };
    const pages = { left: layout.before.pages, right: layout.after.pages };
    // A card reports the set on a side when the occurrences of its own text there lie on the set's
    // runs; what it cites there of another variant is context.
    const own = (d: Difference, s: "left" | "right") => ownOccurrences(d, s, docs).flatMap((o) => o[s]);
    const reports = (d: Difference, s: "left" | "right") => located(own(d, s), runs[s], pages[s], s);
    const reporting = result.differences.filter((d) => !unsourced.has(d.id) && d.repeat && sides.some((s) => reports(d, s)));
    const problems: string[] = [];
    if (!reporting.length) problems.push("no card reports its occurrence counts");
    else if (!reporting.some((d) => d.defaultVisible)) problems.push("no card reporting it is visible");
    for (const d of reporting) {
      // A side is left out only where the card states another text: its own text there is not
      // empty and differs from its text on the other side. Where it shows nothing or the same text,
      // its occurrences and count there are statements about the set.
      const texts = { left: ownText(d, "left", docs), right: ownText(d, "right", docs) };
      const other = texts.left !== "" && texts.right !== "" && texts.left !== texts.right;
      const checked = sides.filter((s) => reports(d, s) || !other);
      for (const s of checked) {
        const locs = own(d, s);
        if (locs.some((l) => !located([l], runs[s], pages[s], s)))
          problems.push(`card ${d.id} cites an occurrence outside the set on the ${s} side`);
        if (runs[s].some((r) => !located(locs, [r], pages[s], s)))
          problems.push(`card ${d.id} leaves out an occurrence of the set on the ${s} side`);
      }
      const counts = { left: req.counts.before, right: req.counts.after };
      if (checked.some((s) => d.repeat![s] !== counts[s]))
        problems.push(`card ${d.id} states ${d.repeat!.left} -> ${d.repeat!.right} occurrences; the set has ${req.counts.before} -> ${req.counts.after}`);
    }
    faults.push(...problems.map((p) => `repeated text ${req.requirement_id}: ${p}`));
    return { requirementId: req.requirement_id, pass: !problems.length, cards: reporting.map((d) => d.id), problems };
  });
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
        attribution: findings,
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
    const refs = expected.evidence_locations[e.event_id];
    const rule = identityRule(e, expected.invariants, layout);
    const claimOf = (d: Difference) => rule.claim?.(d) ?? null;
    const at = (d: Difference, side: "left" | "right") =>
      side === "left"
        ? located(d.left, refs.before, layout.before.pages, "left")
        : located(d.right, refs.after, layout.after.pages, "right");
    // A delete (insert) operation of the card on the event's before (after) runs.
    const on = (d: Difference, kind: "delete" | "insert") =>
      d.textOps.some((op) =>
        op.kind === kind &&
        (kind === "delete"
          ? e.old !== null && located(op.left, refs.before, layout.before.pages, "left")
          : e.new !== null && located(op.right, refs.after, layout.after.pages, "right")),
      );
    // A card belongs to the event by its edit sources: each kind of change it makes has an operation
    // on the event's runs (a move without a text change, by its located sides). Its record, party or
    // field labels are claims, judged separately.
    const sourced = (d: Difference) => {
      const kinds = [...new Set(d.textOps.filter((o) => o.kind !== "equal").map((o) => o.kind))];
      return (
        (e.operation === "move" && !changes(d)) ||
        (kinds.length > 0 && kinds.every((k) => on(d, k as "delete" | "insert")))
      );
    };
    // The text the event needs on a side; an empty side (a pure insertion or deletion) needs none.
    const needs = (side: "left" | "right") => clean((side === "left" ? e.old : e.new) ?? "") !== "";
    // The part of the old (new) text the event changes: what remains after the common start and end
    // of both, as [from, to) in the folded text. An old text kept whole inside the new one (text
    // appended or inserted) has no changed part on the old side.
    const changed = (() => {
      const [o, n] = [Array.from(clean(e.old ?? "")), Array.from(clean(e.new ?? ""))];
      let p = 0;
      while (p < Math.min(o.length, n.length) && o[p] === n[p]) p++;
      let q = 0;
      while (q < Math.min(o.length, n.length) - p && o[o.length - 1 - q] === n[n.length - 1 - q]) q++;
      return { left: [p, o.length - q], right: [p, n.length - q] } as Record<"left" | "right", [number, number]>;
    })();
    // Where the card itself carries the event's old (new) text: each occurrence in the card's old (new)
    // text (whitespace folded as in clean(), a number only as a whole number), and for it:
    // - own: each character comes from a location on the event's before (after) runs;
    // - ordered: the characters follow one another in the source as in the card, so no reordered,
    //   repeated or skipped text; a space in the card stands for whitespace or a line break there;
    // - edit: a character of the part the event changes is the card's own deletion (insertion) there.
    //   An edit of whitespace alone, or elsewhere in the occurrence, does not show that change.
    const spots = (d: Difference, side: "left" | "right") => {
      const text = (side === "left" ? e.old : e.new)!;
      const other = side === "left" ? "insert" : "delete";
      const source = order[side === "left" ? 0 : 1];
      const onRuns = (l: SourceLocation) =>
        side === "left"
          ? located([l], refs.before, layout.before.pages, "left")
          : located([l], refs.after, layout.after.pages, "right");
      // The side's text by character, each with the index of its operation, the source position it
      // comes from and whether that position's location lies on the event's runs. An operation's text
      // is its locations' texts in order (whitespace aside, checked against the sources above).
      // `off` is the character's place in its operation's text, shared by both sides of an equal one.
      const chars: { c: string; i: number; off: number; own: boolean; key: string | null }[] = [];
      d.textOps.forEach((op, i) => {
        if (op.kind === other) return;
        const from = (side === "left" ? op.left : op.right).flatMap((l) => {
          const on = onRuns(l);
          return source.keys(l).map((key) => ({ on, key }));
        });
        let k = 0;
        Array.from(op.text).forEach((c, off) => {
          if (!/\s/u.test(c)) {
            const at = from[k++];
            chars.push({ c, i, off, own: at?.on ?? false, key: at?.key ?? null });
          } else if (chars.length && chars.at(-1)!.c !== " ") chars.push({ c: " ", i, off, own: true, key: null });
        });
      });
      if (chars.at(-1)?.c === " ") chars.pop();
      const needle = Array.from(clean(text));
      const digit = (i: number) => /\p{Nd}/u.test(chars[i]?.c ?? "");
      const inNumber = (i: number) => digit(i) || (/^[.,]$/.test(chars[i]?.c ?? "") && digit(i - 1) && digit(i + 1));
      const whole = (p: number) =>
        !(digit(p) && inNumber(p - 1)) && !(digit(p + needle.length - 1) && inNumber(p + needle.length));
      const ordered = (span: typeof chars) => {
        const solid = span.filter((x) => x.c !== " ");
        // A number at either end is whole in the source too, not cut out of a longer one.
        const [first, last] = [solid[0], solid.at(-1)!];
        if (first.key === null || last.key === null) return false;
        if (/\p{Nd}/u.test(first.c) && source.continuesNumber(first.key, source.prev)) return false;
        if (/\p{Nd}/u.test(last.c) && source.continuesNumber(last.key, source.next)) return false;
        return span.every((x, j) => {
          if (x.c === " ") return true;
          const y = span.slice(j + 1).find((z) => z.c !== " ");
          if (!y) return true;
          const next = x.key === null ? null : source.next(x.key);
          const spaced = span[j + 1].c === " ";
          return next !== null && next.key === y.key && (spaced ? next.gap !== "none" : next.gap !== "space");
        });
      };
      const kind = side === "left" ? "delete" : "insert";
      const [from, to] = changed[side];
      const found: { span: typeof chars; own: boolean; ordered: boolean; edit: boolean }[] = [];
      for (let p = 0; needle.length && p + needle.length <= chars.length; p++)
        if (needle.every((c, j) => chars[p + j].c === c) && whole(p)) {
          const span = chars.slice(p, p + needle.length);
          // A character of the occurrence that the card itself deletes (inserts). Which copy of a
          // repeated word or digit the card marks is its alignment, so the edit may lie anywhere in
          // the occurrence; whether the two occurrences belong together is lined() below. A change
          // of whitespace alone (nothing else in the changed part) is shown by an edit of the card on
          // the event's runs within the occurrence; otherwise an edit of whitespace is not the change.
          const edit = span.slice(from, to).some((x) => x.c !== " ")
            ? span.some((x) => x.c !== " " && x.own && d.textOps[x.i].kind === kind)
            : d.textOps
                .slice(span[0].i, span.at(-1)!.i + 1)
                .some((o) => o.kind === kind && onRunsOp(o));
          found.push({ span, own: span.every((x) => x.own), ordered: ordered(span), edit });
        }
      return found;
    };
    // On one card the old and the new occurrence line up in the card's edit: where the card keeps
    // what the event keeps (each side's text outside the part the event changes there), it pairs it
    // with the other occurrence; and no text the card keeps lies between the two occurrences outside
    // them. So the old text paired with other new text, and the new text with other old text, is not
    // the event's change.
    type Span = ReturnType<typeof spots>[number]["span"];
    const lined = (d: Difference, l: Span, r: Span) => {
      const place = (x: Span[number]) => `${x.i}:${x.off}`;
      const solid = { left: l.filter((x) => x.c !== " "), right: r.filter((x) => x.c !== " ") };
      const held = { left: new Set(solid.left.map(place)), right: new Set(solid.right.map(place)) };
      for (const [span, side, other] of [[l, "left", "right"], [r, "right", "left"]] as const) {
        const [from, to] = changed[side];
        const kept = [...span.slice(0, from), ...span.slice(to)].filter((x) => x.c !== " " && d.textOps[x.i].kind === "equal");
        if (kept.some((x) => !held[other].has(place(x)))) return false;
      }
      const all = [...solid.left, ...solid.right];
      const before = (a: Span[number], b: Span[number]) => a.i < b.i || (a.i === b.i && a.off < b.off);
      const [lo, hi] = all.reduce(([a, b], x) => [before(x, a) ? x : a, before(b, x) ? x : b], [all[0], all[0]]);
      for (let i = lo.i; i <= hi.i; i++) {
        if (d.textOps[i].kind !== "equal") continue;
        const between = Array.from(d.textOps[i].text).some((c, off) => {
          const x = { c, i, off, own: true, key: null };
          return !/\s/u.test(c) && before(lo, x) && before(x, hi) && !held.left.has(place(x)) && !held.right.has(place(x));
        });
        if (between) return false;
      }
      return true;
    };
    const onRunsOp = (o: Difference["textOps"][number]) =>
      o.kind === "delete"
        ? located(o.left, refs.before, layout.before.pages, "left")
        : located(o.right, refs.after, layout.after.pages, "right");
    // The card shows the event at the event's own text, not with the same text from elsewhere in the
    // card (another unit kept as context, another unchanged occurrence, characters from elsewhere in
    // the run, or paired across units): the old and the new text each occur on the event's runs in the
    // source's order; on each side the event changes, that occurrence holds the card's own edit; and
    // with text on both sides, the two occurrences line up in the card's edit. A move changes no
    // text, so it has no edit to carry, but its text is still shown where it is; an event with no
    // text on either side shows nothing.
    const carried = (d: Difference) => {
      if (!needs("left") && !needs("right")) return false;
      const [l, r] = (["left", "right"] as const).map((side) => {
        if (!needs(side)) return null;
        const [from, to] = changed[side];
        return spots(d, side).filter((s) => s.own && s.ordered && (to <= from || s.edit));
      });
      if (l === null || r === null) return (l ?? r)!.length > 0;
      return l.some((a) => r.some((b) => lined(d, a.span, b.span)));
    };
    const candidates = result.differences.filter(
      (d) =>
        (e.old === null || clean(d.oldText).includes(clean(e.old))) &&
        (e.new === null || clean(d.newText).includes(clean(e.new))) &&
        (e.old !== null || d.kind === "Added") &&
        (e.new !== null || d.kind === "Removed"),
    );
    const single = candidates.filter(
      (d) =>
        e.acceptable_kinds.includes(d.kind) &&
        (e.old === null || at(d, "left")) &&
        (e.new === null || at(d, "right")) &&
        sourced(d) &&
        carried(d),
    );
    // Added+Removed, where the answer allows it: Removed cards deleting the old text on the event's
    // before runs and Added cards inserting the new text on its after runs (the same record and field
    // by source); together they show the event once, however many cards repeat a half.
    const halves =
      e.acceptable_kinds.includes("Added+Removed") && e.old !== null && e.new !== null
        ? ([
            ["Removed", "left", "delete", e.old],
            ["Added", "right", "insert", e.new],
          ] as const).map(([kind, side, op, text]) =>
            result.differences.filter(
              (d) =>
                d.kind === kind &&
                clean(side === "left" ? d.oldText : d.newText).includes(clean(text)) &&
                at(d, side) &&
                on(d, op) &&
                spots(d, side).some((s) => s.own && s.ordered && s.edit),
            ),
          )
        : [[], []];
    const pair = halves[0].length && halves[1].length ? [...halves[0], ...halves[1]] : null;
    const groups = [...single.map((d) => [d]), ...(pair ? [pair] : [])];
    const attributed = groups.flat();
    const discovery = candidates.length > 0 || pair !== null;
    const attribution = groups.length > 0;
    const visibility = groups.some((g) => g.every((d) => d.defaultVisible));
    // Claims of the attributed cards: a wrong identity or a stated fact its sources disprove is a
    // false claim, whatever else the card shows. Format 2 has no category; the answer's old
    // acceptable_categories are not checked.
    const claims = attributed.map(claimOf).filter((c): c is IdentityClaim => c !== null);
    const falseFacts = attributed.flatMap((d) =>
      d.facts.filter((f) => factHolds(f, d, docs) === false).map((f) => `${d.id}: ${f}`),
    );
    const presented = groups.some((g) =>
      g.every((d) => d.defaultVisible && (rule.claim === null || rule.accepts.includes(rule.claim(d)))),
    );
    const fine = (d: Difference) => {
      const locations = changes(d)
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
    };
    const position =
      attribution && (!requireFineGeometry || groups.some((g) => g.every(fine)));
    // A failed check or a false claim is a proven product fault; otherwise a missing identity check
    // leaves the event unjudged.
    const verdict: CaseStatus = !(
      discovery &&
      attribution &&
      position &&
      visibility &&
      completeness &&
      presented &&
      !claims.includes("wrong") &&
      !falseFacts.length
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
      attribution,
      representation: single.length ? "card" : pair ? "delete+add" : null,
      position,
      visibility,
      completeness,
      identity: (() => {
        const pass = rule.claim ? attribution && presented && !claims.includes("wrong") : null,
          determined = rule.claim
            ? groups.some((g) => g.every((d) => claimOf(d) === "determined")) && !claims.includes("wrong")
            : null;
        return {
          applicability: rule.applicability,
          pass,
          determined,
          claims,
          outcome: !rule.claim || !attribution
            ? null
            : claims.includes("wrong")
              ? "wrong_statement"
              : determined
                ? "determined"
                : pass
                  ? "presented_unresolved"
                  : "requirement_unmet",
          reason: rule.reason,
        };
      })(),
      falseFacts,
      pass: verdict === "PASS",
      ...(verdict === "NOT_EVALUATED" ? { reason: rule.reason } : {}),
    };
  });
  const notEvaluated: NotEvaluated[] = [
    ...events
      .filter((ev) => ev.verdict === "NOT_EVALUATED")
      .map((ev): NotEvaluated => ({
        eventId: ev.eventId,
        kind: ev.branch === "unknown" ? "unknown_detection_branch" : "identity_unsupported",
        reason: ev.reason ?? "",
      })),
    ...claimsOpen,
  ];
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
    const checked = DIRECT[name]({ result, expected, layout, docs, unsourced });
    const { violations, open } = Array.isArray(checked) ? { violations: checked, open: [] } : checked;
    faults.push(...violations.map((v) => name + ": " + v));
    if (!violations.length && open.length) {
      notEvaluated.push({ invariant: name, kind: "invariant_unverifiable", reason: open.join("; ") });
      return { name, coverage: "direct", result: "NOT_EVALUATED", reason: open.join("; ") };
    }
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
    repeatedText,
  };
}
