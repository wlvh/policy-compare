import type { DocInput, StructurePath } from "../contracts/index";
import type { Profile } from "../../profiles/aviation";
import { normalize, type Ref, type MappedText } from "./text";
export type Unit = MappedText & {
  id: string;
  order: number;
  role: string;
  path: StructurePath;
  identity: string | null;
  primary?: string;
  secondary?: string;
  tableRow?: string;
  /** Cell texts of a row recovered from one baseline, left to right. */
  rowCells?: string[];
  /** Horizontal extent of each recovered cell, in page units. */
  rowSpans?: [number, number][];
  /** Repeated page furniture: digit pattern, position and page numbering. */
  furniture?: Furniture;
  title: string;
};
export type Furniture = {
  pattern: string;
  /** Place of the repeated line: left and right edge and baseline. */
  x0: number;
  x1: number;
  y: number;
  pageNumber: boolean;
  /** Positions, among the line's numbers, of its page counter and page total. */
  pageTokens: number[];
};
const NUMBER = /\p{N}+(?:[.,]\p{N}+)*/gu;
/**
 * Page-number expressions: "Page 3", "Page 3 of 10" or "Page 3/10" anywhere in
 * a line. A number alone on its line ("3", "- 3 -", "3%"), even one counting
 * with the pages, is content: it may as well be a value or a record number.
 * An "of", a slash or a number that counts with the pages is not a page number
 * by itself.
 */
const PAGE_EXPRESSIONS = [/\bpage\s*(\p{N}+)(?:\s*(?:of|\/)\s*(\p{N}+))?/dgiu];
/**
 * Positions, among a line's numbers, of page counters and page totals. A
 * capture counts only when it is a whole number of the line: the "1" of
 * "Page 1.1" is not a page counter.
 */
export function pageSlots(text: string) {
  const spans = [...text.matchAll(NUMBER)].map((m) => `${m.index}:${m.index + m[0].length}`),
    counter: number[] = [],
    total: number[] = [];
  const at = (r: [number, number]) => spans.indexOf(`${r[0]}:${r[1]}`);
  for (const re of PAGE_EXPRESSIONS)
    for (const m of text.matchAll(re)) {
      const [, n, of] = m.indices!;
      if (at(n!) >= 0) counter.push(at(n!));
      if (of && at(of) >= 0) total.push(at(of));
    }
  return { counter, total };
}
/**
 * Text with its explicit "Page n" expressions left out. A line that is not
 * repeated furniture has no page counting to show that a bare number is one.
 */
export const withoutPageNumbers = (text: string) =>
  text.replace(PAGE_EXPRESSIONS[0], " ").trim();
/**
 * Furniture text with its whole page-number expressions ("Page n of N") left
 * out, but only those whose counter is a confirmed page token.
 */
export function withoutFurniturePages(text: string, f: Furniture) {
  const starts = [...text.matchAll(NUMBER)].map((m) => m.index),
    drop = new Set<number>();
  for (const re of PAGE_EXPRESSIONS)
    for (const m of text.matchAll(re))
      if (f.pageTokens.includes(starts.indexOf(m.indices![1]![0])))
        for (let i = m.index!; i < m.index! + m[0].length; i++) drop.add(i);
  return text
    .split("")
    .filter((_, i) => !drop.has(i))
    .join("");
}
/**
 * A line's raw text with its page numbers replaced, nothing else changed: the
 * confirmed page tokens of a repeated page line, or else the counter and total
 * of each explicit "Page n" expression.
 */
export function maskedPageNumbers(u: { rawText: string; furniture?: Furniture }) {
  if (u.furniture) {
    let k = 0;
    return u.rawText.replace(NUMBER, (n) => (u.furniture!.pageTokens.includes(k++) ? "#" : n));
  }
  // Only a capture that is a whole number of the line ("Page 1", not the "1"
  // of "Page 1.1").
  const whole = new Set([...u.rawText.matchAll(NUMBER)].map((m) => `${m.index}:${m.index + m[0].length}`));
  let out = "",
    at = 0;
  for (const m of u.rawText.matchAll(PAGE_EXPRESSIONS[0]))
    for (const r of m.indices!.slice(1))
      if (r && whole.has(`${r[0]}:${r[1]}`)) {
        out += u.rawText.slice(at, r[0]) + "#";
        at = r[1];
      }
  return out + u.rawText.slice(at);
}
/**
 * The variant of a repeated line that an occurrence is: its text with the page
 * counter read against the page it is on ("Page 3" on page 3 and "Page 4" on
 * page 4 are one variant, "Page 99" on page 3 another). The page total and
 * every other number stay as printed, as does a counter Number() cannot read.
 */
export function furnitureVariant(text: string, f: Furniture, page: number) {
  // Whitespace stays: a space added on one page is that page's own variant (r4416942422).
  const t = text,
    counter = pageSlots(t).counter;
  let k = 0;
  return t.replace(NUMBER, (n) => {
    const j = k++;
    // Only a counter printed plainly is read against its page; "Page 03"
    // stays as printed, its own variant beside "Page 3" (r4417060269).
    const value = Number(n);
    return f.pageTokens.includes(j) && counter.includes(j) && Number.isFinite(value) && n === String(value)
      ? `#${value - page}`
      : n;
  });
}
type Line = { p: DocInput["pages"][number]; refs: Ref[]; text: string };
const span = (g: Line) => {
  const xs = g.refs.flatMap((r) => [0, 2, 4, 6].map((k) => r.char.quad[k]));
  return [Math.min(...xs), Math.max(...xs)];
};
const top = (g: Line) => g.refs[0].char.origin[1];
const inMargin = (g: Line) =>
  top(g) < 0.16 * g.p.height || top(g) > 0.88 * g.p.height;
function documentLines(doc: DocInput) {
  const all = doc.pages.flatMap((p) => {
    const idx = new Map(p.chars.map((c) => [c.id, c]));
    return p.lines.map((l) => ({
      p,
      l,
      refs: l.charIds.map((id) => ({ char: idx.get(id)!, page: p, line: l })),
      text: l.charIds.map((id) => idx.get(id)!.text).join(""),
    }));
  });
  const separators = all.filter(
    (r) =>
      !r.text.trim() && r.refs.every((r) => r.char.provenance === "inferred"),
  );
  return { separators, lines: all.filter((r) => !separators.includes(r)) };
}
export type FurnitureSignature = Furniture;
/**
 * Page furniture is a line repeated at the same place in the top or bottom
 * band of at least three pages and 40% of a document. Digits are replaced
 * only to find candidates. Each number of the line must then stay the same on
 * every page or be the page counter of a page-number expression, counting with
 * the page; a constant number in the total place of that expression is the
 * page total. Any other changing number makes the line content. Only the
 * counter and total are page-number parts; other numbers, even one equal to
 * the page total or one that counts with the pages, are content.
 */
function signatures(lines: Line[], pageCount: number): FurnitureSignature[] {
  const need = Math.max(3, Math.ceil(0.4 * pageCount)),
    groups: (FurnitureSignature & { members: Line[] })[] = [];
  for (const g of lines) {
    if (!g.text.trim() || !inMargin(g)) continue;
    const pattern = g.text.trim().replace(/\p{N}+/gu, "#"),
      [x0, x1] = span(g),
      y = top(g);
    const group = groups.find(
      (c) =>
        c.pattern === pattern &&
        Math.abs(c.y - y) <= 2 &&
        (Math.abs(c.x0 - x0) <= 2 || Math.abs(c.x1 - x1) <= 2) &&
        !c.members.some((m) => m.p === g.p),
    );
    if (group) group.members.push(g);
    else groups.push({ pattern, x0, x1, y, pageNumber: false, pageTokens: [], members: [g] });
  }
  return groups.flatMap(({ members, ...c }) => {
    if (members.length < need) return [];
    // A number Number() cannot read (Arabic-Indic or full-width digits) is
    // NaN: it is the same on every page only as printed, and never counts.
    const printed = members.map((m) => m.text.match(NUMBER) ?? []),
      values = printed.map((ns) => ns.map((n) => Number(n.replace(/[.,]/g, "")))),
      positions = values[0].map((_, j) => j),
      slots = pageSlots(members[0].text.trim()),
      fixed = (j: number) =>
        printed.every((ns) => ns[j] === printed[0][j]) || values.every((v) => v[j] === values[0][j]),
      counters = positions.filter(
        (j) =>
          !fixed(j) &&
          slots.counter.includes(j) &&
          values.every((v) => Number.isFinite(v[j])) &&
          new Set(values.map((v, n) => v[j] - members[n].p.pageIndex)).size === 1,
      );
    if (positions.some((j) => !fixed(j) && !counters.includes(j))) return [];
    const pageTokens = positions.filter(
      (j) => counters.includes(j) || (counters.length > 0 && fixed(j) && slots.total.includes(j)),
    );
    return [{ ...c, pageNumber: counters.length > 0, pageTokens }];
  });
}
/** Furniture signatures of one document, shared with the other document. */
export function furnitureSignatures(doc: DocInput) {
  return signatures(documentLines(doc).lines, doc.pages.length);
}
/**
 * A margin line matching a signature of either document is furniture, so both
 * sides agree even when one has too few pages to show the repetition. A line
 * on a baseline with three or more clusters (a table row) is furniture only
 * when every line of that baseline is.
 */
function pageFurniture(lines: Line[], known: FurnitureSignature[]) {
  const found = new Map<Line, Furniture>();
  for (const g of lines) {
    if (!g.text.trim() || !inMargin(g)) continue;
    const pattern = g.text.trim().replace(/\p{N}+/gu, "#"),
      [x0, x1] = span(g),
      s = known.find(
        (c) =>
          c.pattern === pattern &&
          Math.abs(c.y - top(g)) <= 2 &&
          (Math.abs(c.x0 - x0) <= 2 || Math.abs(c.x1 - x1) <= 2),
      );
    if (s)
      found.set(g, {
        pattern,
        x0: s.x0,
        x1: s.x1,
        y: s.y,
        pageNumber: s.pageNumber,
        pageTokens: s.pageTokens,
      });
  }
  for (const g of [...found.keys()]) {
    const size = g.refs[0].char.size,
      mates = lines
        .filter((m) => m.p === g.p && m.text.trim() && Math.abs(top(m) - top(g)) < 0.3 * size)
        .sort((a, b) => span(a)[0] - span(b)[0]);
    let clusters = 1;
    for (let j = 1; j < mates.length; j++)
      if (span(mates[j])[0] - span(mates[j - 1])[1] > size) clusters++;
    if (clusters >= 3 && !mates.every((m) => found.has(m))) found.delete(g);
  }
  return found;
}
/**
 * A cell whose lines are centred on its row (LibreOffice, spreadsheets) has
 * lines above and below the row's baseline. Such a stack is consecutive in
 * extraction order, aligned and at line spacing; the line or placed stack just
 * before or after it in extraction order lies beside it on a baseline strictly
 * between its first and last line. Its lines are then placed on that baseline
 * for row recovery only.
 */
function centredCells(lines: Line[]) {
  const aligned = (a: Line, b: Line) => {
    const [a0, a1] = span(a),
      [b0, b1] = span(b);
    return Math.abs(a0 - b0) < 1 || Math.abs(a1 - b1) < 1 || Math.abs(a0 + a1 - b0 - b1) < 2;
  };
  const stacks: [number, number][] = [],
    stackOf = new Map<Line, number>();
  for (let i = 0, j = 1; i < lines.length; i = j, j = i + 1) {
    const size = lines[i].refs[0].char.size;
    if (!lines[i].text.trim()) continue;
    while (
      j < lines.length &&
      lines[j].p === lines[i].p &&
      lines[j].text.trim() &&
      aligned(lines[j], lines[i]) &&
      Math.abs(lines[j].refs[0].char.size - size) < 0.1 * size &&
      top(lines[j]) - top(lines[j - 1]) > 0.3 * size &&
      top(lines[j]) - top(lines[j - 1]) <= 1.6 * size
    )
      j++;
    if (j - i < 2) continue;
    for (let k = i; k < j; k++) stackOf.set(lines[k], stacks.length);
    stacks.push([i, j]);
  }
  const placed = new Map<Line, number>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const [i, j] of stacks) {
      if (placed.has(lines[i])) continue;
      const stack = lines.slice(i, j),
        size = stack[0].refs[0].char.size,
        x0 = Math.min(...stack.map((g) => span(g)[0])),
        x1 = Math.max(...stack.map((g) => span(g)[1]));
      for (const n of [lines[i - 1], lines[j]]) {
        const y = n && (placed.get(n) ?? (stackOf.has(n) ? undefined : top(n)));
        if (
          y === undefined ||
          n.p !== stack[0].p ||
          !n.text.trim() ||
          y <= top(stack[0]) + 0.3 * size ||
          y >= top(stack.at(-1)!) - 0.3 * size ||
          !(span(n)[1] < x0 || span(n)[0] > x1)
        )
          continue;
        for (const g of stack) placed.set(g, y);
        changed = true;
        break;
      }
    }
  }
  return placed;
}
export function structure(
  doc: DocInput,
  profile: Profile,
  checkpoint?: () => void,
  shared: FurnitureSignature[] = [],
): Unit[] {
  const units: Unit[] = [];
  let section = "risk_details",
    fieldSection = "risk_details",
    subject: string | null = null,
    title = "";
  let active: Unit | null = null;
  const { lines, separators } = documentLines(doc);
  const furniture = pageFurniture(lines, [
    ...signatures(lines, doc.pages.length),
    ...shared,
  ]);
  function add(
    refs: (Ref | null)[],
    role: string,
    field: string | null = null,
    entity: string | null = null,
    identity: string | null = null,
    customSection = section,
  ): Unit {
    let raw = "";
    const mapped: (Ref | null)[] = [];
    for (const r of refs) {
      raw += r ? r.char.text : " ";
      for (const _ of Array.from(r ? r.char.text : " ")) mapped.push(r);
    }
    const unit: Unit = {
      ...normalize(raw, mapped),
      id: `u${units.length}`,
      order: units.length,
      role,
      title,
      path: {
        section: customSection,
        entity,
        field,
        table: null,
        rowKey: null,
        confidence: identity ? "reliable" : "candidate",
      },
      identity,
    };
    units.push(unit);
    return unit;
  }
  function append(unit: Unit, refs: Ref[]) {
    const raw = unit.rawText + " " + refs.map((r) => r.char.text).join("");
    const all = [
      ...unit.refs,
      null,
      ...refs.flatMap((r) => Array.from(r.char.text).map(() => r)),
    ];
    Object.assign(unit, normalize(raw, all));
  }
  const consumed = new Set<(typeof lines)[number]>(),
    position = new Map(lines.map((g, n) => [g, n])),
    centred = centredCells(lines),
    baseline = (g: (typeof lines)[number]) => centred.get(g) ?? top(g);
  for (let i = 0; i < lines.length; i++) {
    checkpoint?.();
    const row = lines[i],
      text = row.text.trim();
    if (consumed.has(row)) continue;
    if (!text) {
      add(row.refs, "whitespace");
      continue;
    }
    const y = row.refs[0]?.char.origin[1] ?? 0;
    if (
      profile.table.headers.every((h, j) => lines[i + j]?.text.trim() === h)
    ) {
      section = profile.table.name;
      active = null;
      for (let j = 0; j < profile.table.headers.length; j++)
        add(
          lines[i + j].refs,
          "table_header",
          profile.table.columns[j],
          null,
          `table_header/${profile.table.columns[j]}`,
        );
      i += profile.table.headers.length - 1;
      continue;
    }
    const isTop = y < 110,
      isFooter = y > row.p.height - 50;
    // Amounts, dates, registrations and clause codes are not headings, even in
    // capitals; outline numbers such as "2.1", alone or after SECTION or
    // CHAPTER, still are.
    const rest = text.replace(/^(?:SECTION|CHAPTER)\s+\d{1,2}(?:\.\d{1,2})*\.?(?=[\s:]|$)/u, ""),
      letters = (rest.match(/\p{L}/gu) ?? []).length,
      digits = (rest.match(/\p{N}/gu) ?? []).length,
      codeLike =
        !/^\d{1,2}(?:\.\d{1,2})*\.?$/u.test(text) &&
        (/\p{L}\p{N}|\p{N}\p{L}/u.test(rest) ||
          (digits > 0 && digits >= 0.3 * (letters + digits)));
    const heading =
      /^[\p{Lu}\d][\p{Lu}\d\s:&/().,-]{2,}$/u.test(text) &&
      text.length < 100 &&
      !codeLike;
    // Explicit chapter ownership outranks the page-position heuristic. A real
    // SECTION heading can be near the top of a page without being mere chrome.
    if (heading && /^(SECTION|CHAPTER)\s+\S/u.test(text)) {
      section = fieldSection = text;
      subject = null;
      title = text;
      active = null;
      add(row.refs, "heading");
      continue;
    }
    const label = Object.keys(profile.fields)
      .sort((a, b) => b.length - a.length)
      .find((k) => text.startsWith(k));
    if (label) {
      const field = profile.fields[label];
      if (profile.subjects[label]) subject = profile.subjects[label];
      const entity = profile.subjectFields.includes(field) ? subject : null;
      const sc = field === "header_limit" ? "repeated_header" : fieldSection;
      const key = `${sc}/${entity ?? ""}/${field}`;
      const n = Array.from(label).length;
      add(
        row.refs.slice(0, n),
        "label",
        field + ".label",
        entity,
        key + ".label",
        sc,
      );
      if (row.text.length > label.length) {
        active = add(row.refs.slice(n), "field", field, entity, key, sc);
        // A declared header that is also repeated page furniture keeps its
        // page counter, read against its page like the line it comes from
        // (r4418530241).
        const f = furniture.get(row);
        if (f) {
          const before = (label.match(NUMBER) ?? []).length;
          active.furniture = { ...f, pageTokens: f.pageTokens.map((j) => j - before).filter((j) => j >= 0) };
        }
      } else {
        const next = lines[i + 1];
        if (
          next &&
          !consumed.has(next) &&
          next.p === row.p &&
          Math.abs(next.refs[0].char.origin[1] - y) < row.refs[0].char.size
        ) {
          active = add(next.refs, "field", field, entity, key, sc);
          // A value on a line of its own keeps that line's page counter too
          // (r4419941396).
          const f = furniture.get(next);
          if (f) active.furniture = f;
          i++;
        } else active = null;
      }
      continue;
    }
    const repeated = furniture.get(row);
    if (repeated) {
      add(row.refs, "furniture", null, null, null, "page_furniture").furniture =
        repeated;
      continue;
    }
    if (isTop || isFooter) {
      const previous = units.at(-1),
        last = previous?.refs.find(Boolean);
      if (
        isFooter &&
        previous?.role === "footer" &&
        last?.page === row.p &&
        Math.abs(last.char.origin[1] - y) < 1
      )
        append(previous, row.refs);
      else add(row.refs, isFooter ? "footer" : "page_heading");
      continue;
    }
    if (Math.abs(row.l.direction[1]) > 0.15) {
      add(row.refs, "status", "status", null, "document/status", "document");
      active = null;
      continue;
    }
    if (section === profile.table.name) {
      const group = lines.slice(i, i + profile.table.columns.length);
      if (
        group.length === profile.table.columns.length &&
        group.every(
          (g) => g.p === row.p && Math.abs(g.refs[0].char.origin[1] - y) < 2,
        ) &&
        group[0].text !== profile.table.headers[0]
      ) {
        const primary = group[0].text.trim(),
          secondary = group[1].text.trim();
        for (let j = 0; j < group.length; j++) {
          const u = add(
            group[j].refs,
            "cell",
            profile.table.columns[j],
            secondary,
            null,
          );
          u.primary = primary;
          u.secondary = secondary;
          u.tableRow = `${row.p.pageIndex}/${i}`;
          u.path.table = profile.table.name;
          u.path.rowKey = secondary;
          u.path.confidence = "candidate";
        }
        i += group.length - 1;
        active = null;
        continue;
      }
    }
    // Three or more clearly separated text clusters on one baseline form a row.
    // Clusters, not extraction items, are counted: a font switch inside a
    // sentence leaves no gap. Cells keep their characters; nothing is split.
    // A wrapped cell's next line may be extracted between the row's cells, so
    // the row is gathered from a short window below its baseline, and a wrapped
    // line is joined to its cell only when it sits directly under the cell,
    // aligned with it, in the same type size.
    if (section !== profile.table.name) {
      const size = row.refs[0].char.size,
        level = baseline(row);
      // Lines an earlier row took are passed over: a table extracted column by
      // column lists this row's cells after the cells above them (r4421114827).
      let end = i + 1;
      while (
        end < lines.length &&
        lines[end].p === row.p &&
        (consumed.has(lines[end]) ||
          (lines[end].text.trim() &&
            baseline(lines[end]) > level - 0.3 * size &&
            baseline(lines[end]) - level < 4 * size))
      )
        end++;
      const window = lines
        .slice(i, end)
        .filter((g) => !consumed.has(g) && !furniture.has(g));
      const members = window.filter((g) => Math.abs(baseline(g) - level) < 0.3 * size);
      if (members.length >= 3) {
        const group = members.sort((a, b) => span(a)[0] - span(b)[0]);
        const cells = [[group[0]]];
        for (let j = 1; j < group.length; j++)
          if (span(group[j])[0] - span(group[j - 1])[1] > size)
            cells.push([group[j]]);
          else cells.at(-1)!.push(group[j]);
        // Lines of one cell read top to bottom.
        for (const c of cells) c.sort((a, b) => top(a) - top(b) || span(a)[0] - span(b)[0]);
        if (cells.length >= 3) {
          const bounds = cells.map((c) => [span(c[0])[0], span(c.at(-1)!)[1]]);
          const column = (g: (typeof lines)[number]) => {
            const [x0, x1] = span(g),
              k = bounds.findIndex(
                ([a], n) =>
                  x0 > a - 1 &&
                  x1 < (bounds[n + 1]?.[0] ?? Infinity) &&
                  cells[n].some((m) => {
                    const [m0, m1] = span(m);
                    return (
                      Math.abs(x0 - m0) < 1 ||
                      Math.abs(x1 - m1) < 1 ||
                      Math.abs(x0 + x1 - m0 - m1) < 2
                    );
                  }),
              );
            return Math.abs(g.refs[0].char.size - size) < 0.1 * size ? k : -1;
          };
          // A wrapped line directly follows, in extraction order, the line above
          // it in the same cell; the next row's first cell follows another column.
          // A line whose baseline holds a row of its own (three clusters, as above)
          // is that row's cell, though a table extracted column by column puts it
          // right after the cell above it (r4421114827).
          const wrapped = cells.map(() => [] as (typeof lines)[number][]),
            owner = new Map(cells.flatMap((c, k) => c.map((g) => [g, k] as const)));
          const ownRow = (g: (typeof lines)[number]) => {
            const level = baseline(g),
              xs = lines
                .filter((m) => m.p === g.p && !furniture.has(m) && m.text.trim() && Math.abs(baseline(m) - level) < 0.3 * size)
                .map(span)
                .sort((a, b) => a[0] - b[0]);
            return xs.filter((x, j) => j === 0 || x[0] - Math.max(...xs.slice(0, j).map((y) => y[1])) > size).length >= 3;
          };
          for (const g of window) {
            const k = column(g),
              previous = lines[position.get(g)! - 1];
            if (
              owner.has(g) ||
              k < 0 ||
              owner.get(previous) !== k ||
              top(g) - top(previous) < 0.3 * size ||
              top(g) - top(previous) > 1.6 * size ||
              ownRow(g)
            )
              continue;
            wrapped[k].push(g);
            owner.set(g, k);
          }
          const parts = cells.map((c, k) => [...c, ...wrapped[k]]);
          for (const g of parts.flat()) consumed.add(g);
          const u = add(
            parts.flat().flatMap((g, j) => (j ? [null, ...g.refs] : g.refs)),
            "body",
          );
          u.rowCells = parts.map((c) => c.map((g) => g.text.trim()).join(" "));
          u.rowSpans = parts.map((c) => [
            Math.min(...c.map((g) => span(g)[0])),
            Math.max(...c.map((g) => span(g)[1])),
          ]);
          u.path.table = "recovered_rows";
          active = null;
          continue;
        }
      }
    }
    if (heading) {
      title = text;
      if (/^(SECTION|CHAPTER)\b/.test(text)) section = text;
      else if (section === "risk_details") section = "clauses";
      else if (section === profile.table.name)
        section = "after_aircraft_schedule";
      add(row.refs, "heading");
      active = null;
      continue;
    }
    if (active && active.role === "field" && row.refs[0].char.origin[0] > 120) {
      append(active, row.refs);
      continue;
    }
    // A vertical gap well above the line height on the same page ends a
    // paragraph; across a page break, so does a finished sentence.
    const previous = active?.refs.findLast(Boolean);
    if (
      active &&
      active.role === "body" &&
      active.title === title &&
      !(
        previous &&
        previous.page === row.p &&
        y - previous.char.origin[1] > 1.6 * row.refs[0].char.size
      ) &&
      !(previous && previous.page !== row.p && /[.;]$/u.test(active.rawText.trimEnd()))
    ) {
      append(active, row.refs);
      continue;
    }
    active = add(row.refs, "body");
  }
  for (const separator of separators) add(separator.refs, "logical_separator");
  const owners=new Map<string,string>();
  for(const unit of units)for(const ref of unit.refs)if(ref){const owner=owners.get(ref.char.id);if(owner&&owner!==unit.id)throw new Error('Character assigned to multiple primary units');owners.set(ref.char.id,unit.id);}
  if(owners.size!==doc.pages.reduce((n,p)=>n+p.chars.length,0))throw new Error('Character conservation failed');
  return units;
}
