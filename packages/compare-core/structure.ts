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
  title: string;
};
export function structure(doc: DocInput, profile: Profile,checkpoint?:()=>void): Unit[] {
  const units: Unit[] = [];
  let section = "risk_details",
    fieldSection = "risk_details",
    subject: string | null = null,
    title = "";
  let active: Unit | null = null;
  const allLines = doc.pages.flatMap((p) => {
    const idx = new Map(p.chars.map((c) => [c.id, c]));
    return p.lines.map((l) => ({
      p,
      l,
      refs: l.charIds.map((id) => ({ char: idx.get(id)!, page: p, line: l })),
      text: l.charIds.map((id) => idx.get(id)!.text).join(""),
    }));
  });
  const separators = allLines.filter(
    (r) =>
      !r.text.trim() && r.refs.every((r) => r.char.provenance === "inferred"),
  );
  const lines = allLines.filter((r) => !separators.includes(r));
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
    position = new Map(lines.map((g, n) => [g, n]));
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
    // capitals; outline numbers such as "2.1" still are.
    const letters = (text.match(/\p{L}/gu) ?? []).length,
      digits = (text.match(/\p{N}/gu) ?? []).length,
      codeLike =
        !/^\d{1,2}(?:\.\d{1,2})*\.?$/u.test(text) &&
        (/\p{L}\p{N}|\p{N}\p{L}/u.test(text) ||
          digits >= 0.3 * (letters + digits));
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
      } else {
        const next = lines[i + 1];
        if (
          next &&
          !consumed.has(next) &&
          next.p === row.p &&
          Math.abs(next.refs[0].char.origin[1] - y) < row.refs[0].char.size
        ) {
          active = add(next.refs, "field", field, entity, key, sc);
          i++;
        } else active = null;
      }
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
        top = (g: (typeof lines)[number]) => g.refs[0].char.origin[1];
      let end = i + 1;
      while (
        end < lines.length &&
        lines[end].p === row.p &&
        lines[end].text.trim() &&
        top(lines[end]) > y - 0.3 * size &&
        top(lines[end]) - y < 4 * size
      )
        end++;
      const window = lines.slice(i, end).filter((g) => !consumed.has(g));
      const members = window.filter((g) => Math.abs(top(g) - y) < 0.3 * size);
      if (members.length >= 3) {
        const span = (g: (typeof lines)[number]) => {
          const xs = g.refs.flatMap((r) => [0, 2, 4, 6].map((k) => r.char.quad[k]));
          return [Math.min(...xs), Math.max(...xs)];
        };
        const group = members.sort((a, b) => span(a)[0] - span(b)[0]);
        const cells = [[group[0]]];
        for (let j = 1; j < group.length; j++)
          if (span(group[j])[0] - span(group[j - 1])[1] > size)
            cells.push([group[j]]);
          else cells.at(-1)!.push(group[j]);
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
          const wrapped = cells.map(() => [] as (typeof lines)[number][]),
            owner = new Map(cells.flatMap((c, k) => c.map((g) => [g, k] as const)));
          for (const g of window) {
            const k = column(g),
              previous = lines[position.get(g)! - 1];
            if (
              owner.has(g) ||
              k < 0 ||
              owner.get(previous) !== k ||
              top(g) - top(previous) < 0.3 * size ||
              top(g) - top(previous) > 1.6 * size
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
    // A vertical gap well above the line height on the same page ends a paragraph.
    const previous = active?.refs.findLast(Boolean);
    if (
      active &&
      active.role === "body" &&
      active.title === title &&
      !(
        previous &&
        previous.page === row.p &&
        y - previous.char.origin[1] > 1.6 * row.refs[0].char.size
      )
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
