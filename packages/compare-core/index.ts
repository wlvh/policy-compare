import {
  VERSION,
  RESULT_VERSION,
  digest,
  snapshotDigest,
  type CompareResultV2 as CompareResult,
  type DifferenceV2 as Difference,
  type DocInput,
  type Fact,
  type SourceLocation,
} from "../contracts/index";
import { aviationProfile, type Profile } from "../../profiles/aviation";
import {
  furnitureVariant,
  furnitureSignatures,
  maskedPageNumbers,
  structure,
  withoutPageNumbers,
  withoutFurniturePages,
  type Furniture,
  type Unit,
} from "./structure";
import { normalize, sourceLocations, tokenize, lcsLength } from "./text";
import { monotone, jointAlign } from "./alignment";
export { structure } from "./structure";
export type Budget = Profile["budget"];
type Pair = { a: Unit; b: Unit; method: string; score: number | null };
/**
 * An aggregate of repeated occurrences. `repeats` are the card's occurrences
 * on its side, the ones its count is; `others` are occurrences of the same
 * repeated line on that side with another text, listed as context and not
 * counted; `separate` lists both sides' occurrences one by one instead of side
 * by side; `note` explains a version whose text varies.
 */
type Repeated = Unit & {
  repeats?: Unit[];
  others?: Unit[];
  separate?: boolean;
  note?: string;
};
const variant = (u: Unit) =>
  u.furniture
    ? furnitureVariant(u.rawText, u.furniture, u.refs.find(Boolean)!.page.pageIndex + 1)
    : u.rawText;
const locations = (u: Unit | undefined, side: "left" | "right") =>
  u ? sourceLocations(u.refs, side, u.id) : [];

function aggregate(units: Unit[], id: string, ambiguous = false): Unit {
  const refs = units.flatMap((u, i) => (i ? [null, ...u.refs] : u.refs));
  return {
    ...units[0],
    ...normalize(units.map((u) => u.rawText).join(" "), refs),
    id,
    identity: ambiguous ? null : units[0].identity,
    path: {
      ...units[0].path,
      confidence: ambiguous ? "unresolved" : units[0].path.confidence,
      rowKey: ambiguous ? null : units[0].path.rowKey,
      entity: ambiguous ? null : units[0].path.entity,
    },
  };
}
function tablePairs(
  left: Unit[],
  right: Unit[],
  pairs: Pair[],
  usedL: Set<Unit>,
  usedR: Set<Unit>,
  result: CompareResult,
) {
  const rows = (us: Unit[]) => {
    const m = new Map<string, Unit[]>();
    for (const u of us.filter((u) => u.role === "cell")) {
      const v = m.get(u.tableRow!) ?? [];
      v.push(u);
      m.set(u.tableRow!, v);
    }
    return [...m.values()];
  };
  const a = rows(left),
    b = rows(right);
  const doneA = new Set<Unit[]>(),
    doneB = new Set<Unit[]>();
  const unique = (
    rs: Unit[][],
    key: "primary" | "secondary",
    v: string | undefined,
  ) => (v ? rs.filter((r) => r[0][key] === v) : []);
  for (const row of a) {
    const p = unique(b, "primary", row[0].primary),
      s = unique(b, "secondary", row[0].secondary);
    const ownP = unique(a, "primary", row[0].primary),
      ownS = unique(a, "secondary", row[0].secondary);
    if (p.length === 1 && s.length === 1 && p[0] !== s[0]) continue;
    const other =
      ownP.length === 1 && p.length === 1
        ? p[0]
        : ownS.length === 1 && s.length === 1
          ? s[0]
          : undefined;
    if (!other || doneB.has(other)) continue;
    doneA.add(row);
    doneB.add(other);
    for (const u of row) {
      const v = other.find((x) => x.path.field === u.path.field);
      if (v) {
        u.path.confidence = v.path.confidence = "reliable";
        pairs.push({ a: u, b: v, method: "declared-table-key", score: null });
        usedL.add(u);
        usedR.add(v);
      }
    }
  }
  const ra = a.filter((r) => !doneA.has(r)),
    rb = b.filter((r) => !doneB.has(r));
  const duplicate =
    ra.some(
      (r) =>
        unique(a, "primary", r[0].primary).length > 1 ||
        unique(a, "secondary", r[0].secondary).length > 1,
    ) ||
    rb.some(
      (r) =>
        unique(b, "primary", r[0].primary).length > 1 ||
        unique(b, "secondary", r[0].secondary).length > 1,
    );
  if (ra.length && rb.length) {
    const fields = [...new Set(ra.flat().map((u) => u.path.field))];
    for (const field of fields) {
      const aa = ra.flat().filter((u) => u.path.field === field),
        bb = rb.flat().filter((u) => u.path.field === field);
      if (!aa.length || !bb.length) continue;
      const x = aggregate(aa, `ambiguous-left-${field}`, true),
        y = aggregate(bb, `ambiguous-right-${field}`, true);
      pairs.push({ a: x, b: y, method: "unresolved-table-group", score: null });
      aa.forEach((u) => usedL.add(u));
      bb.forEach((u) => usedR.add(u));
      result.unresolved.push({
        reason: "ambiguous_identity",
        message: duplicate
          ? "表格主键或次级键重复；金额变化仍展示，无法确定唯一实体"
          : "表格主次键冲突或缺少可靠对应",
        left: locations(x, "left"),
        right: locations(y, "right"),
        defaultVisible: true,
      });
    }
  }
  // Unmatched rows with unambiguous keys are additions/removals, not fuzzy text candidates.
}
const CURRENCY = "USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|CNY|RMB|HKD|SGD|INR|KRW|SEK|NOK|DKK|ZAR|BRL|MXN|AED|SAR";
// Amounts, shares and dates. A currency code counts as money next to a number,
// with or without a space (USD100000, 100000 JPY), so a registration such as
// VH-AUD is not taken for one; dates are written d/m/y, ISO y-m-d or with an
// English month name.
const VALUE = new RegExp(
  [
    "%",
    "\\d[.,]\\d",
    "\\p{Sc}",
    "\\b(?:USD|EUR|GBP)\\b",
    `(?<!\\p{L})(?:${CURRENCY})\\s*\\d`,
    `\\d\\s*(?:${CURRENCY})(?!\\p{L})`,
    "\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}",
    "\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b",
  ].join("|"),
  "u",
);
const MONTH_DATE = /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}\b/iu;
const valueLike = (cell: string) => VALUE.test(cell) || MONTH_DATE.test(cell);
/**
 * Names of a record's own identifier. A cell is identity evidence only when
 * its local column heading names one ("MSN", "Serial No.", "Registration",
 * "(Re)insurer") or the cell itself starts with one ("MSN 1"). A row number
 * ("No."), a model, a status, a name under another heading, an amount or a
 * date is never identity, however unique.
 */
const IDENTITY = "MSN|ESN|S\\/N|serial|registration|(?:re)?insurer";
// A column heading names an identifier when it ends with the label, possibly
// after a qualifier and before a number suffix ("Aircraft Registration",
// "Serial No."); "Registration Status" describes something else (r4417386686).
const identityHeading = new RegExp(`\\b(?:${IDENTITY})(?:\\s*(?:no\\.?|nr\\.?|number|#))?$`, "iu"),
  identityPrefix = new RegExp(`^(?:${IDENTITY})\\b`, "iu"),
  identityName = new RegExp(`^(?:${IDENTITY})(?:\\s*(?:no\\.?|nr\\.?|number|#))?$`, "iu");
/**
 * A row with a cell that is nothing but an identifier's name, possibly with a
 * number qualifier ("Registration", "Serial No.", r4417210539), names a column:
 * it is a heading row. A record's cells carry values ("Registration G-AAAA",
 * "Registration pending").
 */
const namesIdentity = (u: Unit) => u.rowCells!.some((c) => identityName.test(c.normalize("NFKC").trim()));
const namesColumn = (u: Unit) => u.rowCells!.some((c) => identityHeading.test(c.normalize("NFKC").trim()));
/**
 * A row that can head a table: digit-free, or with a cell that is an
 * identifier's name and no amount, percentage or date, so a year in another
 * column heading does not hide the identity columns ("Registration | Insurer
 * | 2026 Limit", r4418068282). A record with a value ("Reinsurer | 25%") is no
 * heading.
 */
const valueFree = (u: Unit) => !u.rowCells!.some((c) => valueLike(c.normalize("NFKC")));
const headingLike = (u: Unit) => !/\p{N}/u.test(u.rawText) || (namesIdentity(u) && valueFree(u));
/**
 * The heading row of each recovered row: the closest digit-free row above it
 * (or one that names an identifier and holds no value, see headingLike) in the
 * same section and title, with nothing but page margins in between.
 * Its table is that section, title and heading row, the row's cells and not
 * only its text: the same words divided into other cells head other columns
 * (MSN | Serial No. against MSN Serial | No., r4420146482). A heading row repeated on
 * a later page with only titles and page margins in between (a table continued
 * on the next page) continues it, and on the same page starts another table
 * (r4417493798). When either version has two or more tables with the same
 * section, title and heading row, nothing says which corresponds to which, so
 * each is a scope of its own; rows without a heading row share the scope of
 * their section and title. Only the digit-free row that starts a table (or
 * repeats its heading after a page break) is a heading; a later digit-free row
 * of the same unbroken table is one of its records (or a further heading line)
 * and keeps that table's scope, so a digit-free record can neither leave its
 * table through the shared scope, be taken for a repeated header, nor head the
 * rows below it. A later digit-free row with a cell that names an identifier
 * starts a table of its own (two tables with no text between them); one with
 * a cell that only ends with an identifier's name ends the table without
 * heading the rows after it, also with a year in another cell as long as no
 * cell holds a value (r4419250728); any other second heading line is not read.
 */
const cellKey = (u: Unit) => JSON.stringify(u.rowCells);
function rowHeadings(left: Unit[], right: Unit[]) {
  const headings = new Map<Unit, Unit>(),
    scopes = new Map<Unit, string>(),
    starts = new Set<Unit>();
  const sides = [left, right].map((us) => {
    const current = new Map<string, Unit>(),
      open = new Map<string, { text: string; key: string; n: number }>(),
      last = new Map<string, { text: string; n: number }>(),
      broken = new Set<string>(),
      closed = new Map<string, [string, number]>(),
      page = new Map<string, number>(),
      count = new Map<string, number>(),
      table = new Map<Unit, [string, number]>();
    for (const u of us) {
      if (!u.rowCells) {
        if (!["furniture", "page_heading", "footer", "whitespace"].includes(u.role)) {
          current.clear();
          open.clear();
          closed.clear();
        }
        if (!["furniture", "page_heading", "footer", "whitespace", "heading"].includes(u.role))
          for (const t of last.keys()) broken.add(t);
        continue;
      }
      const t = u.path.section + "\u0000" + u.title;
      const s = open.get(t),
        p = u.refs.find(Boolean)!.page.pageIndex,
        before = page.get(t);
      page.set(t, p);
      if ((!/\p{N}/u.test(u.rawText) || valueFree(u)) && s && cellKey(u) !== s.text && !namesIdentity(u) && namesColumn(u)) {
        // A cell ending with an identifier's name ("Aircraft Registration")
        // may head another table or be a record's value ("Pending
        // Registration"): the table ends here, and neither this row nor the
        // rows after it are read under its heading row or share its scope
        // (r4417587174). The rows after it are a scope of their own, without
        // a heading row, not the shared scope of the title (PR #9 comment
        // 6508226511).
        current.delete(t);
        open.delete(t);
        broken.add(t);
        const key = t + "\u0000" + cellKey(u),
          n = (count.get(key) ?? 0) + 1;
        count.set(key, n);
        closed.set(t, [key, n]);
        table.set(u, [key, n]);
        continue;
      }
      if (!/\p{N}/u.test(u.rawText) && s && cellKey(u) !== s.text && !namesIdentity(u)) {
        // A digit-free row inside a table another row started is one of its
        // records (G-AAAA | Alpha Air | Lead) or a further heading line: it
        // keeps that table's scope and is read under the table's heading row
        // (r4416942407); the rows below it keep that heading row too, never a
        // record's values (r4416878288).
        headings.set(u, current.get(t)!);
        table.set(u, [s.key, s.n]);
      } else if (headingLike(u)) {
        const prev = last.get(t),
          key = t + "\u0000" + cellKey(u);
        const n = prev && prev.text === cellKey(u) && !broken.has(t) && p > before! ? prev.n : (count.get(key) ?? 0) + 1;
        count.set(key, Math.max(n, count.get(key) ?? 0));
        last.set(t, { text: cellKey(u), n });
        broken.delete(t);
        current.set(t, u);
        open.set(t, { text: cellKey(u), key, n });
        closed.delete(t);
        starts.add(u);
        table.set(u, [key, n]);
      } else if (current.has(t)) {
        headings.set(u, current.get(t)!);
        table.set(u, [t + "\u0000" + cellKey(current.get(t)!), s!.n]);
      } else if (closed.has(t)) table.set(u, closed.get(t)!);
    }
    return { count, table };
  });
  sides.forEach(({ table }, side) => {
    for (const [u, [key, n]] of table)
      scopes.set(u, sides.every((x) => x.count.get(key) === 1) ? key : `${key}\u0000${side}\u0000${n}`);
  });
  return { headings, scopes, starts };
}
/**
 * Identity cells of a recovered row by the column they stand in: the heading
 * row's column (the heading cell the row's cell overlaps most), or for a cell
 * under no heading cell that names its identifier ("MSN 1") that name. A missing cell does not shift a
 * value into another column; two cells under one column say nothing about
 * either. A value-like cell under an identity heading (an amount, or a dotted
 * serial such as AB12.34) keeps its column: it links no rows (see
 * rowIdentity), but rows that differ in that column are not one record,
 * whichever of the two cells looks like a value (r4418369400, r4418461107).
 * The heading is read as NFKC, as namesIdentity does (Ｒｅｇｉｓｔｒａｔｉｏｎ).
 */
/** The heading cell a row's cell [x0, x1] overlaps most, or null under no heading cell. */
function under(h: Unit | undefined, [x0, x1]: [number, number]) {
  if (!h) return null;
  const overlap = h.rowSpans!.map(([a, b]) => Math.min(b, x1) - Math.max(a, x0)),
    j = overlap.indexOf(Math.max(...overlap));
  return overlap[j] > 0 ? { j, text: h.rowCells![j] } : null;
}
function identityCells(r: Unit, headings: Map<Unit, Unit>) {
  const h = headings.get(r);
  const heading = (k: number) => under(h, r.rowSpans![k]);
  const cells = r.rowCells!.flatMap((c0, k): [string, string][] => {
    const c = c0.normalize("NFKC"),
      at = heading(k),
      // S/N is a serial: the two labels name one identifier (r4419635988).
      named = c.match(identityPrefix)?.[0].toLowerCase().replace(/^s\/n$/, "serial");
    if (at && identityHeading.test(at.text.normalize("NFKC").trim())) return [[`column ${at.j}`, c]];
    // A cell under another column's heading describes that column, though it
    // starts with an identifier's name (Status: Registration pending,
    // r4418795510); a named identifier counts only in a cell without one. A
    // named identifier that looks like a value (Serial AB12.34) still tells
    // records apart, like one under its heading; it links none (r4419472067).
    if (at || !named) return [];
    return [[`named ${named}`, c]];
  });
  const crowded = cells.some(([k]) => cells.filter(([x]) => x === k).length > 1),
    m = new Map(cells.filter(([k]) => cells.filter(([x]) => x === k).length === 1));
  // The row's identity is incomplete, and it links no row, when an identity
  // column holds two cells (neither can be told to be the identifier,
  // r4419030685), or when a cell under no heading cell (an identifier
  // right-aligned under a short heading, a value-like serial too) may be the
  // identifier of an identity column the row has no cell in (r4418900383,
  // r4418984410); so may either of two cells under one descriptive heading
  // (r4420199960).
  const columns = r.rowCells!.map((_, k) => heading(k)?.j);
  const loose = h && columns.some((j) => j === undefined || columns.filter((x) => x === j).length > 1);
  if (crowded || (loose && h!.rowCells!.some((t, j) => identityHeading.test(t.normalize("NFKC").trim()) && !m.has(`column ${j}`))))
    m.set("incomplete", "");
  return m;
}
/**
 * Rows recovered from one baseline pair only through identity evidence (see
 * IDENTITY), within one table: the same section, title and heading row. Two
 * tables under one title are two scopes. An identity cell whose column and
 * text are unique within its table on both sides links two rows; uniqueness
 * only checks the link. A row linked to exactly one row binds, unless the two
 * rows hold different identifiers in the same identity column; rows whose
 * links conflict stay unresolved together. Rows are never paired by text
 * similarity; rows without identity evidence stay unpaired.
 */
function rowIdentity(
  left: Unit[],
  right: Unit[],
  usedL: Set<Unit>,
  usedR: Set<Unit>,
  bind: (a: Unit, b: Unit, method: string) => void,
  result: CompareResult,
  headings: Map<Unit, Unit>,
  scope: (u: Unit) => string,
) {
  const tables = (us: Unit[]) => {
    const m = new Map<string, Unit[]>();
    for (const u of us) if (u.rowCells) m.set(scope(u), [...(m.get(scope(u)) ?? []), u]);
    return m;
  };
  const identities = (r: Unit) => identityCells(r, headings);
  const owners = (rows: Unit[]) => {
    const m = new Map<string, Unit[]>();
    for (const r of rows)
      if (!identities(r).has("incomplete"))
        for (const [k, c] of identities(r))
          if (!valueLike(c)) m.set(k + "\u0000" + c, [...(m.get(k + "\u0000" + c) ?? []), r]);
    return m;
  };
  const lt = tables(left),
    rt = tables(right);
  const links = new Map<Unit, Set<Unit>>(),
    via = new Map<Unit, string>();
  for (const [t, rows] of lt) {
    const others = rt.get(t);
    if (!others) continue;
    const ro = owners(others);
    for (const [key, as] of owners(rows)) {
      const bs = ro.get(key);
      if (as.length !== 1 || bs?.length !== 1) continue;
      const [a, b] = [as[0], bs[0]];
      if (usedL.has(a) || usedR.has(b)) continue;
      links.set(a, (links.get(a) ?? new Set()).add(b));
      links.set(b, (links.get(b) ?? new Set()).add(a));
      if (!via.has(a)) via.set(a, key.split("\u0000")[1]);
    }
  }
  const leftSide = new Set(left),
    seen = new Set<Unit>();
  for (const start of left) {
    if (!links.has(start) || seen.has(start)) continue;
    const group: Unit[] = [],
      queue = [start];
    while (queue.length) {
      const u = queue.pop()!;
      if (seen.has(u)) continue;
      seen.add(u);
      group.push(u);
      queue.push(...(links.get(u) ?? []));
    }
    const byOrder = (x: Unit, y: Unit) => x.order - y.order;
    const as = group.filter((u) => leftSide.has(u)).sort(byOrder),
      bs = group.filter((u) => !leftSide.has(u)).sort(byOrder);
    if (as.length === 1 && bs.length === 1) {
      const [x, y] = [identities(as[0]), identities(bs[0])];
      if ([...x].every(([k, c]) => !y.has(k) || y.get(k) === c)) {
        as[0].path.rowKey = bs[0].path.rowKey = via.get(as[0]) ?? null;
        bind(as[0], bs[0], "row-identity");
        continue;
      }
    }
    const x = aggregate(as, "row-conflict-left-" + as[0].id, true),
      y = aggregate(bs, "row-conflict-right-" + bs[0].id, true);
    bind(x, y, "unresolved-row-identity");
    as.forEach((u) => usedL.add(u));
    bs.forEach((u) => usedR.add(u));
    result.unresolved.push({
      reason: "ambiguous_identity",
      message:
        "表格行的身份证据互相冲突（例如两个身份列指向不同行，或同一身份列的值不同）；未自动配对，组内原文变化仍展示",
      left: locations(x, "left"),
      right: locations(y, "right"),
      defaultVisible: true,
    });
  }
}
// A written date: day, English month name and year, the day and the year whole
// numbers of the text, as the scorer reads them: the "2024" of "20240" or the
// "21" of "121" is none (#10 4a12cd0).
const DATE_TEXT = /(?<!\d[.,]?)(\d{1,2}) ([A-Za-z]+) (\d{4})(?![.,]?\d)/g;
function datePeriod(text: string): [number, number] | null {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const matches = [...text.matchAll(DATE_TEXT)];
  if (matches.length !== 2) return null;
  const dates = matches.map((m) => {
    const mo = months.indexOf(m[2]),
      d = +m[1],
      y = +m[3];
    const t = Date.UTC(y, mo, d);
    const out = new Date(t);
    return mo >= 0 && out.getUTCDate() === d && out.getUTCMonth() === mo
      ? t
      : NaN;
  });
  return dates.every(Number.isFinite) && dates[1] >= dates[0]
    ? (dates as [number, number])
    : null;
}
/**
 * Facts the two texts themselves prove about a difference. They state what
 * changed, never whether it matters, and nothing else in the line (an
 * unchanged amount, a keyword, its role or a profile field) adds to them.
 * - whitespace_only: the words are the same once runs of whitespace are
 *   collapsed and the ends trimmed; an absent side reads as empty text.
 * - page_number_only: only the numbers of explicit "Page n" expressions differ
 *   (the fact is the texts' alone, see FactSchema). It is stated on repeated
 *   page lines, reading their confirmed page counters, and on heading or margin
 *   lines; that is where the product looks, not a condition of the fact. A line
 *   on one side only holds nothing but such page-number expressions.
 * - dates_rolled_forward_one_year: each of the two dates of a period moves
 *   exactly one calendar year (same day and month, the year plus one) and the
 *   rest of the text is equal. Consecutive annual periods are not enough:
 *   29 February 2024 -> 28 February 2025 is not one year later.
 * - continued_heading: a heading on one side only that is a heading of both
 *   versions with an explicit "continued" suffix.
 */
function facts(
  a: Unit | undefined,
  b: Unit | undefined,
  layoutOnly: Set<Unit>,
): Fact[] {
  const u = b ?? a!,
    old = a?.rawText ?? "",
    now = b?.rawText ?? "";
  if (old === now) return [];
  const words = (t: string) => t.trim().split(/\s+/u).join(" ");
  if (words(old) === words(now)) return ["whitespace_only"];
  const margin = ["page_heading", "footer", "heading"].includes(u.role);
  if (u.role === "furniture" || margin) {
    const page = (x: Unit) =>
      x.furniture
        ? !/\S/u.test(withoutFurniturePages(x.rawText, x.furniture))
        : !/\S/u.test(withoutPageNumbers(x.rawText));
    if (a && b ? maskedPageNumbers(a) === maskedPageNumbers(b) : (u.furniture?.pageNumber || margin) && page(u))
      return ["page_number_only"];
  }
  if (!(a && b) && layoutOnly.has(u)) return ["continued_heading"];
  if (a && b && u.path.field === "policy_period") {
    const before = datePeriod(old),
      after = datePeriod(now);
    if (before && after) {
      const oneYearLater = (x: number, y: number) => {
        const s = new Date(x),
          e = new Date(y);
        return (
          e.getUTCFullYear() === s.getUTCFullYear() + 1 &&
          e.getUTCMonth() === s.getUTCMonth() &&
          e.getUTCDate() === s.getUTCDate()
        );
      };
      const withoutDates = (text: string) => text.replace(DATE_TEXT, "<date>");
      if (oneYearLater(before[0], after[0]) && oneYearLater(before[1], after[1]) &&
          withoutDates(old) === withoutDates(now))
        return ["dates_rolled_forward_one_year"];
    }
  }
  return [];
}
/**
 * Tokens of a text as code-point ranges: a run of letters, a number with its
 * inner separators ("7,400", "0.0425"), a run of whitespace, or one other
 * character.
 */
function tokens(cs: string[]) {
  const kind = (c: string | undefined) =>
    c === undefined ? "" : /\p{L}/u.test(c) ? "L" : /\p{N}/u.test(c) ? "N" : /\s/u.test(c) ? "S" : "P";
  const out: { start: number; end: number; text: string }[] = [];
  let k = 0;
  while (k < cs.length) {
    const t = kind(cs[k]);
    let e = k + 1;
    if (t !== "P")
      while (
        e < cs.length &&
        (kind(cs[e]) === t || (t === "N" && /^[.,]$/u.test(cs[e]) && kind(cs[e + 1]) === "N"))
      )
        e++;
    out.push({ start: k, end: e, text: cs.slice(k, e).join("") });
    k = e;
  }
  return out;
}
/** A longest-common-subsequence edit script: (kind, index in xs, index in ys). */
function lcs<T>(xs: T[], ys: T[], same: (p: T, q: T) => boolean) {
  const width = ys.length + 1,
    dp = new Uint32Array((xs.length + 1) * width);
  for (let i = xs.length - 1; i >= 0; i--)
    for (let j = ys.length - 1; j >= 0; j--)
      dp[i * width + j] = same(xs[i], ys[j])
        ? 1 + dp[(i + 1) * width + j + 1]
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
  const out: ["equal" | "delete" | "insert", number, number][] = [];
  let i = 0,
    j = 0;
  while (i < xs.length || j < ys.length) {
    if (i < xs.length && j < ys.length && same(xs[i], ys[j])) out.push(["equal", i++, j++]);
    else if (i < xs.length && (j === ys.length || dp[(i + 1) * width + j] >= dp[i * width + j + 1]))
      out.push(["delete", i++, j]);
    else out.push(["insert", i, j++]);
  }
  return out;
}
function textOps(
  a: Unit | undefined,
  b: Unit | undefined,
  budget: Budget,
  result: CompareResult,
): Difference["textOps"] {
  const aa = Array.from(a?.rawText ?? ""),
    bb = Array.from(b?.rawText ?? "");
  // Words and numbers are paired first, so an unchanged character is paired
  // only inside corresponding tokens: the comma of 7,400 is never "kept" as the
  // comma of 71,600, nor the S of Sudan as the S of South.
  const at = tokens(aa),
    bt = tokens(bb);
  let p = 0;
  while (p < at.length && p < bt.length && at[p].text === bt[p].text) p++;
  let s = 0;
  while (
    s < at.length - p &&
    s < bt.length - p &&
    at[at.length - 1 - s].text === bt[bt.length - 1 - s].text
  )
    s++;
  const prefix = p ? at[p - 1].end : 0,
    suffix = s ? aa.length - at[at.length - s].start : 0;
  const x = aa.slice(prefix, aa.length - suffix),
    y = bb.slice(prefix, bb.length - suffix);
  const ops: {
    kind: "equal" | "delete" | "insert";
    i: number;
    j: number;
    text: string;
  }[] = [];
  for (let i = 0; i < prefix; i++)
    ops.push({ kind: "equal", i, j: i, text: aa[i] });
  const shift = (t: { start: number; end: number; text: string }) => ({
    ...t,
    start: t.start - prefix,
    end: t.end - prefix,
  });
  const xt = at.slice(p, at.length - s).map(shift),
    yt = bt.slice(p, bt.length - s).map(shift);
  let over = false;
  const equal = (i: number, j: number) => ops.push({ kind: "equal", i: prefix + i, j: prefix + j, text: x[i] });
  const replaced = (i0: number, i1: number, j0: number, j1: number) => {
    for (let i = i0; i < i1; i++) ops.push({ kind: "delete", i: prefix + i, j: prefix + j0, text: x[i] });
    for (let j = j0; j < j1; j++) ops.push({ kind: "insert", i: prefix + i1, j: prefix + j, text: y[j] });
  };
  // Beyond the budget a stretch is shown as deleted and inserted whole, once
  // recorded as unresolved.
  const whole = (i0: number, i1: number, j0: number, j1: number) => {
    if (!over)
      result.unresolved.push({
        reason: "word_diff_budget",
        message: "词级差异工作量超过上限；保留双方完整原文，定位降级",
        left: locations(a, "left"),
        right: locations(b, "right"),
        defaultVisible: true,
      });
    over = true;
    replaced(i0, i1, j0, j1);
  };
  // Two ranges keep their common start and end ("approv|ed" -> "schedul|ed",
  // "7,|400" -> "7,|750"); the rest is replaced, never matched letter by
  // letter. With `spaces`, only spaces count as common.
  const chars = (i0: number, i1: number, j0: number, j1: number, spaces = false) => {
    const same = (i: number, j: number) => x[i] === y[j] && (!spaces || /\s/u.test(x[i]));
    let e = 0;
    for (; i0 + e < i1 && j0 + e < j1 && same(i0 + e, j0 + e); e++) equal(i0 + e, j0 + e);
    [i0, j0] = [i0 + e, j0 + e];
    let f = 0;
    while (i1 - f > i0 && j1 - f > j0 && same(i1 - 1 - f, j1 - 1 - f)) f++;
    replaced(i0, i1 - f, j0, j1 - f);
    for (let k = f; k > 0; k--) equal(i1 - k, j1 - k);
  };
  // Words, numbers and punctuation anchor the alignment; a space alone does
  // not, so the spaces of an added clause are never paired with those of a
  // deleted one, nor the letters between them.
  const xc = xt.filter((t) => !/^\s/u.test(t.text)),
    yc = yt.filter((t) => !/^\s/u.test(t.text));
  if (xc.length * yc.length > budget.diffProducts) whole(0, x.length, 0, y.length);
  else {
    // Between two anchors, tokens a0..a1 and b0..b1 (characters i0..i1 and
    // j0..j1) are paired in order when both sides hold as many (a row of
    // amounts), each pair keeping only its common start and end; otherwise the
    // stretch is replaced whole.
    const stretch = (a0: number, a1: number, b0: number, b1: number, i0: number, i1: number, j0: number, j1: number) => {
      if (a1 - a0 !== b1 - b0) return chars(i0, i1, j0, j1, true);
      for (let k = 0; k < a1 - a0; k++) {
        const [u, v] = [xc[a0 + k], yc[b0 + k]];
        chars(i0, u.start, j0, v.start);
        chars(u.start, u.end, v.start, v.end);
        [i0, j0] = [u.end, v.end];
      }
      chars(i0, i1, j0, j1);
    };
    let [ta, tb, ci, cj] = [0, 0, 0, 0];
    for (const [kind, ti, tj] of lcs(xc.map((t) => t.text), yc.map((t) => t.text), (u, v) => u === v)) {
      if (kind !== "equal") continue;
      const [u, v] = [xc[ti], yc[tj]];
      stretch(ta, ti, tb, tj, ci, u.start, cj, v.start);
      for (let k = 0; k < u.end - u.start; k++) equal(u.start + k, v.start + k);
      [ta, tb, ci, cj] = [ti + 1, tj + 1, u.end, v.end];
    }
    stretch(ta, xc.length, tb, yc.length, ci, x.length, cj, y.length);
  }
  for (let k = suffix; k > 0; k--)
    ops.push({
      kind: "equal",
      i: aa.length - k,
      j: bb.length - k,
      text: aa[aa.length - k],
    });
  const groups: (typeof ops)[] = [];
  for (const op of ops) {
    if (groups.at(-1)?.[0].kind === op.kind) groups.at(-1)!.push(op);
    else groups.push([op]);
  }
  return groups.map((g) => ({
    kind: g[0].kind,
    text: g.map((o) => o.text).join(""),
    left:
      a && g[0].kind !== "insert"
        ? sourceLocations(
            g.map((o) => a.refs[o.i]),
            "left",
            a.id,
          )
        : [],
    right:
      b && g[0].kind !== "delete"
        ? sourceLocations(
            g.map((o) => b.refs[o.j]),
            "right",
            b.id,
          )
        : [],
  }));
}
export function compare(
  left: DocInput,
  right: DocInput,
  profile: Profile = aviationProfile,
  budget: Budget = profile.budget,
  phase?: (name: string) => void,
  checkpoint?:()=>void,
): CompareResult {
  if (digest(left.extractor) !== digest(right.extractor))
    throw new Error("两份文档必须由同一引擎、版本及选项提取");
  phase?.("snapshot");
  const result: CompareResult = {
    schemaVersion: RESULT_VERSION,
    coreVersion: VERSION + "+row-identity.28+facts.5+repeat.9+ops.4",
    extractors: [left.extractor, right.extractor],
    snapshotHashVersion: "page-merkle/1",
    tokenizerVersion: "unicode-tokens/1",
    profileVersion: profile.version,
    documentHashes: [left.contentHash, right.contentHash],
    extractionSnapshotHashes: [snapshotDigest(left,checkpoint), snapshotDigest(right,checkpoint)],
    configDigest: digest({ profile, budget }),
    scope: "extracted_text",
    status: "complete_for_scope",
    differences: [],
    coverage: [],
    unresolved: [],
    alignment: [],
    stats: {
      leftScalars: left.pages.reduce(
        (n, p) => n + (p.chars.at(-1)?.rawRange[1] ?? 0),
        0,
      ),
      rightScalars: right.pages.reduce(
        (n, p) => n + (p.chars.at(-1)?.rawRange[1] ?? 0),
        0,
      ),
      candidates: 0,
      tokenProducts: 0,
      differenceCount: 0,
      occurrenceCount: 0,
    },
    diagnostics: [],
  };
  for (const [doc, side] of [
    [left, "left"],
    [right, "right"],
  ] as const)
    for (const p of doc.pages)
      result.coverage.push(...p.issues.map((i) => ({ ...i, side })));
  phase?.("structure");
  // Page furniture found in either document is recognised in both.
  const shared = [...furnitureSignatures(left), ...furnitureSignatures(right)];
  const la = structure(left, profile, checkpoint, shared).filter(
      (u) => u.role !== "logical_separator",
    ),
    rb = structure(right, profile, checkpoint, shared).filter(
      (u) => u.role !== "logical_separator",
    ),
    pairs: Pair[] = [],
    usedL = new Set<Unit>(),
    usedR = new Set<Unit>();
  // A heading without a counterpart is layout only with positive evidence: a
  // continuation heading ("... CONTINUED") of a heading both versions have. A
  // new page title is not: its place and the extra page say nothing about
  // what it means.
  const layoutOnly = new Set<Unit>(),
    titled = (u: Unit) => u.role === "page_heading" || u.role === "heading",
    titles = (us: Unit[]) => new Set(us.filter(titled).map((u) => u.rawText.trim()));
  const [tl, tr] = [titles(la), titles(rb)];
  for (const u of [...la, ...rb]) {
    const base = titled(u)
      ? u.rawText.trim().match(/^(.+?)[\s(,:–-]*\b(?:continued|cont['’]d|cont\.?)\)?\.?$/iu)?.[1].trim()
      : undefined;
    if (base && tl.has(base) && tr.has(base)) layoutOnly.add(u);
  }
  phase?.("matching");
  // A recovered table is its section, title and heading row: one title can
  // stand above several tables.
  const { headings, scopes, starts } = rowHeadings(la, rb),
    tableScope = (u: Unit) => scopes.get(u) ?? `${u.path.section}\u0000${u.title}\u0000`;
  const bind = (
    a: Unit,
    b: Unit,
    method: string,
    score: number | null = null,
  ) => {
    pairs.push({ a, b, method, score });
    usedL.add(a);
    usedR.add(b);
  };
  tablePairs(la, rb, pairs, usedL, usedR, result);
  const map = (
    us: Unit[],
    used: Set<Unit>,
    key: (u: Unit) => string | null,
  ) => {
    const m = new Map<string, Unit[]>();
    for (const u of us) {
      if (used.has(u)) continue;
      const k = key(u);
      if (k === null) continue;
      const list = m.get(k) ?? [];
      list.push(u);
      m.set(k, list);
    }
    return m;
  };
  const il = map(la, usedL, (u) => u.identity),
    ir = map(rb, usedR, (u) => u.identity),
    declared: [Unit[], Unit[]][] = [];
  for (const [key, as] of il) {
    checkpoint?.();
    const bs = ir.get(key);
    if (!bs) continue;
    if (as.length === 1 && bs.length === 1)
      bind(as[0], bs[0], "reliable-field-identity");
    else if (
      as.every(
        (u) =>
          u.path.section === "repeated_header" || u.role === "table_header",
      ) &&
      bs.every(
        (u) =>
          u.path.section === "repeated_header" || u.role === "table_header",
      )
    ) {
      // Repeated headers retain all locations and are compared variant by
      // variant like page furniture (below), never as one concatenated text.
      declared.push([as, bs]);
      as.forEach((u) => usedL.add(u));
      bs.forEach((u) => usedR.add(u));
    } else if(as.every(u=>u.role==='field'||u.role==='label')&&bs.every(u=>u.role==='field'||u.role==='label')) {
      // A repeated field key is not a unique identity. First refine by a
      // stable, unique heading context; never use equal values to choose owners.
      for(const title of new Set(as.map(u=>u.title).filter(Boolean))){
        const aa=as.filter(u=>u.title===title),bb=bs.filter(u=>u.title===title);
        if(aa.length===1&&bb.length===1){
          for(const u of [aa[0],bb[0]]){
            if(u.path.section!==title)u.path.section=u.path.section==='risk_details'?title:`${u.path.section} / ${title}`;
            u.identity=`${u.path.section}/${u.path.entity??''}/${u.path.field}`;
          }
          bind(aa[0],bb[0],'reliable-field-identity');
        }
      }
      const remainingL=as.filter(u=>!usedL.has(u)),remainingR=bs.filter(u=>!usedR.has(u));
      if(remainingL.length&&remainingR.length){
        const a=aggregate(remainingL,'uncertain-field-left-'+key,true),b=aggregate(remainingR,'uncertain-field-right-'+key,true);
        bind(a,b,'unresolved-field-group');remainingL.forEach(u=>usedL.add(u));remainingR.forEach(u=>usedR.add(u));
        if(a.role==='field')result.unresolved.push({reason:'ambiguous_identity',message:'同名字段缺少唯一归属；组内原文变化仍展示，不按金额相同跨位置配对',left:locations(a,'left'),right:locations(b,'right'),defaultVisible:true});
      }
    }
  }
  // Page furniture and repeated table header rows are compared once per
  // repeated line, never page by page; every occurrence stays on the card.
  const singles: [Unit | undefined, Unit | undefined][] = [];
  const repeated = (us: Unit[], id: string, extra: Partial<Repeated> = {}) => {
    const u: Repeated = aggregate(us, id);
    Object.assign(u, normalize(us[0].rawText, us[0].refs));
    return Object.assign(u, { repeats: us }, extra);
  };
  const furnitureKey = (u: Unit) =>
    u.furniture
      ? [u.furniture.pattern, u.furniture.x0, u.furniture.x1, u.furniture.y].join("\u0000")
      : null;
  // The same repeated line in the other version is at about the same place:
  // its left edge, right edge or centre within 12 points across, its baseline
  // within 12 points down.
  const distance = (f: Furniture, g: Furniture) => {
    const down = Math.abs(f.y - g.y),
      across = Math.min(Math.abs(f.x0 - g.x0), Math.abs(f.x1 - g.x1), Math.abs(f.x0 + f.x1 - g.x0 - g.x1) / 2);
    return down <= 12 && across <= 12 ? down + across : Infinity;
  };
  const pageList = (us: Unit[]) =>
    us.map((u) => u.refs.find(Boolean)!.page.pageIndex + 1).join("、");
  // One repeated line of both versions. Occurrences of the same variant (the
  // same text once a page counter is read against its own page) form one group
  // per version; a variant is unchanged only when both versions have it the
  // same number of times. A variant on one side only has a counterpart only
  // when the other version has a single variant throughout (one or several new
  // texts for one old text, or the reverse); that single group is then not
  // also reported as unmatched. Same page numbers never pair occurrences.
  const compareRepeated = (as: Unit[], bs: Unit[], method = "page-furniture", prefix = "furniture") => {
    const texts = (us: Unit[]) => {
      const m = new Map<string, Unit[]>();
      for (const u of us) m.set(variant(u), [...(m.get(variant(u)) ?? []), u]);
      return m;
    };
    const L = texts(as),
      R = texts(bs);
    if (L.size === 1 && R.size === 1) {
      // Two different variants whose first occurrences read alike (Page 1 on
      // every page against a counting Page 1 .. 4, r4417303223) are shown by
      // an occurrence that differs; every occurrence stays on the card.
      const shown = (us: Unit[], other: string, id: string) => {
        const i = L.keys().next().value === R.keys().next().value ? -1 : us.findIndex((u) => u.rawText !== other);
        return Object.assign(repeated(i > 0 ? [us[i], ...us.filter((_, k) => k !== i)] : us, id), { repeats: us });
      };
      const b = shown(bs, as[0].rawText, `${prefix}-right-` + bs[0].id);
      bind(shown(as, b.rawText, `${prefix}-left-` + as[0].id), b, method);
      return;
    }
    const quote = (us: Unit[]) =>
      `“${us[0].rawText.trim()}”` + (new Set(us.map((u) => u.rawText.trim())).size > 1 ? "等（页码随所在页）" : "");
    for (const [own, other, isRight] of [
      [R, L, true],
      [L, R, false],
    ] as const) {
      const [name, otherName] = isRight ? ["待审版", "基准版"] : ["基准版", "待审版"];
      const unchanged = [...own].filter(([t]) => other.has(t)).flatMap(([, us]) => us);
      for (const [text, us] of own) {
        if (other.has(text)) continue;
        const kept = other.size === 1 ? [...other.values()][0] : null;
        // This version's only variant is the counterpart of the other
        // version's variants, on their cards.
        if (!kept && own.size === 1) continue;
        const note =
          `本版组内文字不一致：${name}第 ${pageList(us)} 页为${isRight ? "新" : "旧"}文字` +
          (kept
            ? unchanged.length
              ? `；${name}第 ${pageList(unchanged)} 页仍为${otherName}文字${quote(kept)}`
              : ""
            : `，${otherName}没有相同文字`);
        const card = repeated(us, `${prefix}-${isRight ? "right" : "left"}-${us[0].id}`, {
          others: unchanged,
          separate: true,
          note,
        });
        if (!kept) singles.push(isRight ? [undefined, card] : [card, undefined]);
        else {
          const whole = repeated(kept, `${prefix}-${isRight ? "left" : "right"}-${kept[0].id}`);
          isRight ? bind(whole, card, method) : bind(card, whole, method);
        }
      }
    }
    // A variant both versions have is unchanged only if its count is. Its count
    // change is its own card, the line's other variants listed as context; when
    // it is the single counterpart of the other version's variants, those cards
    // already list its occurrences.
    const oneSided = (own: Map<string, Unit[]>, other: Map<string, Unit[]>) =>
      [...own.keys()].some((t) => !other.has(t));
    if ((L.size === 1 && oneSided(R, L)) || (R.size === 1 && oneSided(L, R))) return;
    for (const [text, ls] of L) {
      const rs = R.get(text);
      if (!rs || rs.length === ls.length) continue;
      const others = (m: Map<string, Unit[]>) => [...m].filter(([t]) => t !== text).flatMap(([, us]) => us);
      const [lo, ro] = [others(L), others(R)];
      const note =
        "同一行的其他写法只作上下文，不计入本写法的次数" +
        (lo.length ? `：基准版第 ${pageList(lo)} 页` : "") +
        (ro.length ? `${lo.length ? "；" : "："}待审版第 ${pageList(ro)} 页` : "");
      bind(
        repeated(ls, `${prefix}-left-` + ls[0].id, { others: lo, separate: true, note }),
        repeated(rs, `${prefix}-right-` + rs[0].id, { others: ro, separate: true }),
        method,
      );
    }
  };
  for (const [as, bs] of declared) compareRepeated(as, bs, "repeated-header", "repeat");
  const lf = map(la, usedL, furnitureKey),
    rf = map(rb, usedR, furnitureKey),
    lone = { left: [] as Unit[], right: [] as Unit[] };
  for (const [, as] of lf) {
    const f = as[0].furniture!,
      near = (bs: Unit[]) => distance(f, bs[0].furniture!),
      [key, bs] =
        [...rf]
          .filter(([, bs]) => bs[0].furniture!.pattern === f.pattern && near(bs) < Infinity)
          .sort(([, x], [, y]) => near(x) - near(y))[0] ?? [];
    as.forEach((u) => usedL.add(u));
    if (!bs) {
      lone.left.push(...as);
      continue;
    }
    rf.delete(key);
    bs.forEach((u) => usedR.add(u));
    compareRepeated(as, bs);
  }
  for (const [, bs] of rf) {
    lone.right.push(...bs);
    bs.forEach((u) => usedR.add(u));
  }
  // Furniture on one side only (a Draft watermark) is one card per text; the
  // same text elsewhere in a page margin of that side, such as on a cover page,
  // joins it.
  const margin = (u: Unit) => {
    const r = u.refs.find(Boolean)!;
    return r.char.origin[1] < 0.16 * r.page.height || r.char.origin[1] > 0.88 * r.page.height;
  };
  for (const [side, us, used] of [
    ["left", la, usedL],
    ["right", rb, usedR],
  ] as const) {
    // Grouped by variant like the paired lines, so "Draft " on one page is not
    // counted as "Draft" (r4417244277).
    const texts = new Map<string, Unit[]>();
    for (const u of lone[side]) texts.set(variant(u), [...(texts.get(variant(u)) ?? []), u]);
    for (const [text, group] of texts) {
      for (const u of us)
        if (!used.has(u) && variant(u) === text && margin(u)) {
          group.push(u);
          used.add(u);
        }
      group.sort((x, y) => x.order - y.order);
      const u = repeated(group, `furniture-${side}-${group[0].id}`);
      Object.assign(u, {
        role: "furniture",
        furniture: group.find((x) => x.furniture)!.furniture,
        path: { ...u.path, section: "page_furniture" },
      });
      singles.push(side === "left" ? [u, undefined] : [undefined, u]);
    }
  }
  // A digit-free row that starts a table and is repeated on several pages is
  // its header. A digit-free row inside a table is grouped only within its own
  // table instance, so a record repeated on several pages does not merge the
  // tables it sits in (r4416744444). An occurrence count that pagination does
  // not explain is shown on the card.
  // A row's cells with the heading column each stands in, or for a cell under
  // no heading cell the gap between heading cells it sits in: equal row text
  // can still split into other cells (r4419804273).
  const slots = (u: Unit) => {
    const h = headings.get(u);
    return JSON.stringify(u.rowSpans!.map((s, k) => {
      const at = under(h, s);
      return [at ? `c${at.j}` : `g${h ? h.rowSpans!.filter(([, b]) => b <= s[0]).length : 0}`, u.rowCells![k]];
    }));
  };
  // Under a heading row, or with an incomplete identity, a row's cells say
  // more than its text: equal text is one record only with every cell in the
  // same column or gap (r4419388482, r4420011674).
  const placed = (u: Unit, ids: Map<string, string>) => headings.has(u) || ids.has("incomplete");
  // A record groups only with copies that hold the same identifiers in the
  // same columns (r4418369390), and, placed, the same cells (r4419561470).
  const headerKey = (u: Unit) => {
    if (!u.rowCells || (/\p{N}/u.test(u.rawText) && !starts.has(u))) return null;
    if (starts.has(u)) return `${u.path.section}\u0000${u.title}\u0000${u.rawText}`;
    const ids = identityCells(u, headings);
    return `${tableScope(u)}\u0000${u.rawText}\u0000${JSON.stringify([...ids].sort())}${placed(u, ids) ? `\u0000${slots(u)}` : ""}`;
  };
  const rh = map(rb, usedR, headerKey);
  for (const [key, as] of map(la, usedL, headerKey)) {
    const bs = rh.get(key),
      pages = (us: Unit[]) => new Set(us.map((u) => u.refs.find(Boolean)!.page.pageIndex)).size;
    if (!bs || Math.max(pages(as), pages(bs)) < 2) continue;
    bind(
      repeated(as, "header-left-" + as[0].id),
      repeated(bs, "header-right-" + bs[0].id),
      "repeated-table-header",
    );
    as.forEach((u) => usedL.add(u));
    bs.forEach((u) => usedR.add(u));
  }
  const eligible = (u: Unit) => !u.identity && u.role !== "cell";
  // Identical row text is the same record only inside the same table; across
  // tables it would consume a record before identity evidence is consulted.
  const rawKey = (u: Unit) =>
    eligible(u)
      ? `${u.role}/${u.rowCells ? `${tableScope(u)}\u0000` : ""}${u.rawText}`
      : null;
  const el = map(la, usedL, rawKey),
    er = map(rb, usedR, rawKey);
  // Equal row text is one record only with its identifiers in the same
  // columns: missing cells can move them (r4417643759).
  const sameIds = (a: Unit, b: Unit) => {
    if (!a.rowCells || !b.rowCells) return true;
    const x = identityCells(a, headings),
      y = identityCells(b, headings);
    // An incomplete identity cannot say the identifiers stayed in their
    // columns, nor a complete one that the other cells did (r4419388482,
    // r4420011674).
    if (placed(a, x) || placed(b, y)) return slots(a) === slots(b);
    return x.size === y.size && [...x].every(([k, c]) => y.get(k) === c);
  };
  for (const [key, as] of el) {
    checkpoint?.();
    const bs = er.get(key);
    if (!bs) continue;
    if (as.length === 1 && bs.length === 1) {
      if (sameIds(as[0], bs[0])) bind(as[0], bs[0], "unique-exact");
    } else if (
      as.every((u) => ["page_heading", "footer", "heading"].includes(u.role))
    ) {
      const a = aggregate(as, "repeat-left-" + as[0].id),
        b = aggregate(bs, "repeat-right-" + bs[0].id);
      a.rawText = b.rawText = as[0].rawText;
      bind(a, b, "repeat-role");
      as.forEach((u) => usedL.add(u));
      bs.forEach((u) => usedR.add(u));
    } else {
      for (const a of as) {
        const candidates = bs.filter(
          (b) =>
            !usedR.has(b) &&
            a.path.section === b.path.section &&
            a.title === b.title,
        );
        if (
          candidates.length === 1 &&
          as.filter(
            (x) => x.path.section === a.path.section && x.title === a.title,
          ).length === 1 &&
          sameIds(a, candidates[0])
        )
          bind(a, candidates[0], "exact-context");
      }
    }
  }
  rowIdentity(la, rb, usedL, usedR, bind, result, headings, tableScope);
  // Adjacent split/merge candidates are evaluated before fuzzy 1:1 locks.
  for (const [source, target, su, tu, reverse] of [
    [la, rb, usedL, usedR, false],
    [rb, la, usedR, usedL, true],
  ] as const) {
    // Recovered table rows pair only by identity or by equal text in their table.
    for (const a of source.filter((u) => !su.has(u) && u.role === "body" && !u.rowCells))
      for (let j = 0; j < target.length - 1; j++) {
        const b = target[j],
          c = target[j + 1];
        if (
          tu.has(b) ||
          tu.has(c) ||
          b.role !== "body" ||
          c.role !== "body" ||
          b.rowCells ||
          c.rowCells ||
          b.path.section !== c.path.section ||
          b.title !== c.title
        )
          continue;
        const merged = aggregate([b, c], b.id + "+" + c.id);
        if (a.rawText === merged.rawText) {
          reverse
            ? bind(merged, a, "adjacent-merge")
            : bind(a, merged, "adjacent-split");
          su.add(a);
          tu.add(b);
          tu.add(c);
          break;
        }
      }
  }
  const candidates: { a: Unit; b: Unit; score: number }[] = [];
  let exhausted = false;
  const tokenCache = new Map<Unit, string[]>(),
    countCache = new Map<Unit, Map<string, number>>();
  const tokens = (u: Unit) => {
    let t = tokenCache.get(u);
    if (!t) {
      t = tokenize(u.matchText);
      tokenCache.set(u, t);
    }
    return t;
  };
  const counts = (u: Unit) => {
    let c = countCache.get(u);
    if (!c) {
      c = new Map();
      for (const t of tokens(u)) c.set(t, (c.get(t) ?? 0) + 1);
      countCache.set(u, c);
    }
    return c;
  };
  const score = (a: Unit, b: Unit, threshold: number): number | null => {
    const at = tokens(a),
      bt = tokens(b);
    if (!at.length || !bt.length) return null;
    if (
      (2 * Math.min(at.length, bt.length)) / (at.length + bt.length) <
      threshold
    )
      return null;
    let intersection = 0;
    for (const [token, n] of counts(a))
      intersection += Math.min(n, counts(b).get(token) ?? 0);
    if ((2 * intersection) / (at.length + bt.length) < threshold) return null;
    if (
      result.stats.candidates >= budget.candidates ||
      result.stats.tokenProducts + at.length * bt.length > budget.tokenProducts
    ) {
      exhausted = true;
      return null;
    }
    result.stats.candidates++;
    result.stats.tokenProducts += at.length * bt.length;
    const value = (2 * lcsLength(at, bt,checkpoint)) / (at.length + bt.length);
    return value >= threshold ? value : null;
  };
  const anchors = monotone(
    pairs.filter(
      (p) => la.includes(p.a) && rb.includes(p.b) && p.a.role !== "cell",
    ),
    (p) => p.a.order,
    (p) => p.b.order,
    (p) => (p.method === "reliable-field-identity" ? 4 : 2),
  );
  const boundaries = [
    { a: { order: -1 }, b: { order: -1 } },
    ...anchors,
    { a: { order: la.length }, b: { order: rb.length } },
  ];
  for (let k = 1; k < boundaries.length && !exhausted; k++) {
    const lo = boundaries[k - 1],
      hi = boundaries[k];
    const as = la.filter(
        (u) =>
          !usedL.has(u) &&
          u.role === "body" &&
          u.order > lo.a.order &&
          u.order < hi.a.order,
      ),
      bs = rb.filter(
        (u) =>
          !usedR.has(u) &&
          u.role === "body" &&
          u.order > lo.b.order &&
          u.order < hi.b.order,
      );
    if (!as.length || !bs.length || as.length * bs.length > 4096) continue;
    const joined = new Map<string, Unit>();
    const get = (us: Unit[]) => {
      if (us.length === 1) return us[0];
      const id = us.map((u) => u.refs.find(Boolean)?.char.id ?? u.id).join("+");
      let u = joined.get(id);
      if (!u) {
        u = aggregate(us, id);
        joined.set(id, u);
      }
      return u;
    };
    const matches = jointAlign(
      as,
      bs,
      (aa, bb) => {
        if ([...aa, ...bb].some((u) => u.rowCells)) return null;
        const a = get(aa),
          b = get(bb);
        if (a.title !== b.title || a.path.section !== b.path.section)
          return null;
        if (
          as.filter((u) => u.rawText === a.rawText && u.title === a.title)
            .length > 1 ||
          bs.filter((u) => u.rawText === b.rawText && u.title === b.title)
            .length > 1
        )
          return null;
        return score(a, b, profile.thresholds.local);
      },
      (a, b) =>
        a.order + 1 === b.order &&
        !a.rowCells &&
        !b.rowCells &&
        a.title === b.title &&
        a.path.section === b.path.section,
    );
    if (!exhausted)
      for (const m of matches) {
        bind(get(m.a), get(m.b), "joint-local-alignment", m.score);
        m.a.forEach((u) => usedL.add(u));
        m.b.forEach((u) => usedR.add(u));
      }
  }
  for (const a of la.filter((u) => !usedL.has(u) && u.role !== "cell")) {
    for (const b of rb.filter((u) => !usedR.has(u) && u.role !== "cell")) {
      if (a.role !== b.role || a.identity !== b.identity) continue;
      if (a.rowCells || b.rowCells) continue;
      const sameContext =
        a.path.section === b.path.section && a.title === b.title;
      const at = tokens(a),
        bt = tokens(b),
        threshold = sameContext
          ? profile.thresholds.local
          : profile.thresholds.global;
      if (
        !at.length ||
        !bt.length ||
        (!sameContext &&
          Math.min(at.length, bt.length) < profile.thresholds.globalMinTokens)
      )
        continue;
      const value = score(a, b, threshold);
      if (exhausted) break;
      if (value !== null) candidates.push({ a, b, score: value });
    }
    if (exhausted) break;
  }
  candidates.sort(
    (x, y) =>
      y.score - x.score || x.a.order - y.a.order || x.b.order - y.b.order,
  );
  for (const c of candidates) {
    if (usedL.has(c.a) || usedR.has(c.b)) continue;
    const tied = candidates.some(
      (o) =>
        o !== c &&
        o.score === c.score &&
        ((o.a === c.a && !usedR.has(o.b)) || (o.b === c.b && !usedL.has(o.a))),
    );
    if (!tied) bind(c.a, c.b, "contextual-token-lcs", c.score);
  }
  const unmatchedL = la.filter((u) => !usedL.has(u)),
    unmatchedR = rb.filter((u) => !usedR.has(u));
  const ambiguousL=new Set<Unit>(),ambiguousR=new Set<Unit>();
  if (exhausted) {
    result.unresolved.push({
      reason: "budget",
      message: "对应工作量预算耗尽；以下范围未完成，不能宣称无变化",
      left: unmatchedL.flatMap((u) => locations(u, "left")),
      right: unmatchedR.flatMap((u) => locations(u, "right")),
      defaultVisible: true,
    });
  } else {
    const group=(units:Unit[])=>{
      const m=new Map<string,Unit[]>();
      for(const u of units)if(u.role==='body'){const xs=m.get(u.matchText)??[];xs.push(u);m.set(u.matchText,xs);}
      return m;
    };
    const leftGroups=group(unmatchedL),rightGroups=group(unmatchedR);
    for(const [key,left] of leftGroups){
      const right=rightGroups.get(key);if(!right)continue;
      left.forEach(u=>ambiguousL.add(u));right.forEach(u=>ambiguousR.add(u));
      result.unresolved.push({reason:'ambiguous_match',message:'这组重复原文的身份不唯一；其他明确变化继续展示',left:left.flatMap(u=>locations(u,'left')),right:right.flatMap(u=>locations(u,'right')),defaultVisible:true});
    }
  }
  phase?.("diff");
  const bodyPairs = pairs.filter(
    (p) => p.a.role === "body" && p.a.path.section === p.b.path.section,
  );
  const stable = new Set(
    monotone(
      bodyPairs,
      (p) => p.a.order,
      (p) => p.b.order,
      (p) => Math.min(p.a.rawText.length, p.b.rawText.length),
    ),
  );
  function emit(
    a: Unit | undefined,
    b: Unit | undefined,
    method: string,
    score: number | null,
    moved = false,
  ) {
    const ra = a as Repeated | undefined,
      rb2 = b as Repeated | undefined,
      ar = ra?.repeats,
      br = rb2?.repeats;
    // A repeated line whose number of occurrences changed is shown with both
    // counts and both page counts; neither explains the other, and no page
    // of one version is said to correspond to a page of the other.
    const recount = !!ar && !!br && ar.length !== br.length;
    if (a && b && a.rawText === b.rawText && !moved && !recount) {
      // The same row text and record with the cells split otherwise: which
      // value stands in which column is not determined (r4420011674).
      if (a.rowCells && b.rowCells && (placed(a, identityCells(a, headings)) || placed(b, identityCells(b, headings))) && slots(a) !== slots(b))
        result.unresolved.push({
          reason: "ambiguous_match",
          message: "两版本这一表格行的原文相同，但各格的划分不同；哪个值在哪一列未能确定",
          left: locations(a, "left"),
          right: locations(b, "right"),
          defaultVisible: true,
        });
      return;
    }
    const kind: Difference["kind"] = moved
      ? "Moved"
      : a && b
        ? "Replaced"
        : a
          ? "Removed"
          : "Added";
    const d: Difference = {
      id: "",
      kind,
      structurePath: (a ?? b!).path,
      left: locations(a, "left"),
      right: locations(b, "right"),
      oldText: a?.rawText ?? "",
      newText: b?.rawText ?? "",
      textOps: textOps(a, b, budget, result),
      hasTextChange: a?.rawText !== b?.rawText,
      facts: facts(a, b, layoutOnly),
      repeat:
        ar || br
          ? {
              left: ar?.length ?? 0,
              right: br?.length ?? 0,
              leftPages: left.pages.length,
              rightPages: right.pages.length,
            }
          : null,
      defaultVisible: true,
      matchEvidence: {
        method,
        score,
        details: [
          method === "reliable-field-identity" ? "主体与字段身份一致" : method,
        ],
      },
      reviewReasons:
        (a ?? b!).path.confidence === "unresolved"
          ? [(a??b!).path.table?"无法确定唯一表格行身份":"无法确定同名字段的唯一归属"]
          : ar || br
            ? [
                `这段文字出现次数：${ar?.length ?? 0} 次 → ${br?.length ?? 0} 次；文档页数：${left.pages.length} 页 → ${right.pages.length} 页` +
                  [ra?.note, rb2?.note].filter(Boolean).map((n) => "；" + n).join("") +
                  "；逐处来源见出现位置",
              ]
            : [],
      occurrences: [],
    };
    if (ra?.separate || rb2?.separate) {
      // Occurrences are listed one by one; nothing implies which page of one
      // version corresponds to which page of the other.
      // The line's occurrences with another text are context: listed for
      // checking, not counted in `repeat`.
      for (const u of ar ?? []) d.occurrences.push({ left: locations(u, "left"), right: [] });
      for (const u of ra?.others ?? []) d.occurrences.push({ left: locations(u, "left"), right: [], context: true });
      for (const u of br ?? []) d.occurrences.push({ left: [], right: locations(u, "right") });
      for (const u of rb2?.others ?? []) d.occurrences.push({ left: [], right: locations(u, "right"), context: true });
    } else if (ar || br) {
      for (let i = 0; i < Math.max(ar?.length ?? 0, br?.length ?? 0); i++)
        d.occurrences.push({
          left: locations(ar?.[i], "left"),
          right: locations(br?.[i], "right"),
        });
    }
    d.id =
      "d-" +
      digest({
        kind,
        old: d.oldText,
        new: d.newText,
        left: d.left.map((x) => x.charIds),
        right: d.right.map((x) => x.charIds),
      }).slice(0, 20);
    result.differences.push(d);
  }
  for (const p of pairs) {
    checkpoint?.();
    const moved =
      p.a.role === "body" &&
      (p.a.path.section !== p.b.path.section || !stable.has(p));
    emit(p.a, p.b, p.method, p.score, moved);
  }
  for (const [a, b] of singles) emit(a, b, "page-furniture", null);
  if (!exhausted) {
    for (const u of unmatchedL) if(!ambiguousL.has(u))emit(u, undefined, "unmatched", null);
    for (const u of unmatchedR) if(!ambiguousR.has(u))emit(undefined, u, "unmatched", null);
  }
  const position = (u: Unit) => {
    const r = u.refs.find(Boolean)!;
    return r.page.pageIndex * 1_000_000 + r.char.origin[1];
  };
  const anchorPairs = monotone(
    pairs.filter(
      (p) => p.a.refs[0] && p.b.refs[0] && p.a.path.confidence !== "unresolved",
    ),
    (p) => position(p.a),
    (p) => position(p.b),
    (p) => (p.method === "reliable-field-identity" ? 4 : 1),
  );
  for (const p of anchorPairs) {
    const a = p.a.refs.find(Boolean)!,
      b = p.b.refs.find(Boolean)!;
    result.alignment.push({
      leftPage: a.page.pageIndex,
      leftY: a.char.origin[1],
      rightPage: b.page.pageIndex,
      rightY: b.char.origin[1],
    });
  }
  const sourcePosition = (d: Difference) => {
    const l = d.left[0] ?? d.right[0];
    return l
      ? l.pageIndex * 1_000_000 +
          Math.min(l.quads[0][1], l.quads[0][3], l.quads[0][5], l.quads[0][7])
      : -1;
  };
  // Differences follow the document; nothing is ranked by what it changes.
  result.differences.sort(
    (a, b) => sourcePosition(a) - sourcePosition(b) || (a.id < b.id ? -1 : 1),
  );
  result.stats.differenceCount = result.differences.length;
  result.stats.occurrenceCount = result.differences.reduce(
    (n, d) => n + Math.max(1, d.occurrences.length),
    0,
  );
  if (result.coverage.length || result.unresolved.length)
    result.status = "partial";
  phase?.("done");
  return result;
}
export function search(
  doc: DocInput,
  query: string,
  side: "left" | "right",
  profile = aviationProfile,
): SourceLocation[][] {
  if (!query) return [];
  const hits: SourceLocation[][] = [];
  const needle = Array.from(query.normalize("NFKC"));
  for (const u of structure(doc, profile)) {
    const hay = Array.from(u.matchText);
    for (let i = 0; i <= hay.length - needle.length; i++)
      if (needle.every((c, j) => c === hay[i + j]))
        hits.push(
          sourceLocations(
            u.mapping
              .slice(i, i + needle.length)
              .flatMap((indexes) => indexes.map((n) => u.refs[n])),
            side,
            u.id,
          ),
        );
  }
  return hits;
}
