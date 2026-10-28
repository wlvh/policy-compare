import {
  VERSION,
  digest,
  snapshotDigest,
  type CompareResult,
  type Difference,
  type DocInput,
  type SourceLocation,
} from "../contracts/index";
import { aviationProfile, type Profile } from "../../profiles/aviation";
import {
  furnitureContent,
  furnitureSignatures,
  structure,
  type Unit,
} from "./structure";
import { normalize, sourceLocations, tokenize, lcsLength } from "./text";
import { monotone, jointAlign } from "./alignment";
export { structure } from "./structure";
export type Budget = Profile["budget"];
type Pair = { a: Unit; b: Unit; method: string; score: number | null };
/**
 * An aggregate of repeated occurrences. `repeats` are the card's occurrences
 * on its side; `others` are occurrences of the same repeated line on that side
 * that kept a different text; `separate` lists both sides' occurrences one by
 * one instead of side by side; `note` explains a version whose text varies.
 */
type Repeated = Unit & {
  repeats?: Unit[];
  others?: Unit[];
  separate?: boolean;
  note?: string;
};
const content = (u: Unit) =>
  u.furniture ? furnitureContent(u.rawText, u.furniture) : u.rawText.trim();
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
const valueLike = (cell: string) =>
  /%|\d[.,]\d|\b(?:USD|EUR|GBP)\b|[$€£]|\d{1,2}\/\d{1,2}\/\d{2,4}/u.test(cell);
const counter = (cell: string) => {
  const m = cell.match(/^\D{0,8}?(\d{1,4})\.?$/u);
  return m ? Number(m[1]) : null;
};
/**
 * Rows recovered from one baseline pair only through identity evidence. Identity
 * cells are the non-value cells of a row (amounts, shares and dates are compared,
 * never used as identity); a first column counting 0..n or 1..n is a row number.
 * A cell whose column in the recovered row and text are unique within the same
 * table on both sides links two rows. A row linked to exactly one row binds; rows whose links
 * conflict stay unresolved together. Rows are never paired by text similarity.
 */
function rowIdentity(
  left: Unit[],
  right: Unit[],
  usedL: Set<Unit>,
  usedR: Set<Unit>,
  bind: (a: Unit, b: Unit, method: string) => void,
  result: CompareResult,
) {
  const tables = (us: Unit[]) => {
    const m = new Map<string, Unit[]>();
    for (const u of us)
      if (u.rowCells) {
        const t = u.path.section + "\u0000" + u.title;
        m.set(t, [...(m.get(t) ?? []), u]);
      }
    return m;
  };
  const counting = (rows: Unit[]) => {
    const n = rows
      .map((r) => counter(r.rowCells![0]))
      .filter((x): x is number => x !== null);
    return n.length >= 2 && n[0] <= 1 && n.every((x, i) => x === n[0] + i);
  };
  const owners = (rows: Unit[], numbered: boolean) => {
    const m = new Map<string, Unit[]>();
    for (const r of rows) {
      const cells =
        numbered && counter(r.rowCells![0]) !== null
          ? r.rowCells!.slice(1)
          : r.rowCells!;
      // The key keeps the cell's column in the recovered row, counted before
      // value cells are left out, so the same text in another column of a
      // different record is not identity evidence.
      cells
        .map((c, k) => [k, c.normalize("NFKC")] as const)
        .filter(([, c]) => c.length >= 2 && !valueLike(c))
        .forEach(([k, c]) => {
          const key = k + "\u0000" + c;
          m.set(key, [...(m.get(key) ?? []), r]);
        });
    }
    return m;
  };
  const lt = tables(left),
    rt = tables(right);
  const links = new Map<Unit, Set<Unit>>(),
    via = new Map<Unit, string>();
  for (const [t, rows] of lt) {
    const others = rt.get(t);
    if (!others) continue;
    const numbered = counting(rows) || counting(others);
    const ro = owners(others, numbered);
    for (const [key, as] of owners(rows, numbered)) {
      const bs = ro.get(key);
      if (as.length !== 1 || bs?.length !== 1) continue;
      if (usedL.has(as[0]) || usedR.has(bs[0])) continue;
      links.set(as[0], (links.get(as[0]) ?? new Set()).add(bs[0]));
      links.set(bs[0], (links.get(bs[0]) ?? new Set()).add(as[0]));
      if (!via.has(as[0])) via.set(as[0], key.split("\u0000")[1]);
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
      as[0].path.rowKey = bs[0].path.rowKey = via.get(as[0]) ?? null;
      bind(as[0], bs[0], "row-identity");
      continue;
    }
    const x = aggregate(as, "row-conflict-left-" + as[0].id, true),
      y = aggregate(bs, "row-conflict-right-" + bs[0].id, true);
    bind(x, y, "unresolved-row-identity");
    as.forEach((u) => usedL.add(u));
    bs.forEach((u) => usedR.add(u));
    result.unresolved.push({
      reason: "ambiguous_identity",
      message:
        "表格行的身份证据互相冲突（例如编号与名称指向不同行）；未自动配对，组内原文变化仍展示",
      left: locations(x, "left"),
      right: locations(y, "right"),
      defaultVisible: true,
    });
  }
}
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
  const matches = [...text.matchAll(/(\d{1,2}) ([A-Za-z]+) (\d{4})/g)];
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
function category(
  a: Unit | undefined,
  b: Unit | undefined,
): Difference["category"] {
  const u = b ?? a!;
  // Only confirmed page-number parts are cosmetic; any other change in
  // repeated furniture is Review, and Material when it carries an amount.
  if (u.role === "furniture") {
    const texts = [a, b].filter((x): x is Unit => !!x).map(content);
    if (a && b ? texts[0] === texts[1] || a.matchText === b.matchText
        : u.furniture?.pageNumber && !/\p{N}/u.test(texts[0]))
      return "Cosmetic";
    return valueLike(texts.join(" ")) ? "Material" : "Review";
  }
  if (
    [
      "label",
      "page_heading",
      "footer",
      "heading",
      "table_header",
      "whitespace",
    ].includes(u.role)
  )
    return "Cosmetic";
  if (a && b && a.matchText === b.matchText) return "Cosmetic";
  if (a && b && u.path.field === "policy_period") {
    const old = datePeriod(a.rawText),
      now = datePeriod(b.rawText);
    if (old && now) {
      const oneDay = 86400000;
      const annual = (v: [number, number]) => {
        const s = new Date(v[0]),
          e = new Date(v[1] + oneDay);
        return (
          e.getUTCFullYear() === s.getUTCFullYear() + 1 &&
          e.getUTCMonth() === s.getUTCMonth() &&
          e.getUTCDate() === s.getUTCDate()
        );
      };
      const withoutDates=(text:string)=>text.replace(/\d{1,2} [A-Za-z]+ \d{4}/g,'<date>');
      if (annual(old) && annual(now) && now[0] === old[1] + oneDay &&
          withoutDates(a.rawText)===withoutDates(b.rawText))
        return "RollForward";
    }
    return "Material";
  }
  if (u.path.confidence === "unresolved") return "Review";
  if (
    u.path.field ||
    /\b(?:not|cover|exclud|loss|liability|and|or)\b|\d|[±☑☐]/i.test(
      (a?.rawText ?? "") + (b?.rawText ?? ""),
    )
  )
    return "Material";
  return "Review";
}
function textOps(
  a: Unit | undefined,
  b: Unit | undefined,
  budget: Budget,
  result: CompareResult,
): Difference["textOps"] {
  const aa = Array.from(a?.rawText ?? ""),
    bb = Array.from(b?.rawText ?? "");
  let prefix = 0;
  while (prefix < aa.length && prefix < bb.length && aa[prefix] === bb[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < aa.length - prefix &&
    suffix < bb.length - prefix &&
    aa[aa.length - 1 - suffix] === bb[bb.length - 1 - suffix]
  )
    suffix++;
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
  if (x.length * y.length > budget.diffProducts) {
    result.unresolved.push({
      reason: "word_diff_budget",
      message: "词级差异工作量超过上限；保留双方完整原文，定位降级",
      left: locations(a, "left"),
      right: locations(b, "right"),
      defaultVisible: true,
    });
    for (let i = 0; i < x.length; i++)
      ops.push({ kind: "delete", i: prefix + i, j: prefix, text: x[i] });
    for (let j = 0; j < y.length; j++)
      ops.push({ kind: "insert", i: prefix, j: prefix + j, text: y[j] });
  } else {
    const width = y.length + 1,
      dp = new Uint32Array((x.length + 1) * width);
    for (let i = x.length - 1; i >= 0; i--)
      for (let j = y.length - 1; j >= 0; j--)
        dp[i * width + j] =
          x[i] === y[j]
            ? 1 + dp[(i + 1) * width + j + 1]
            : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    let i = 0,
      j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        ops.push({ kind: "equal", i: prefix + i, j: prefix + j, text: x[i] });
        i++;
        j++;
      } else if (
        i < x.length &&
        (j === y.length || dp[(i + 1) * width + j] >= dp[i * width + j + 1])
      ) {
        ops.push({
          kind: "delete",
          i: prefix + i++,
          j: prefix + j,
          text: x[i - 1],
        });
      } else {
        ops.push({
          kind: "insert",
          i: prefix + i,
          j: prefix + j++,
          text: y[j - 1],
        });
      }
    }
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
    schemaVersion: VERSION,
    coreVersion: VERSION + "+row-identity.3",
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
  phase?.("matching");
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
    ir = map(rb, usedR, (u) => u.identity);
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
      // Repeated headers retain all locations; differing content is never discarded.
      const a = aggregate(as, "repeat-left-" + key),
        b = aggregate(bs, "repeat-right-" + key);
      if (
        new Set(as.map((u) => u.rawText)).size === 1 &&
        new Set(bs.map((u) => u.rawText)).size === 1
      ) {
        a.rawText = as[0].rawText;
        a.refs = as[0].refs;
        b.rawText = bs[0].rawText;
        b.refs = bs[0].refs;
        Object.assign(a, normalize(a.rawText, a.refs));
        Object.assign(b, normalize(b.rawText, b.refs));
      }
      bind(a, b, "repeated-header");
      as.forEach((u) => usedL.add(u));
      bs.forEach((u) => usedR.add(u));
      (a as Unit & { repeats?: Unit[] }).repeats = as;
      (b as Unit & { repeats?: Unit[] }).repeats = bs;
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
    u.furniture ? `${u.furniture.pattern}\u0000${u.furniture.y}` : null;
  const pageList = (us: Unit[]) =>
    us.map((u) => u.refs.find(Boolean)!.page.pageIndex + 1).join("、");
  // One repeated line of both versions. Occurrences whose text is the same,
  // page-number parts aside, form one group per version, and a text found in
  // both versions is unchanged. Any other text is a variant; its counterpart is
  // known only when the other version has a single text throughout, otherwise
  // it is shown as added or removed. Same page numbers never pair occurrences.
  const compareRepeated = (as: Unit[], bs: Unit[]) => {
    const texts = (us: Unit[]) => {
      const m = new Map<string, Unit[]>();
      for (const u of us) m.set(content(u), [...(m.get(content(u)) ?? []), u]);
      return m;
    };
    const L = texts(as),
      R = texts(bs);
    if (L.size === 1 && R.size === 1) {
      bind(
        repeated(as, "furniture-left-" + as[0].id),
        repeated(bs, "furniture-right-" + bs[0].id),
        "page-furniture",
      );
      return;
    }
    for (const [own, other, isRight] of [
      [R, L, true],
      [L, R, false],
    ] as const) {
      const [name, otherName] = isRight ? ["待审版", "基准版"] : ["基准版", "待审版"];
      const unchanged = [...own].filter(([t]) => other.has(t)).flatMap(([, us]) => us);
      for (const [text, us] of own) {
        if (other.has(text)) continue;
        const kept = other.size === 1 ? [...other.values()][0] : null;
        const note =
          `本版组内文字不一致：${name}第 ${pageList(us)} 页为${isRight ? "新" : "旧"}文字` +
          (kept
            ? unchanged.length
              ? `；${name}第 ${pageList(unchanged)} 页仍为${otherName}文字“${kept[0].rawText.trim()}”`
              : ""
            : `，${otherName}没有相同文字`);
        const variant = repeated(us, `furniture-${isRight ? "right" : "left"}-${us[0].id}`, {
          others: unchanged,
          separate: true,
          note,
        });
        if (!kept) singles.push(isRight ? [undefined, variant] : [variant, undefined]);
        else {
          const whole = repeated(kept, `furniture-${isRight ? "left" : "right"}-${kept[0].id}`);
          isRight
            ? bind(whole, variant, "page-furniture")
            : bind(variant, whole, "page-furniture");
        }
      }
    }
  };
  const lf = map(la, usedL, furnitureKey),
    rf = map(rb, usedR, furnitureKey),
    lone = { left: [] as Unit[], right: [] as Unit[] };
  for (const [, as] of lf) {
    const f = as[0].furniture!,
      [key, bs] =
        [...rf]
          .filter(([, bs]) => bs[0].furniture!.pattern === f.pattern && Math.abs(bs[0].furniture!.y - f.y) <= 12)
          .sort(([, x], [, y]) => Math.abs(x[0].furniture!.y - f.y) - Math.abs(y[0].furniture!.y - f.y))[0] ?? [];
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
    const texts = new Map<string, Unit[]>();
    for (const u of lone[side])
      texts.set(u.rawText.trim(), [...(texts.get(u.rawText.trim()) ?? []), u]);
    for (const [text, group] of texts) {
      for (const u of us)
        if (!used.has(u) && u.rawText.trim() === text && margin(u)) {
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
  // A digit-free row repeated on several pages of a table is its header. An
  // occurrence count that pagination does not explain is shown on the card.
  const headerKey = (u: Unit) =>
    u.rowCells && !/\p{N}/u.test(u.rawText)
      ? `${u.path.section}\u0000${u.title}\u0000${u.rawText}`
      : null;
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
      ? `${u.role}/${u.rowCells ? `${u.path.section}\u0000${u.title}\u0000` : ""}${u.rawText}`
      : null;
  const el = map(la, usedL, rawKey),
    er = map(rb, usedR, rawKey);
  for (const [key, as] of el) {
    checkpoint?.();
    const bs = er.get(key);
    if (!bs) continue;
    if (as.length === 1 && bs.length === 1) bind(as[0], bs[0], "unique-exact");
    else if (
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
          ).length === 1
        )
          bind(a, candidates[0], "exact-context");
      }
    }
  }
  rowIdentity(la, rb, usedL, usedR, bind, result);
  // Adjacent split/merge candidates are evaluated before fuzzy 1:1 locks.
  for (const [source, target, su, tu, reverse] of [
    [la, rb, usedL, usedR, false],
    [rb, la, usedR, usedL, true],
  ] as const) {
    for (const a of source.filter((u) => !su.has(u) && u.role === "body"))
      for (let j = 0; j < target.length - 1; j++) {
        const b = target[j],
          c = target[j + 1];
        if (
          tu.has(b) ||
          tu.has(c) ||
          b.role !== "body" ||
          c.role !== "body" ||
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
    // Repeated text present on fewer pages than pagination explains is shown.
    const dropped =
      !!ar &&
      !!br &&
      Math.abs(ar.length - br.length) >
        Math.abs(left.pages.length - right.pages.length);
    if (a && b && a.rawText === b.rawText && !moved && !dropped) return;
    const furniture = (a ?? b!).role === "furniture",
      pages = (us?: Unit[]) =>
        new Set(us?.map((u) => u.refs.find(Boolean)!.page.pageIndex)).size;
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
      category: moved && a?.rawText === b?.rawText ? "Review" : category(a, b),
      structurePath: (a ?? b!).path,
      left: locations(a, "left"),
      right: locations(b, "right"),
      oldText: a?.rawText ?? "",
      newText: b?.rawText ?? "",
      textOps: textOps(a, b, budget, result),
      hasTextChange: a?.rawText !== b?.rawText,
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
          : furniture
            ? [
                `页面附属：跨页重复的${a && b && content(a) === content(b) ? "页码" : "页眉页脚文字"}，基准 ${pages(ar)} 页、待审 ${pages(br)} 页${a ? (b ? "" : "，仅基准版有") : "，仅待审版有"}` +
                  [ra?.note, rb2?.note].filter(Boolean).map((n) => "；" + n).join("") +
                  "；逐处来源见出现位置",
              ]
            : [],
      occurrences: [],
    };
    if (ra?.separate || rb2?.separate) {
      // Occurrences are listed one by one; nothing implies which page of one
      // version corresponds to which page of the other.
      for (const u of [...(ar ?? []), ...(ra?.others ?? [])])
        d.occurrences.push({ left: locations(u, "left"), right: [] });
      for (const u of [...(br ?? []), ...(rb2?.others ?? [])])
        d.occurrences.push({ left: [], right: locations(u, "right") });
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
  result.differences.sort(
    (a, b) =>
      ({ Material: 0, Review: 1, RollForward: 2, Cosmetic: 3 })[a.category] -
        { Material: 0, Review: 1, RollForward: 2, Cosmetic: 3 }[b.category] ||
      sourcePosition(a) - sourcePosition(b) ||
      (a.id < b.id ? -1 : 1),
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
