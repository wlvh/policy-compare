use crate::{model::*, text::*};
use serde_json::json;
#[derive(Clone, Debug)]
pub struct Furniture {
    pub pattern: String,
    pub x0: f64,
    pub x1: f64,
    pub y: f64,
    pub page_number: bool,
    pub page_tokens: Vec<usize>,
}
#[derive(Clone, Debug)]
pub struct Unit {
    pub m: Mapped,
    pub id: String,
    pub order: usize,
    pub role: String,
    pub path: V,
    pub identity: Option<String>,
    pub primary: Option<String>,
    pub secondary: Option<String>,
    pub table_row: Option<String>,
    pub cells: Option<Vec<String>>,
    pub spans: Vec<[f64; 2]>,
    pub ambiguous: bool,
    pub furniture: Option<Furniture>,
    pub title: String,
    pub repeats: Option<Vec<Unit>>,
    pub others: Vec<Unit>,
    pub separate: bool,
    pub note: String,
}
impl Unit {
    pub fn loc(&self, d: &Doc, side: &str) -> Vec<V> {
        locations(&self.m.refs, d, side, &self.id)
    }
    pub fn page(&self) -> usize {
        self.m.refs.iter().flatten().next().unwrap().p
    }
    pub fn section(&self) -> &str {
        s(&self.path["section"])
    }
}
pub const CURRENCY: &str =
    "USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|CNY|RMB|HKD|SGD|INR|KRW|SEK|NOK|DKK|ZAR|BRL|MXN|AED|SAR";
const NUMBER: &str = r"\p{N}+(?:[.,]\p{N}+)*";
fn page_expr() -> String {
    let n = format!(r"(\p{{N}}+)(?!\p{{N}})(?!\s*(?:[%‰\p{{Sc}}]|(?:{CURRENCY})(?!\p{{L}})))");
    format!(r"(?i)\bpage\s*{n}(?:\s*(?:of|/)\s*{n})?")
}
pub fn page_slots(t: &str) -> (Vec<usize>, Vec<usize>) {
    let spans: Vec<_> = re(NUMBER)
        .find_iter(t)
        .flatten()
        .map(|m| (m.start(), m.end()))
        .collect();
    let (mut c, mut tot) = (vec![], vec![]);
    for m in re(&page_expr()).captures_iter(t).flatten() {
        for (k, out) in [(1, &mut c), (2, &mut tot)] {
            if let Some(g) = m.get(k) {
                if let Some(i) = spans.iter().position(|r| *r == (g.start(), g.end())) {
                    out.push(i)
                }
            }
        }
    }
    (c, tot)
}
pub fn without_pages(t: &str) -> String {
    trim(&replace(&page_expr(), t, " ")).into()
}
pub fn without_furniture(t: &str, f: &Furniture) -> String {
    let starts: Vec<_> = re(NUMBER)
        .find_iter(t)
        .flatten()
        .map(|m| m.start())
        .collect();
    let ranges: Vec<_> = re(&page_expr())
        .captures_iter(t)
        .flatten()
        .filter(|m| {
            starts
                .iter()
                .position(|x| *x == m.get(1).unwrap().start())
                .map(|j| f.page_tokens.contains(&j))
                .unwrap_or(false)
        })
        .map(|m| {
            let g = m.get(0).unwrap();
            (g.start(), g.end())
        })
        .collect();
    t.char_indices()
        .filter(|(i, _)| !ranges.iter().any(|(a, b)| i >= a && i < b))
        .map(|(_, c)| c)
        .collect()
}
pub fn masked(u: &Unit) -> String {
    let t = &u.m.raw;
    let positions = if let Some(f) = &u.furniture {
        f.page_tokens.clone()
    } else {
        let (c, tot) = page_slots(t);
        [c, tot].concat()
    };
    let mut i = 0;
    re(NUMBER)
        .replace_all(t, |m: &fancy_regex::Captures| {
            let j = i;
            i += 1;
            if positions.contains(&j) {
                "#".to_string()
            } else {
                m[0].to_string()
            }
        })
        .into_owned()
}
pub fn variant(u: &Unit) -> String {
    let Some(f) = &u.furniture else {
        return u.m.raw.clone();
    };
    let counters = page_slots(&u.m.raw).0;
    let mut j = 0;
    re(NUMBER)
        .replace_all(&u.m.raw, |m: &fancy_regex::Captures| {
            let k = j;
            j += 1;
            let n = &m[0];
            if f.page_tokens.contains(&k) && counters.contains(&k) {
                if let Ok(v) = n.parse::<i64>() {
                    if n == v.to_string() {
                        return format!("#{}", v - u.page() as i64 - 1);
                    }
                }
            }
            n.into()
        })
        .into_owned()
}
#[derive(Clone)]
struct DLine {
    refs: Vec<Ref>,
    text: String,
    p: usize,
    l: usize,
}
fn document_lines(d: &Doc) -> (Vec<DLine>, Vec<DLine>) {
    let mut all = vec![];
    for (p, page) in d.pages.iter().enumerate() {
        let ix: Map<_, _> = page
            .chars
            .iter()
            .enumerate()
            .map(|(i, c)| (c.id.as_str(), i))
            .collect();
        for (l, line) in page.lines.iter().enumerate() {
            let refs: Vec<_> = line
                .char_ids
                .iter()
                .map(|id| Ref {
                    p,
                    c: ix[id.as_str()],
                    l,
                })
                .collect();
            let text = refs.iter().map(|r| r.ch(d).text.as_str()).collect();
            all.push(DLine { refs, text, p, l })
        }
    }
    all.into_iter().partition(|g| {
        !trim(&g.text).is_empty() || !g.refs.iter().all(|r| r.ch(d).provenance == "inferred")
    })
}
fn span(g: &DLine, d: &Doc) -> [f64; 2] {
    let xs: Vec<_> = g
        .refs
        .iter()
        .flat_map(|r| [0, 2, 4, 6].map(|k| r.ch(d).quad[k]))
        .collect();
    [
        xs.iter().copied().fold(f64::INFINITY, f64::min),
        xs.iter().copied().fold(f64::NEG_INFINITY, f64::max),
    ]
}
fn top(g: &DLine, d: &Doc) -> f64 {
    g.refs.first().map(|r| r.ch(d).origin[1]).unwrap_or(0.)
}
fn size(g: &DLine, d: &Doc) -> f64 {
    g.refs.first().map(|r| r.ch(d).size).unwrap_or(10.)
}
fn margin(g: &DLine, d: &Doc) -> bool {
    let y = top(g, d);
    y < 0.16 * d.pages[g.p].height || y > 0.88 * d.pages[g.p].height
}
fn pattern(t: &str) -> String {
    replace(r"\p{N}+", trim(t), "#")
}
fn signatures(lines: &[DLine], d: &Doc) -> Vec<Furniture> {
    let need = 3.max((0.4 * d.pages.len() as f64).ceil() as usize);
    let mut groups: Vec<(Furniture, Vec<usize>)> = vec![];
    for (i, g) in lines.iter().enumerate() {
        if trim(&g.text).is_empty() || !margin(g, d) {
            continue;
        }
        let pat = pattern(&g.text);
        let [x0, x1] = span(g, d);
        let y = top(g, d);
        if let Some((_, ms)) = groups.iter_mut().find(|(f, ms)| {
            f.pattern == pat
                && (f.y - y).abs() <= 2.
                && ((f.x0 - x0).abs() <= 2. || (f.x1 - x1).abs() <= 2.)
                && !ms.iter().any(|i| lines[*i].p == g.p)
        }) {
            ms.push(i)
        } else {
            groups.push((
                Furniture {
                    pattern: pat,
                    x0,
                    x1,
                    y,
                    page_number: false,
                    page_tokens: vec![],
                },
                vec![i],
            ))
        }
    }
    groups
        .into_iter()
        .filter_map(|(mut f, ms)| {
            if ms.len() < need {
                return None;
            }
            let printed: Vec<Vec<String>> = ms
                .iter()
                .map(|i| {
                    re(NUMBER)
                        .find_iter(&lines[*i].text)
                        .flatten()
                        .map(|m| m.as_str().into())
                        .collect()
                })
                .collect();
            let values: Vec<Vec<f64>> = printed
                .iter()
                .map(|ns| {
                    ns.iter()
                        .map(|n| replace("[.,]", n, "").parse().unwrap_or(f64::NAN))
                        .collect()
                })
                .collect();
            let (c, tot) = page_slots(trim(&lines[ms[0]].text));
            let fixed = |j: usize| {
                printed.iter().all(|ns| ns[j] == printed[0][j])
                    || values.iter().all(|ns| ns[j] == values[0][j])
            };
            let counters: Vec<_> = (0..values[0].len())
                .filter(|j| {
                    !fixed(*j)
                        && c.contains(j)
                        && values.iter().enumerate().all(|(n, v)| {
                            v[*j].is_finite()
                                && v[*j] - lines[ms[n]].p as f64
                                    == values[0][*j] - lines[ms[0]].p as f64
                        })
                })
                .collect();
            if (0..values[0].len()).any(|j| !fixed(j) && !counters.contains(&j)) {
                return None;
            }
            f.page_tokens = (0..values[0].len())
                .filter(|j| {
                    counters.contains(j) || (!counters.is_empty() && fixed(*j) && tot.contains(j))
                })
                .collect();
            f.page_number = !counters.is_empty();
            Some(f)
        })
        .collect()
}
pub fn furniture_signatures(d: &Doc) -> Vec<Furniture> {
    signatures(&document_lines(d).0, d)
}
fn page_furniture(lines: &[DLine], known: &[Furniture], d: &Doc) -> Map<usize, Furniture> {
    let mut found = Map::new();
    for (i, g) in lines.iter().enumerate() {
        if trim(&g.text).is_empty() || !margin(g, d) {
            continue;
        }
        let pat = pattern(&g.text);
        let [x0, x1] = span(g, d);
        if let Some(f) = known.iter().find(|f| {
            f.pattern == pat
                && (f.y - top(g, d)).abs() <= 2.
                && ((f.x0 - x0).abs() <= 2. || (f.x1 - x1).abs() <= 2.)
        }) {
            found.insert(i, f.clone());
        }
    }
    for i in found.keys().copied().collect::<Vec<_>>() {
        let g = &lines[i];
        let sz = size(g, d);
        let mut mates: Vec<_> = (0..lines.len())
            .filter(|j| {
                lines[*j].p == g.p
                    && !trim(&lines[*j].text).is_empty()
                    && (top(&lines[*j], d) - top(g, d)).abs() < 0.3 * sz
            })
            .collect();
        mates.sort_by(|a, b| span(&lines[*a], d)[0].total_cmp(&span(&lines[*b], d)[0]));
        let clusters = 1 + mates
            .windows(2)
            .filter(|w| span(&lines[w[1]], d)[0] - span(&lines[w[0]], d)[1] > sz)
            .count();
        if clusters >= 3 && !mates.iter().all(|j| found.contains_key(j)) {
            found.shift_remove(&i);
        }
    }
    found
}
fn centred(lines: &[DLine], d: &Doc) -> Map<usize, f64> {
    let mut stacks = vec![];
    let mut stack_of = Set::new();
    let mut i = 0;
    while i < lines.len() {
        let sz = size(&lines[i], d);
        let mut j = i + 1;
        if trim(&lines[i].text).is_empty() {
            i = j;
            continue;
        }
        while j < lines.len() {
            let a = &lines[j];
            let b = &lines[i];
            let [a0, a1] = span(a, d);
            let [b0, b1] = span(b, d);
            let dy = top(a, d) - top(&lines[j - 1], d);
            if a.p != b.p
                || trim(&a.text).is_empty()
                || !((a0 - b0).abs() < 1. || (a1 - b1).abs() < 1. || (a0 + a1 - b0 - b1).abs() < 2.)
                || (size(a, d) - sz).abs() >= 0.1 * sz
                || dy <= 0.3 * sz
                || dy > 1.6 * sz
            {
                break;
            }
            j += 1
        }
        if j - i >= 2 {
            stacks.push((i, j));
            stack_of.extend(i..j);
        }
        i = j;
    }
    let mut placed = Map::new();
    loop {
        let mut changed = false;
        for &(i, j) in &stacks {
            if placed.contains_key(&i) {
                continue;
            }
            let sz = size(&lines[i], d);
            let x0 = (i..j)
                .map(|k| span(&lines[k], d)[0])
                .fold(f64::INFINITY, f64::min);
            let x1 = (i..j)
                .map(|k| span(&lines[k], d)[1])
                .fold(f64::NEG_INFINITY, f64::max);
            for n in [
                i.checked_sub(1),
                if j < lines.len() { Some(j) } else { None },
            ]
            .into_iter()
            .flatten()
            {
                let y = placed.get(&n).copied().or_else(|| {
                    if stack_of.contains(&n) {
                        None
                    } else {
                        Some(top(&lines[n], d))
                    }
                });
                let Some(y) = y else { continue };
                if lines[n].p != lines[i].p
                    || trim(&lines[n].text).is_empty()
                    || y <= top(&lines[i], d) + 0.3 * sz
                    || y >= top(&lines[j - 1], d) - 0.3 * sz
                    || !(span(&lines[n], d)[1] < x0 || span(&lines[n], d)[0] > x1)
                {
                    continue;
                }
                for k in i..j {
                    placed.insert(k, y);
                }
                changed = true;
                break;
            }
        }
        if !changed {
            break;
        }
    }
    placed
}
fn add(
    units: &mut Vec<Unit>,
    refs: Vec<Option<Ref>>,
    role: &str,
    field: Option<String>,
    entity: Option<String>,
    identity: Option<String>,
    section: &str,
    title: &str,
    d: &Doc,
) -> usize {
    let mut raw = String::new();
    let mut mapped = vec![];
    for r in refs {
        let t = r.map(|r| r.ch(d).text.as_str()).unwrap_or(" ");
        raw.push_str(t);
        mapped.extend(t.chars().map(|_| r));
    }
    let i = units.len();
    units.push(Unit{m:normalize(&raw,mapped),id:format!("u{i}"),order:i,role:role.into(),path:json!({"section":section,"entity":entity,"field":field,"table":null,"rowKey":null,"confidence":if identity.is_some(){"reliable"}else{"candidate"}}),identity,primary:None,secondary:None,table_row:None,cells:None,spans:vec![],ambiguous:false,furniture:None,title:title.into(),repeats:None,others:vec![],separate:false,note:String::new()});
    i
}
fn append(u: &mut Unit, rs: &[Ref], d: &Doc) {
    let raw = format!(
        "{} {}",
        u.m.raw,
        rs.iter().map(|r| r.ch(d).text.as_str()).collect::<String>()
    );
    let mut refs = u.m.refs.clone();
    refs.push(None);
    for r in rs {
        refs.extend(r.ch(d).text.chars().map(|_| Some(*r)));
    }
    u.m = normalize(&raw, refs);
}
pub fn structure(d: &Doc, profile: &V, shared: &[Furniture]) -> Result<Vec<Unit>, String> {
    let mut units: Vec<Unit> = vec![];
    let mut section = "risk_details".to_string();
    let mut field_section = section.clone();
    let mut subject: Option<String> = None;
    let mut title = String::new();
    let mut active: Option<usize> = None;
    let (lines, separators) = document_lines(d);
    let mut known = signatures(&lines, d);
    known.extend_from_slice(shared);
    let furniture = page_furniture(&lines, &known, d);
    let centred = centred(&lines, d);
    let baseline = |i: usize| {
        centred
            .get(&i)
            .copied()
            .unwrap_or_else(|| top(&lines[i], d))
    };
    let mut uncertain = Set::new();
    let mut consumed = Set::new();
    let headers: Vec<_> = profile["table"]["headers"]
        .as_array()
        .ok_or("Invalid profile headers")?
        .iter()
        .map(s)
        .collect();
    let columns: Vec<_> = profile["table"]["columns"]
        .as_array()
        .ok_or("Invalid profile columns")?
        .iter()
        .map(s)
        .collect();
    let table = s(&profile["table"]["name"]);
    let mut i = 0;
    while i < lines.len() {
        crate::checkpoint();
        let row = &lines[i];
        let text = trim(&row.text);
        if consumed.contains(&i) {
            i += 1;
            continue;
        }
        let refs = || row.refs.iter().copied().map(Some).collect::<Vec<_>>();
        if text.is_empty() {
            add(
                &mut units,
                refs(),
                "whitespace",
                None,
                None,
                None,
                &section,
                &title,
                d,
            );
            i += 1;
            continue;
        }
        let y = top(row, d);
        if headers
            .iter()
            .enumerate()
            .all(|(j, h)| lines.get(i + j).map(|g| trim(&g.text)) == Some(*h))
        {
            section = table.into();
            active = None;
            for j in 0..headers.len() {
                add(
                    &mut units,
                    lines[i + j].refs.iter().copied().map(Some).collect(),
                    "table_header",
                    Some(columns[j].into()),
                    None,
                    Some(format!("table_header/{}", columns[j])),
                    &section,
                    &title,
                    d,
                );
            }
            i += headers.len();
            continue;
        }
        let is_top = y < 110.;
        let footer = y > d.pages[row.p].height - 50.;
        let rest = replace(
            r"^(?:SECTION|CHAPTER)\s+\d{1,2}(?:\.\d{1,2})*\.?(?=[\s:]|$)",
            text,
            "",
        );
        let letters = re(r"\p{L}").find_iter(&rest).count();
        let digits = re(r"\p{N}").find_iter(&rest).count();
        let code_like = !test(r"^\d{1,2}(?:\.\d{1,2})*\.?$", text)
            && (test(r"\p{L}\p{N}|\p{N}\p{L}", &rest)
                || (digits > 0 && digits as f64 >= 0.3 * (letters + digits) as f64));
        let heading = test(r"^[\p{Lu}\d][\p{Lu}\d\s:&/().,-]{2,}$", text)
            && text.encode_utf16().count() < 100
            && !code_like;
        if heading && test(r"^(SECTION|CHAPTER)\s+\S", text) {
            section = text.into();
            field_section = text.into();
            subject = None;
            title = text.into();
            active = None;
            add(
                &mut units,
                refs(),
                "heading",
                None,
                None,
                None,
                &section,
                &title,
                d,
            );
            i += 1;
            continue;
        }
        let mut labels: Vec<_> = profile["fields"]
            .as_object()
            .ok_or("Invalid profile fields")?
            .keys()
            .collect();
        labels.sort_by_key(|k| std::cmp::Reverse(k.len()));
        if let Some(label) = labels.into_iter().find(|k| text.starts_with(k.as_str())) {
            let field = s(&profile["fields"][label]);
            if let Some(v) = profile["subjects"][label].as_str() {
                subject = Some(v.into())
            }
            let entity = if profile["subjectFields"]
                .as_array()
                .unwrap()
                .iter()
                .any(|v| s(v) == field)
            {
                subject.clone()
            } else {
                None
            };
            let sc = if field == "header_limit" {
                "repeated_header"
            } else {
                &field_section
            };
            let key = format!("{sc}/{}/{field}", entity.as_deref().unwrap_or(""));
            let n = label.chars().count();
            add(
                &mut units,
                row.refs.iter().take(n).copied().map(Some).collect(),
                "label",
                Some(format!("{field}.label")),
                entity.clone(),
                Some(format!("{key}.label")),
                sc,
                &title,
                d,
            );
            if row.text.len() > label.len() {
                let a = add(
                    &mut units,
                    row.refs.iter().skip(n).copied().map(Some).collect(),
                    "field",
                    Some(field.into()),
                    entity,
                    Some(key),
                    sc,
                    &title,
                    d,
                );
                active = Some(a);
                if let Some(f) = furniture.get(&i) {
                    let mut f = f.clone();
                    let before = re(NUMBER).find_iter(label).count();
                    f.page_tokens = f
                        .page_tokens
                        .iter()
                        .filter_map(|j| j.checked_sub(before))
                        .collect();
                    units[a].furniture = Some(f);
                }
            } else if i + 1 < lines.len()
                && !consumed.contains(&(i + 1))
                && lines[i + 1].p == row.p
                && (top(&lines[i + 1], d) - y).abs() < size(row, d)
            {
                let a = add(
                    &mut units,
                    lines[i + 1].refs.iter().copied().map(Some).collect(),
                    "field",
                    Some(field.into()),
                    entity,
                    Some(key),
                    sc,
                    &title,
                    d,
                );
                units[a].furniture = furniture.get(&(i + 1)).cloned();
                active = Some(a);
                i += 1;
            } else {
                active = None
            }
            i += 1;
            continue;
        }
        if let Some(f) = furniture.get(&i) {
            let a = add(
                &mut units,
                refs(),
                "furniture",
                None,
                None,
                None,
                "page_furniture",
                &title,
                d,
            );
            units[a].furniture = Some(f.clone());
            i += 1;
            continue;
        }
        if is_top || footer {
            let previous = units.last().and_then(|u| u.m.refs.iter().flatten().next());
            if footer
                && units.last().map(|u| u.role.as_str()) == Some("footer")
                && previous
                    .map(|r| r.p == row.p && (r.ch(d).origin[1] - y).abs() < 1.)
                    .unwrap_or(false)
            {
                append(units.last_mut().unwrap(), &row.refs, d)
            } else {
                add(
                    &mut units,
                    refs(),
                    if footer { "footer" } else { "page_heading" },
                    None,
                    None,
                    None,
                    &section,
                    &title,
                    d,
                );
            }
            i += 1;
            continue;
        }
        if d.pages[row.p].lines[row.l].direction[1].abs() > 0.15 {
            add(
                &mut units,
                refs(),
                "status",
                Some("status".into()),
                None,
                Some("document/status".into()),
                "document",
                &title,
                d,
            );
            active = None;
            i += 1;
            continue;
        }
        if section == table {
            let group = &lines[i..(i + columns.len()).min(lines.len())];
            if group.len() == columns.len()
                && group
                    .iter()
                    .all(|g| g.p == row.p && (top(g, d) - y).abs() < 2.)
                && group[0].text != headers[0]
            {
                let primary = trim(&group[0].text).to_string();
                let secondary = trim(&group[1].text).to_string();
                for (j, g) in group.iter().enumerate() {
                    let a = add(
                        &mut units,
                        g.refs.iter().copied().map(Some).collect(),
                        "cell",
                        Some(columns[j].into()),
                        Some(secondary.clone()),
                        None,
                        &section,
                        &title,
                        d,
                    );
                    let u = &mut units[a];
                    u.primary = Some(primary.clone());
                    u.secondary = Some(secondary.clone());
                    u.table_row = Some(format!("{}/{}", row.p, i));
                    u.path["table"] = json!(table);
                    u.path["rowKey"] = json!(secondary);
                }
                i += group.len();
                active = None;
                continue;
            }
        }
        if section != table {
            let sz = size(row, d);
            let level = baseline(i);
            let mut end = i + 1;
            while end < lines.len()
                && lines[end].p == row.p
                && (consumed.contains(&end)
                    || (!trim(&lines[end].text).is_empty()
                        && baseline(end) > level - 0.3 * sz
                        && baseline(end) - level < 4. * sz))
            {
                end += 1
            }
            let window: Vec<_> = (i..end)
                .filter(|g| !consumed.contains(g) && !furniture.contains_key(g))
                .collect();
            let mut members: Vec<_> = window
                .iter()
                .copied()
                .filter(|g| (baseline(*g) - level).abs() < 0.3 * sz)
                .collect();
            if members.len() >= 3 {
                members.sort_by(|a, b| span(&lines[*a], d)[0].total_cmp(&span(&lines[*b], d)[0]));
                let mut cells = vec![vec![members[0]]];
                for pair in members.windows(2) {
                    if span(&lines[pair[1]], d)[0] - span(&lines[pair[0]], d)[1] > sz {
                        cells.push(vec![pair[1]])
                    } else {
                        cells.last_mut().unwrap().push(pair[1])
                    }
                }
                for c in &mut cells {
                    c.sort_by(|a, b| {
                        top(&lines[*a], d)
                            .total_cmp(&top(&lines[*b], d))
                            .then(span(&lines[*a], d)[0].total_cmp(&span(&lines[*b], d)[0]))
                    })
                }
                if cells.len() >= 3 {
                    let bounds: Vec<_> = cells
                        .iter()
                        .map(|c| {
                            [
                                span(&lines[c[0]], d)[0],
                                span(&lines[*c.last().unwrap()], d)[1],
                            ]
                        })
                        .collect();
                    let column = |g: usize| {
                        let [x0, x1] = span(&lines[g], d);
                        if (size(&lines[g], d) - sz).abs() >= 0.1 * sz {
                            return None;
                        }
                        bounds.iter().enumerate().position(|(k, b)| {
                            x0 > b[0] - 1.
                                && x1 < bounds.get(k + 1).map(|x| x[0]).unwrap_or(f64::INFINITY)
                                && cells[k].iter().any(|m| {
                                    let [m0, m1] = span(&lines[*m], d);
                                    (x0 - m0).abs() < 1.
                                        || (x1 - m1).abs() < 1.
                                        || (x0 + x1 - m0 - m1).abs() < 2.
                                })
                        })
                    };
                    let own_row = |g: usize| {
                        let mut xs: Vec<_> = lines
                            .iter()
                            .enumerate()
                            .filter(|(m, x)| {
                                x.p == lines[g].p
                                    && !furniture.contains_key(m)
                                    && !trim(&x.text).is_empty()
                                    && (baseline(*m) - baseline(g)).abs() < 0.3 * sz
                            })
                            .map(|(_, x)| span(x, d))
                            .collect();
                        xs.sort_by(|a, b| a[0].total_cmp(&b[0]));
                        let mut count = 0;
                        let mut max = f64::NEG_INFINITY;
                        for x in xs {
                            if x[0] - max > sz {
                                count += 1
                            }
                            max = max.max(x[1])
                        }
                        count >= cells.len()
                    };
                    if units.last().and_then(|u| u.cells.as_ref()).is_some() {
                        let bands_at = |g: usize| {
                            let mut ms: Vec<_> = window
                                .iter()
                                .copied()
                                .filter(|m| (baseline(*m) - baseline(g)).abs() < 0.3 * sz)
                                .collect();
                            ms.sort_by(|a, b| {
                                span(&lines[*a], d)[0].total_cmp(&span(&lines[*b], d)[0])
                            });
                            let mut bands: Vec<Vec<usize>> = vec![];
                            for m in ms {
                                let separate = bands
                                    .last()
                                    .map(|b| {
                                        span(&lines[m], d)[0]
                                            - b.iter()
                                                .map(|n| span(&lines[*n], d)[1])
                                                .fold(f64::NEG_INFINITY, f64::max)
                                            > sz
                                    })
                                    .unwrap_or(true);
                                if separate {
                                    bands.push(vec![m])
                                } else {
                                    bands.last_mut().unwrap().push(m)
                                }
                            }
                            bands
                        };
                        let extent = |band: &Vec<usize>| {
                            [
                                band.iter()
                                    .map(|g| span(&lines[*g], d)[0])
                                    .fold(f64::INFINITY, f64::min),
                                band.iter()
                                    .map(|g| span(&lines[*g], d)[1])
                                    .fold(f64::NEG_INFINITY, f64::max),
                            ]
                        };
                        let stacks: Vec<Vec<Vec<usize>>> = cells
                            .iter()
                            .enumerate()
                            .map(|(k, cell)| {
                                let mut stack = vec![cell.clone()];
                                loop {
                                    let prev = stack.last().unwrap();
                                    let g = prev.iter().max().unwrap() + 1;
                                    if !window.contains(&g) {
                                        break;
                                    }
                                    let bands = bands_at(g);
                                    let Some(next) = bands.iter().find(|b| b.contains(&g)) else {
                                        break;
                                    };
                                    if bands.len() < cells.len() {
                                        break;
                                    }
                                    let [a0, a1] = extent(cell);
                                    let [b0, b1] = extent(next);
                                    let dy = baseline(g) - baseline(prev[0]);
                                    if dy < 0.3 * sz
                                        || dy > 1.6 * sz
                                        || b0 < bounds[k][0] - 1.
                                        || b1
                                            >= bounds
                                                .get(k + 1)
                                                .map(|x| x[0])
                                                .unwrap_or(f64::INFINITY)
                                        || !((a0 - b0).abs() < 1.
                                            || (a1 - b1).abs() < 1.
                                            || (a0 + a1 - b0 - b1).abs() < 2.)
                                        || !next
                                            .iter()
                                            .all(|m| (size(&lines[*m], d) - sz).abs() < 0.1 * sz)
                                    {
                                        break;
                                    }
                                    stack.push(next.clone())
                                }
                                stack
                            })
                            .collect();
                        if stacks[0].len() > 1
                            && stacks.iter().all(|st| {
                                st.len() == stacks[0].len()
                                    && st.iter().enumerate().all(|(j, band)| {
                                        (baseline(band[0]) - baseline(stacks[0][j][0])).abs()
                                            < 0.3 * sz
                                    })
                            })
                        {
                            let block: Vec<_> =
                                stacks.iter().flatten().flatten().copied().collect();
                            if block.iter().max().unwrap() - block.iter().min().unwrap() + 1
                                == block.len()
                            {
                                uncertain.extend(block);
                            }
                        }
                    }
                    let mut wrapped = vec![vec![]; cells.len()];
                    let mut owner: Map<usize, usize> = cells
                        .iter()
                        .enumerate()
                        .flat_map(|(k, c)| c.iter().map(move |g| (*g, k)))
                        .collect();
                    for &g in &window {
                        let Some(k) = column(g) else { continue };
                        let Some(prev) = g.checked_sub(1) else {
                            continue;
                        };
                        let dy = top(&lines[g], d) - top(&lines[prev], d);
                        if owner.contains_key(&g)
                            || owner.get(&prev) != Some(&k)
                            || dy < 0.3 * sz
                            || dy > 1.6 * sz
                            || own_row(g)
                        {
                            continue;
                        }
                        wrapped[k].push(g);
                        owner.insert(g, k);
                    }
                    let parts: Vec<Vec<usize>> = cells
                        .iter()
                        .enumerate()
                        .map(|(k, c)| [c.clone(), wrapped[k].clone()].concat())
                        .collect();
                    for g in parts.iter().flatten() {
                        consumed.insert(*g);
                    }
                    let joined = |cell: &Vec<usize>| {
                        let mut out = vec![];
                        for (j, g) in cell.iter().enumerate() {
                            let touching = j > 0
                                && (top(&lines[*g], d) - top(&lines[cell[j - 1]], d)).abs()
                                    < 0.3 * sz
                                && (span(&lines[*g], d)[0] - span(&lines[cell[j - 1]], d)[1]).abs()
                                    < 1.;
                            if j > 0 && !touching {
                                out.push(None)
                            }
                            out.extend(lines[*g].refs.iter().copied().map(Some));
                        }
                        out
                    };
                    let mut all = vec![];
                    for (j, c) in parts.iter().enumerate() {
                        if j > 0 {
                            all.push(None)
                        }
                        all.extend(joined(c))
                    }
                    let a = add(
                        &mut units, all, "body", None, None, None, &section, &title, d,
                    );
                    let u = &mut units[a];
                    u.cells = Some(
                        parts
                            .iter()
                            .map(|c| {
                                trim(
                                    &joined(c)
                                        .iter()
                                        .map(|r| r.map(|r| r.ch(d).text.as_str()).unwrap_or(" "))
                                        .collect::<String>(),
                                )
                                .into()
                            })
                            .collect(),
                    );
                    u.spans = parts
                        .iter()
                        .map(|c| {
                            [
                                c.iter()
                                    .map(|g| span(&lines[*g], d)[0])
                                    .fold(f64::INFINITY, f64::min),
                                c.iter()
                                    .map(|g| span(&lines[*g], d)[1])
                                    .fold(f64::NEG_INFINITY, f64::max),
                            ]
                        })
                        .collect();
                    u.path["table"] = json!("recovered_rows");
                    if parts.iter().flatten().any(|g| uncertain.contains(g)) {
                        u.ambiguous = true;
                        u.path["confidence"] = json!("unresolved");
                    }
                    active = None;
                    i += 1;
                    continue;
                }
            }
        }
        if heading {
            title = text.into();
            if test(r"^(SECTION|CHAPTER)\b", text) {
                section = text.into()
            } else if section == "risk_details" {
                section = "clauses".into()
            } else if section == table {
                section = "after_aircraft_schedule".into()
            }
            add(
                &mut units,
                refs(),
                "heading",
                None,
                None,
                None,
                &section,
                &title,
                d,
            );
            active = None;
            i += 1;
            continue;
        }
        if let Some(a) = active {
            if units[a].role == "field" && row.refs[0].ch(d).origin[0] > 120. {
                append(&mut units[a], &row.refs, d);
                i += 1;
                continue;
            }
            let prev = units[a].m.refs.iter().rev().flatten().next();
            if units[a].role == "body"
                && units[a].title == title
                && !prev
                    .map(|p| p.p == row.p && y - p.ch(d).origin[1] > 1.6 * size(row, d))
                    .unwrap_or(false)
                && !prev
                    .map(|p| p.p != row.p && test(r"[.;]$", units[a].m.raw.trim_end_matches(ws)))
                    .unwrap_or(false)
            {
                append(&mut units[a], &row.refs, d);
                i += 1;
                continue;
            }
        }
        active = Some(add(
            &mut units,
            refs(),
            "body",
            None,
            None,
            None,
            &section,
            &title,
            d,
        ));
        i += 1;
    }
    for sep in separators {
        add(
            &mut units,
            sep.refs.iter().copied().map(Some).collect(),
            "logical_separator",
            None,
            None,
            None,
            &section,
            &title,
            d,
        );
    }
    let mut owners = Map::new();
    for u in &units {
        for r in u.m.refs.iter().flatten() {
            if let Some(owner) = owners.insert(r.ch(d).id.as_str(), u.id.as_str()) {
                if owner != u.id {
                    return Err("Character assigned to multiple primary units".into());
                }
            }
        }
    }
    if owners.len() != d.pages.iter().map(|p| p.chars.len()).sum::<usize>() {
        return Err("Character conservation failed".into());
    }
    Ok(units)
}
pub fn aggregate(us: &[Unit], id: String, ambiguous: bool) -> Unit {
    let mut u = us[0].clone();
    let raw = us
        .iter()
        .map(|u| u.m.raw.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let mut refs = vec![];
    for (i, u) in us.iter().enumerate() {
        if i > 0 {
            refs.push(None)
        }
        refs.extend(&u.m.refs)
    }
    u.m = normalize(&raw, refs);
    u.id = id;
    if ambiguous {
        u.identity = None;
        u.path["confidence"] = json!("unresolved");
        u.path["rowKey"] = V::Null;
        u.path["entity"] = V::Null;
    }
    u
}
