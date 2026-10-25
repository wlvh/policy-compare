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
  title: string;
};
export function structure(doc: DocInput, profile: Profile,checkpoint?:()=>void): Unit[] {
  const units: Unit[] = [];
  let section = "risk_details",
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
  for (let i = 0; i < lines.length; i++) {
    checkpoint?.();
    const row = lines[i],
      text = row.text.trim();
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
    const label = Object.keys(profile.fields)
      .sort((a, b) => b.length - a.length)
      .find((k) => text.startsWith(k));
    if (label) {
      const field = profile.fields[label];
      if (profile.subjects[label]) subject = profile.subjects[label];
      const entity = profile.subjectFields.includes(field) ? subject : null;
      const sc = field === "header_limit" ? "repeated_header" : "risk_details";
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
    const heading =
      /^[\p{Lu}\d][\p{Lu}\d\s:&/().,-]{2,}$/u.test(text) && text.length < 100;
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
    if (active && active.role === "body" && active.title === title) {
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
