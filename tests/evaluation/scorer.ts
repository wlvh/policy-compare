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
    | "invariant_unverifiable";
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
  // The edit sources of a card (or of an allowed delete + add pair) lie on the event's runs.
  attribution?: boolean;
  representation?: "card" | "delete+add" | null;
  position?: boolean;
  visibility?: boolean;
  completeness?: boolean;
  identity: IdentityCheck | null;
  // Category claims of the attributed cards that the answer does not allow for the event.
  falseCategoryClaims?: string[];
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
    // Migrated in round 18 from "no Material card and no text change outside Cosmetic".
    basis:
      "every source-validated text change is a declared event (one card per event, matching its whole text, kind, sides, identity, visibility and every source location); an undeclared change presented as content (Material, Review, RollForward) fails; one presented as form-only (Cosmetic) is NOT_EVALUATED, as no declared definition of form-only transforms can verify it; a card that fails source validation fails; a card without a text change is not judged here",
    tests: [
      "Review does not excuse false text in control",
      "a Cosmetic label does not turn an undeclared text change in a control into PASS",
      "a card that fails source validation cannot show that a control holds",
      "R16",
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
    basis: "no card pairs or adds/removes amounts or currencies beyond the case's events; the bare value of every layout.json amount cell a card cites, at any granularity, counts (on a card that declares an amount field, every run it cites is an amount cell) (the amount or currency text a card's delete/insert operations assert in each cell, joined in its own citation order across locations, operations and a record's delete/add cards, must not change inside cells that keep their values; in a currency cell, letters outside every whole token, such as part of a code, are claimed text too; two delete or two add edits citing the same source characters of such a cell report one edit twice and fail); delete/add amounts cancel only within one record and field (across cards without a record, bare digits outside every layout run, run-level geometry changing an amount cell together with other cells, claims on several amount (or currency) cells of one side, part of a code included, whose correspondence a multiset cannot show, a record whose delete/add values balance only once a cell cited by several cards counts once, claims that differ only in letters inside an amount cell that form no whole amount or currency code, or a delete/add group whose values fail to balance only by cells split over several of its cards while its joined claims agree: NOT_EVALUATED)",
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
      "R26: row-wide locations that layout.json does not cover are NOT_EVALUATED",
    ],
  },
  no_amount_or_currency_change: {
    coverage: "direct",
    basis: "no card pairs or adds/removes amounts or currencies beyond the case's events; the bare value of every layout.json amount cell a card cites, at any granularity, counts (on a card that declares an amount field, every run it cites is an amount cell) (the amount or currency text a card's delete/insert operations assert in each cell, joined in its own citation order across locations, operations and a record's delete/add cards, must not change inside cells that keep their values; in a currency cell, letters outside every whole token, such as part of a code, are claimed text too; two delete or two add edits citing the same source characters of such a cell report one edit twice and fail); delete/add amounts cancel only within one record and field (across cards without a record, bare digits outside every layout run, run-level geometry changing an amount cell together with other cells, claims on several amount (or currency) cells of one side, part of a code included, whose correspondence a multiset cannot show, a record whose delete/add values balance only once a cell cited by several cards counts once, claims that differ only in letters inside an amount cell that form no whole amount or currency code, or a delete/add group whose values fail to balance only by cells split over several of its cards while its joined claims agree: NOT_EVALUATED)",
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
    basis: "the registration event's card (or one delete + one add card) must lie on the record's registration cells by its edit sources; its row key must be the declared serial, or an explicit identity review (row key null, confidence unresolved), which is presented but not determined; the renamed registration or another record's key is a false identity claim and fails",
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
// limit), or in a card location on a layout.json run whose logical path ends in such a field, any
// standalone number counts too. The layout says what a cell is whatever field the card claims;
// identifiers such as an MSN stay out.
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
// Delete and add cards cancel only within one record and field; amounts that cancel only across
// cards showing no record cannot be verified either way.
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
      edited: string[] = [];
    // Each claimed character is also kept by its source identity, to tell one edit reported twice
    // from complementary pieces of a cell.
    const claim = (key: string, t: string, r: LayoutRun, ids: (string | undefined)[], page: number) => {
      claimed.set(key, (claimed.get(key) ?? "") + t);
      cellText.set(key, r.text);
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
      for (const r of hits.flat()) if (amountRun(r)) cells.set(`${loc.pageIndex}/${r.run_id}`, r.text);
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
      edit: { id: d.id, cellText, edited },
    };
  };
  // Claimed amounts per cell; claims of several cards on one cell join in card order.
  const merge = (into: Map<string, string>, from: Map<string, string>) => {
    for (const [k, t] of from) into.set(k, (into.get(k) ?? "") + t);
  };
  // Letters or digits a claim holds outside every amount or currency token, such as the "U" of "USD".
  const rest = (t: string) => t.replace(DECLARED_AMOUNT, " ").replace(CURRENCY, " ").replace(/[^\p{L}\p{N}]+/gu, "");
  // In a currency cell they are part of a code, so they count as claimed text.
  const tokens = (m: Map<string, string>) =>
    [...m].flatMap(([key, t]) => [...money(t, true), ...(key.endsWith(":code") && rest(t) ? [rest(t)] : [])]);
  // In an amount cell they may be part of a code or wording such as "each loss": when only they
  // differ between the sides, the claim is not verified either way.
  const partial = (L: Map<string, string>, R: Map<string, string>) => {
    const of = (m: Map<string, string>) => [...m].filter(([key]) => key.endsWith(":value")).map(([, t]) => rest(t)).filter(Boolean);
    return minus(of(L), of(R)).length > 0 || minus(of(R), of(L)).length > 0;
  };
  // Claims on several amount (or several currency) cells of one side are compared as a multiset, so
  // which cell corresponds to which is not verified: when they match only that way, it stays open.
  // A cell counts when its claim holds a token, or letters outside every token in a layout.json
  // currency or amount cell (part of a code).
  const severalCells = (m: Map<string, string>) =>
    ["amount:", "currency:"].some(
      (k) =>
        [...m].filter(([key, t]) => key.startsWith(k) && (money(t, true).length || (/:(code|value)$/.test(key) && rest(t)))).length > 1,
    );
  const allowed = (r: string[], a: string[]) =>
    !minus(r, removed).length && !minus(a, added).length;
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
    return {
      split: [...byCell].filter(([, ids]) => ids.size > 1).flatMap(([k]) => money(text.get(k)!, true)),
      twice: [...byChar.values()].filter((ids) => ids.length > 1).map((ids) => [...new Set(ids)].join(" and ")),
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
      rc = minus(tokens(L.claimed), tokens(R.claimed)),
      ac = minus(tokens(R.claimed), tokens(L.claimed));
    if ((r.length || a.length) && !allowed(r, a))
      out.push(`card ${d.id} changes ${r.join(",") || "-"} to ${a.join(",") || "-"}`);
    // The cited cells keep their values, yet the card's operations assert a change inside them.
    else if (!r.length && !a.length && (rc.length || ac.length))
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
    goneEdits: [] as Edit[],
    comeEdits: [] as Edit[],
  });
  const pool = group(),
    records = new Map<string, typeof pool>();
  for (const d of result.differences.filter((d) => d.kind === "Removed" || d.kind === "Added")) {
    const who = d.structurePath?.rowKey ?? d.structurePath?.entity,
      key = who + "|" + (d.structurePath?.field ?? "");
    const g = who ? (records.get(key) ?? records.set(key, group()).get(key)!) : pool;
    const removed = d.kind === "Removed",
      m = cardMoney(d, removed ? "left" : "right");
    (removed ? g.gone : g.come).push(...m.all);
    merge(removed ? g.goneClaimed : g.comeClaimed, m.claimed);
    (removed ? g.goneText : g.comeText).push(...m.textTokens);
    for (const [k, t] of m.cells) (removed ? g.goneCells : g.comeCells).set(k, t);
    (removed ? g.goneEdits : g.comeEdits).push(m.edit);
  }
  for (const [key, g] of records) {
    // Within a record, a source cell that several cards of one side cite counts once; the per-card
    // sums (g.gone / g.come) only tell whether that alone made the values balance.
    const gone = [...g.goneText, ...[...g.goneCells.values()].flatMap(bare)],
      come = [...g.comeText, ...[...g.comeCells.values()].flatMap(bare)];
    const r = minus(gone, come),
      a = minus(come, gone),
      rc = minus(tokens(g.goneClaimed), tokens(g.comeClaimed)),
      ac = minus(tokens(g.comeClaimed), tokens(g.goneClaimed));
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
      // The record's cells cancel, yet its delete and add cards assert different amount text.
      if (!r.length && !a.length && (rc.length || ac.length))
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
    rc = minus(tokens(pool.goneClaimed), tokens(pool.comeClaimed)),
    ac = minus(tokens(pool.comeClaimed), tokens(pool.goneClaimed));
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
  else if (!r.length && !a.length && (rc.length || ac.length))
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
  // Migrated from "no Material card and no text change outside Cosmetic": the control declares no
  // edit beyond its events, so every source-validated text change must be a declared event. A
  // category does not excuse a change. An undeclared change the card presents as content (Material,
  // Review, RollForward) is false either way: a form-only change claimed as content, or a content
  // change the control does not have. One it presents as form-only (Cosmetic) is false only if the
  // change is not form-only, and no shared, declared definition of form-only transforms exists to
  // verify that: NOT_EVALUATED. A card without a text change is not an edit here; moves and extra
  // cards are judged by the case's move and content invariants.
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
    const undeclared = result.differences.filter((d) => !unsourced.has(d.id) && changes(d) && !excused(d));
    const violations = [
      ...unbacked(c),
      ...(undeclared.some((d) => d.category !== "Cosmetic")
        ? ["False substantive change; Review is not an exemption"]
        : []),
    ];
    return {
      violations,
      open: undeclared
        .filter((d) => d.category === "Cosmetic")
        .map(
          (d) =>
            `card ${d.id} presents an undeclared text change as form-only; no declared definition of form-only transforms can verify it`,
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
  agreed_value_unchanged: ({ result, expected, layout }) => moneyChanges(result, expected, layout),
  no_amount_or_currency_change: ({ result, expected, layout }) => moneyChanges(result, expected, layout),
};
// Process exit: 0 strict PASS, 2 only registered coverage gaps, 1 any failure or unregistered gap.
export const exitCode = (s: ReturnType<typeof summarize>) =>
  s.status === "PASS" ? 0 : s.knownGapsOnly ? 2 : 1;
// What a card says about the record or party of its change. Where the change belongs is decided by
// its edit sources (the event check); these values only judge the card's outward claim. "determined"
// names an identity the answer accepts, "unresolved" is an explicit open identity (row key null,
// confidence unresolved), "absent" names none, and "wrong" names another identity: only "wrong" is a
// false claim, and a missing or unresolved identity counts only where the answer allows it.
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
  const open = (d: Difference) =>
    d.structurePath?.confidence === "unresolved" && d.structurePath.rowKey === null;
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
        return p.entity === entity && p.field === field ? "determined" : open(d) ? "unresolved" : "absent";
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
        return p.rowKey !== null && p.field === field ? "determined" : open(d) ? "unresolved" : "absent";
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
// What a card's category asserts as a fact, against the forms the answer allows for the event.
// Cosmetic asserts a form-only change and RollForward a one-year roll-forward of the dates; Material
// and Review both assert a content change, and their importance is not judged.
const categoryAllowed = (d: Difference, e: Expected["events"][number]) =>
  d.category === "Cosmetic" || d.category === "RollForward"
    ? e.acceptable_categories.includes(d.category)
    : e.acceptable_categories.some((c) => c === "Material" || c === "Review");
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
    // Identity claims of the checked events: determined, presented as an allowed explicit review,
    // or not presented as required (wrong claims are listed separately as well).
    identityClaims: {
      determined: by((e) => e.identity?.determined === true),
      presentedUnresolved: by((e) => e.identity?.pass === true && e.identity.determined === false),
      notPresented: by((e) => e.identity?.pass === false),
      wrong: by((e) => e.identity?.claims?.includes("wrong") ?? false),
    },
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
// Its category is judged by the event check, not here: the case, a title style or a category never
// excuse a card.
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
  // Cards whose texts or locations fail source validation: their text cannot show that a control holds.
  const unsourced = new Set<string>();
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
    if (faults.length > before) unsourced.add(d.id);
    // hasTextChange means the two raw texts differ; a flag that says otherwise is a false claim.
    else if (d.hasTextChange !== changes(d))
      faults.push("hasTextChange contradicts the card's source-validated texts: " + d.id);
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
        sourced(d),
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
                on(d, op),
            ),
          )
        : [[], []];
    const pair = halves[0].length && halves[1].length ? [...halves[0], ...halves[1]] : null;
    const groups = [...single.map((d) => [d]), ...(pair ? [pair] : [])];
    const attributed = groups.flat();
    const discovery = candidates.length > 0 || pair !== null;
    const attribution = groups.length > 0;
    const visibility = groups.some((g) => g.every((d) => d.defaultVisible));
    // Claims of the attributed cards: a wrong identity or a category the answer does not allow for
    // the event is a false claim, whatever else the card shows.
    const claims = attributed.map(claimOf).filter((c): c is IdentityClaim => c !== null);
    const falseCategoryClaims = attributed
      .filter((d) => !categoryAllowed(d, e))
      .map((d) => `${d.id}: ${d.category}`);
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
      !falseCategoryClaims.length
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
      identity: {
        applicability: rule.applicability,
        pass: rule.claim ? attribution && presented && !claims.includes("wrong") : null,
        determined: rule.claim
          ? groups.some((g) => g.every((d) => claimOf(d) === "determined")) && !claims.includes("wrong")
          : null,
        claims,
        reason: rule.reason,
      },
      falseCategoryClaims,
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
  };
}
