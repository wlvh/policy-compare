use crate::{edits::*, model::*, structure::*, text::*};
use serde_json::json;
#[derive(Clone)]
struct Pair {
    a: Unit,
    b: Unit,
    method: String,
    score: Option<f64>,
}
fn bind(
    pairs: &mut Vec<Pair>,
    ul: &mut Set<String>,
    ur: &mut Set<String>,
    a: Unit,
    b: Unit,
    method: &str,
    score: Option<f64>,
) {
    ul.insert(a.id.clone());
    ur.insert(b.id.clone());
    pairs.push(Pair {
        a,
        b,
        method: method.into(),
        score,
    });
}
fn group(
    us: &[Unit],
    used: &Set<String>,
    key: impl Fn(&Unit) -> Option<String>,
) -> Map<String, Vec<Unit>> {
    let mut m: Map<String, Vec<Unit>> = Map::new();
    for u in us {
        if used.contains(&u.id) {
            continue;
        }
        if let Some(k) = key(u) {
            m.entry(k).or_default().push(u.clone())
        }
    }
    m
}
fn mark(used: &mut Set<String>, us: &[Unit]) {
    used.extend(us.iter().map(|u| u.id.clone()));
}
fn unresolved(reason: &str, message: &str, a: &[Unit], b: &[Unit], l: &Doc, r: &Doc) -> V {
    json!({"reason":reason,"message":message,"left":a.iter().flat_map(|u|u.loc(l,"left")).collect::<Vec<_>>(),"right":b.iter().flat_map(|u|u.loc(r,"right")).collect::<Vec<_>>(),"defaultVisible":true})
}
fn value_like(t: &str) -> bool {
    test(
        &format!(
            r"%|\d[.,]\d|\p{{Sc}}|\b(?:USD|EUR|GBP)\b|(?<!\p{{L}})(?:{CURRENCY})\s*\d|\d\s*(?:{CURRENCY})(?!\p{{L}})|\d{{1,2}}/\d{{1,2}}/\d{{2,4}}|\b\d{{4}}-\d{{1,2}}-\d{{1,2}}\b"
        ),
        t,
    ) || test(
        r"(?i)\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}\b",
        t,
    )
}
const ID: &str = r"MSN|ESN|S/N|serial|registration|(?:re)?insurer";
fn identity_heading(t: &str) -> bool {
    test(
        &format!(r"(?i)\b(?:{ID})(?:\s*(?:no\.?|nr\.?|number|#))?$"),
        trim(&nfkc(t)),
    )
}
fn identity_name(t: &str) -> bool {
    test(
        &format!(r"(?i)^(?:{ID})(?:\s*(?:no\.?|nr\.?|number|#))?$"),
        trim(&nfkc(t)),
    )
}
fn names_identity(u: &Unit) -> bool {
    u.cells.as_ref().unwrap().iter().any(|c| identity_name(c))
}
fn names_column(u: &Unit) -> bool {
    u.cells
        .as_ref()
        .unwrap()
        .iter()
        .any(|c| identity_heading(c))
}
fn value_free(u: &Unit) -> bool {
    !u.cells.as_ref().unwrap().iter().any(|c| {
        let c = nfkc(c);
        let t = re(&format!(r"[%‰\p{{Sc}}]|\b(?:{CURRENCY})\b"))
            .replace_all(&c, |m: &fancy_regex::Captures| {
                let g = m.get(0).unwrap();
                if test(r"\p{N}\s*$", &c[..g.start()]) || test(r"^\s*[-−+]?\p{N}", &c[g.end()..])
                {
                    g.as_str().into()
                } else {
                    String::new()
                }
            })
            .into_owned();
        value_like(&t)
    })
}
fn heading_like(u: &Unit) -> bool {
    !test(r"\p{N}", &u.m.raw) || (names_identity(u) && value_free(u))
}
fn cell_key(u: &Unit) -> String {
    canonical(&json!(u.cells))
}
fn under(h: Option<&Unit>, [x0, x1]: [f64; 2]) -> Option<(usize, String)> {
    let h = h?;
    let overlaps: Vec<_> = h.spans.iter().map(|[a, b]| b.min(x1) - a.max(x0)).collect();
    let max = overlaps.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let j = overlaps.iter().position(|x| *x == max)?;
    if max > 0. {
        Some((j, h.cells.as_ref().unwrap()[j].clone()))
    } else {
        None
    }
}
struct Headings {
    heads: Map<String, Unit>,
    scopes: Map<String, String>,
    starts: Set<String>,
}
impl Headings {
    fn head(&self, u: &Unit) -> Option<&Unit> {
        self.heads.get(&u.id)
    }
    fn scope(&self, u: &Unit) -> String {
        self.scopes
            .get(&u.id)
            .cloned()
            .unwrap_or_else(|| format!("{}\0{}\0", u.section(), u.title))
    }
    fn slots(&self, u: &Unit) -> String {
        let h = self.head(u);
        canonical(&json!(
            u.spans
                .iter()
                .enumerate()
                .map(|(k, sp)| {
                    let slot = under(h, *sp)
                        .map(|(j, _)| format!("c{j}"))
                        .unwrap_or_else(|| {
                            format!(
                                "g{}",
                                h.map(|h| h.spans.iter().filter(|s| s[1] <= sp[0]).count())
                                    .unwrap_or(0)
                            )
                        });
                    json!([slot, u.cells.as_ref().unwrap()[k]])
                })
                .collect::<Vec<_>>()
        ))
    }
}
fn row_headings(left: &[Unit], right: &[Unit]) -> [Headings; 2] {
    let mut output = [
        Headings {
            heads: Map::new(),
            scopes: Map::new(),
            starts: Set::new(),
        },
        Headings {
            heads: Map::new(),
            scopes: Map::new(),
            starts: Set::new(),
        },
    ];
    let mut sides = vec![];
    for (side, us) in [left, right].iter().enumerate() {
        let mut current: Map<String, Unit> = Map::new();
        let mut open: Map<String, (String, String, usize)> = Map::new();
        let mut last: Map<String, (String, usize)> = Map::new();
        let mut broken = Set::new();
        let mut closed = Map::new();
        let mut page = Map::new();
        let mut count: Map<String, usize> = Map::new();
        let mut table: Map<String, (String, usize)> = Map::new();
        for u in *us {
            if u.ambiguous {
                continue;
            }
            if u.cells.is_none() {
                if !["furniture", "page_heading", "footer", "whitespace"].contains(&u.role.as_str())
                {
                    current.clear();
                    open.clear();
                    closed.clear()
                }
                if ![
                    "furniture",
                    "page_heading",
                    "footer",
                    "whitespace",
                    "heading",
                ]
                .contains(&u.role.as_str())
                {
                    broken.extend(last.keys().cloned());
                }
                continue;
            }
            let t = format!("{}\0{}", u.section(), u.title);
            let st = open.get(&t).cloned();
            let p = u.page();
            let before = page.insert(t.clone(), p);
            let ck = cell_key(u);
            let label = st.is_some()
                && names_identity(u)
                && u.cells.as_ref().unwrap().iter().enumerate().any(|(k, c)| {
                    identity_name(c)
                        && !under(current.get(&t), u.spans[k])
                            .map(|(_, t)| identity_heading(&t))
                            .unwrap_or(false)
                });
            if (!test(r"\p{N}", &u.m.raw) || value_free(u))
                && st.is_some()
                && ck != st.as_ref().unwrap().0
                && (label || (!names_identity(u) && names_column(u)))
            {
                current.shift_remove(&t);
                open.shift_remove(&t);
                broken.insert(t.clone());
                let key = format!("{t}\0{ck}");
                let n = count.get(&key).unwrap_or(&0) + 1;
                count.insert(key.clone(), n);
                closed.insert(t.clone(), (key.clone(), n));
                table.insert(u.id.clone(), (key, n));
                continue;
            }
            if !test(r"\p{N}", &u.m.raw)
                && st.is_some()
                && ck != st.as_ref().unwrap().0
                && !names_identity(u)
            {
                output[side].heads.insert(u.id.clone(), current[&t].clone());
                let st = st.unwrap();
                table.insert(u.id.clone(), (st.1, st.2));
            } else if heading_like(u) {
                let prev = last.get(&t);
                let key = format!("{t}\0{ck}");
                let n = if prev
                    .map(|v| {
                        v.0 == ck && !broken.contains(&t) && before.map(|b| p > b).unwrap_or(false)
                    })
                    .unwrap_or(false)
                {
                    prev.unwrap().1
                } else {
                    count.get(&key).unwrap_or(&0) + 1
                };
                count.insert(key.clone(), n.max(*count.get(&key).unwrap_or(&0)));
                last.insert(t.clone(), (ck.clone(), n));
                broken.shift_remove(&t);
                current.insert(t.clone(), u.clone());
                open.insert(t.clone(), (ck, key.clone(), n));
                closed.shift_remove(&t);
                output[side].starts.insert(u.id.clone());
                table.insert(u.id.clone(), (key, n));
            } else if let Some(h) = current.get(&t) {
                output[side].heads.insert(u.id.clone(), h.clone());
                table.insert(
                    u.id.clone(),
                    (format!("{t}\0{}", cell_key(h)), st.unwrap().2),
                );
            } else if let Some(c) = closed.get(&t) {
                table.insert(u.id.clone(), c.clone());
            }
        }
        sides.push((count, table));
    }
    for side in 0..2 {
        for (id, (key, n)) in &sides[side].1 {
            let scope = if sides.iter().all(|x| x.0.get(key) == Some(&1)) {
                key.clone()
            } else {
                format!("{key}\0{side}\0{n}")
            };
            output[side].scopes.insert(id.clone(), scope);
        }
    }
    output
}
fn identity_cells(r: &Unit, head: &Headings) -> Map<String, String> {
    let h = head.head(r);
    let mut cells = vec![];
    for (k, c0) in r.cells.as_ref().unwrap().iter().enumerate() {
        let c = nfkc(c0);
        let at = under(h, r.spans[k]);
        let named = re(&format!(r"(?i)^(?:{ID})\b"))
            .find(&c)
            .ok()
            .flatten()
            .map(|m| m.as_str().to_lowercase())
            .map(|n| if n == "s/n" { "serial".into() } else { n });
        if let Some((j, t)) = &at {
            if identity_heading(t) {
                cells.push((format!("column {j}"), c));
                continue;
            }
        }
        if at.is_some()
            || named.is_none()
            || identity_name(&replace(r"[^\p{L}\p{N}]+$", trim(&c), ""))
        {
            continue;
        }
        cells.push((format!("named {}", named.unwrap()), c));
    }
    let crowded = cells
        .iter()
        .any(|(k, _)| cells.iter().filter(|(x, _)| x == k).count() > 1);
    let mut m: Map<_, _> = cells
        .iter()
        .filter(|(k, _)| cells.iter().filter(|(x, _)| x == k).count() == 1)
        .cloned()
        .collect();
    let missing: Vec<_> = h
        .map(|h| {
            h.cells
                .as_ref()
                .unwrap()
                .iter()
                .enumerate()
                .filter(|(j, t)| identity_heading(t) && !m.contains_key(&format!("column {j}")))
                .map(|(j, _)| j)
                .collect()
        })
        .unwrap_or_default();
    let columns: Vec<_> = r
        .spans
        .iter()
        .map(|sp| under(h, *sp).map(|(j, _)| j))
        .collect();
    let open = columns.iter().enumerate().any(|(k, j)| {
        let Some(j) = j else { return true };
        if columns.iter().filter(|x| *x == &Some(*j)).count() > 1 {
            return true;
        }
        let [x0, x1] = r.spans[k];
        let [h0, h1] = h.unwrap().spans[*j];
        missing
            .iter()
            .any(|e| if e < j { x0 < h0 - 1. } else { x1 > h1 + 1. })
    });
    if crowded || (!missing.is_empty() && open) {
        m.insert("incomplete".into(), String::new());
    }
    m
}
fn table_pairs(
    la: &[Unit],
    rb: &[Unit],
    pairs: &mut Vec<Pair>,
    ul: &mut Set<String>,
    ur: &mut Set<String>,
    un: &mut Vec<V>,
    l: &Doc,
    r: &Doc,
) {
    let rows = |us: &[Unit]| {
        group(us, &Set::new(), |u| {
            if u.role == "cell" {
                u.table_row.clone()
            } else {
                None
            }
        })
        .into_values()
        .collect::<Vec<_>>()
    };
    let a = rows(la);
    let b = rows(rb);
    let mut da = Set::new();
    let mut db = Set::new();
    let unique = |rs: &Vec<Vec<Unit>>, primary: bool, v: &Option<String>| {
        rs.iter()
            .enumerate()
            .filter(|(_, r)| {
                v.is_some()
                    && if primary {
                        r[0].primary == *v
                    } else {
                        r[0].secondary == *v
                    }
            })
            .map(|(i, _)| i)
            .collect::<Vec<_>>()
    };
    for (i, row) in a.iter().enumerate() {
        let p = unique(&b, true, &row[0].primary);
        let s = unique(&b, false, &row[0].secondary);
        let op = unique(&a, true, &row[0].primary);
        let os = unique(&a, false, &row[0].secondary);
        if p.len() == 1 && s.len() == 1 && p[0] != s[0] {
            continue;
        }
        let other = if op.len() == 1 && p.len() == 1 {
            Some(p[0])
        } else if os.len() == 1 && s.len() == 1 {
            Some(s[0])
        } else {
            None
        };
        let Some(j) = other else { continue };
        if db.contains(&j) {
            continue;
        }
        da.insert(i);
        db.insert(j);
        for u in row {
            if let Some(v) = b[j].iter().find(|v| v.path["field"] == u.path["field"]) {
                let (mut u, mut v) = (u.clone(), v.clone());
                u.path["confidence"] = json!("reliable");
                v.path["confidence"] = json!("reliable");
                bind(pairs, ul, ur, u, v, "declared-table-key", None);
            }
        }
    }
    let ra: Vec<_> = a
        .iter()
        .enumerate()
        .filter(|(i, _)| !da.contains(i))
        .flat_map(|(_, r)| r.clone())
        .collect();
    let br: Vec<_> = b
        .iter()
        .enumerate()
        .filter(|(i, _)| !db.contains(i))
        .flat_map(|(_, r)| r.clone())
        .collect();
    let duplicate = a.iter().enumerate().any(|(i, row)| {
        !da.contains(&i)
            && (unique(&a, true, &row[0].primary).len() > 1
                || unique(&a, false, &row[0].secondary).len() > 1)
    }) || b.iter().enumerate().any(|(i, row)| {
        !db.contains(&i)
            && (unique(&b, true, &row[0].primary).len() > 1
                || unique(&b, false, &row[0].secondary).len() > 1)
    });
    if !ra.is_empty() && !br.is_empty() {
        let fields: Set<_> = ra.iter().map(|u| s(&u.path["field"]).to_string()).collect();
        for f in fields {
            let aa: Vec<_> = ra
                .iter()
                .filter(|u| u.path["field"] == f)
                .cloned()
                .collect();
            let bb: Vec<_> = br
                .iter()
                .filter(|u| u.path["field"] == f)
                .cloned()
                .collect();
            if aa.is_empty() || bb.is_empty() {
                continue;
            }
            let x = aggregate(&aa, format!("ambiguous-left-{f}"), true);
            let y = aggregate(&bb, format!("ambiguous-right-{f}"), true);
            mark(ul, &aa);
            mark(ur, &bb);
            un.push(unresolved(
                "ambiguous_identity",
                if duplicate {
                    "Duplicate primary or secondary table keys; amount changes remain visible, but a unique entity cannot be identified"
                } else {
                    "Conflicting table keys or no reliable match"
                },
                &[x.clone()],
                &[y.clone()],
                l,
                r,
            ));
            bind(pairs, ul, ur, x, y, "unresolved-table-group", None);
        }
    }
}
fn row_identity(
    la: &[Unit],
    rb: &[Unit],
    heads: &[Headings; 2],
    pairs: &mut Vec<Pair>,
    ul: &mut Set<String>,
    ur: &mut Set<String>,
    un: &mut Vec<V>,
    l: &Doc,
    r: &Doc,
) {
    let owners = |rows: &Vec<Unit>, h: &Headings| {
        let mut m: Map<String, Vec<Unit>> = Map::new();
        for row in rows {
            let ids = identity_cells(row, h);
            if row.ambiguous || ids.contains_key("incomplete") {
                continue;
            }
            for (k, c) in ids {
                if !value_like(&c) {
                    m.entry(format!("{k}\0{c}")).or_default().push(row.clone())
                }
            }
        }
        m
    };
    let tables = |us: &[Unit], h: &Headings| {
        group(us, &Set::new(), |u| u.cells.as_ref().map(|_| h.scope(u)))
    };
    let lt = tables(la, &heads[0]);
    let rt = tables(rb, &heads[1]);
    let mut links: Map<(usize, String), Set<(usize, String)>> = Map::new();
    let mut via: Map<String, String> = Map::new();
    for (t, rows) in lt {
        let Some(other) = rt.get(&t) else { continue };
        let ro = owners(other, &heads[1]);
        for (key, aa) in owners(&rows, &heads[0]) {
            let Some(bb) = ro.get(&key) else { continue };
            if aa.len() != 1 || bb.len() != 1 {
                continue;
            }
            let (a, b) = (&aa[0], &bb[0]);
            if ul.contains(&a.id) || ur.contains(&b.id) {
                continue;
            }
            links
                .entry((0, a.id.clone()))
                .or_default()
                .insert((1, b.id.clone()));
            links
                .entry((1, b.id.clone()))
                .or_default()
                .insert((0, a.id.clone()));
            via.entry(a.id.clone())
                .or_insert_with(|| key.split('\0').nth(1).unwrap_or("").into());
        }
    }
    let mut seen = Set::new();
    for start in la {
        let start = (0, start.id.clone());
        if !links.contains_key(&start) || seen.contains(&start) {
            continue;
        }
        let mut g = vec![];
        let mut queue = vec![start];
        while let Some(u) = queue.pop() {
            if !seen.insert(u.clone()) {
                continue;
            }
            g.push(u.clone());
            queue.extend(links.get(&u).unwrap().iter().cloned());
        }
        let mut aa: Vec<_> = g
            .iter()
            .filter(|(s, _)| *s == 0)
            .map(|(_, id)| la.iter().find(|u| u.id == *id).unwrap().clone())
            .collect();
        let mut bb: Vec<_> = g
            .iter()
            .filter(|(s, _)| *s == 1)
            .map(|(_, id)| rb.iter().find(|u| u.id == *id).unwrap().clone())
            .collect();
        aa.sort_by_key(|u| u.order);
        bb.sort_by_key(|u| u.order);
        if aa.len() == 1 && bb.len() == 1 {
            let x = identity_cells(&aa[0], &heads[0]);
            let y = identity_cells(&bb[0], &heads[1]);
            if x.iter()
                .all(|(k, c)| y.get(k).map(|v| v == c).unwrap_or(true))
            {
                let key = via.get(&aa[0].id).cloned();
                aa[0].path["rowKey"] = json!(key);
                bb[0].path["rowKey"] = json!(key);
                bind(
                    pairs,
                    ul,
                    ur,
                    aa[0].clone(),
                    bb[0].clone(),
                    "row-identity",
                    None,
                );
                continue;
            }
        }
        let x = aggregate(&aa, format!("row-conflict-left-{}", aa[0].id), true);
        let y = aggregate(&bb, format!("row-conflict-right-{}", bb[0].id), true);
        mark(ul, &aa);
        mark(ur, &bb);
        un.push(unresolved("ambiguous_identity","Table row identity evidence conflicts (for example, two identity columns point to different rows, or the same identity column has different values); rows were not automatically matched, and source changes within the group remain visible",&[x.clone()],&[y.clone()],l,r));
        bind(pairs, ul, ur, x, y, "unresolved-row-identity", None);
    }
}
fn repeated(us: &[Unit], id: String) -> Unit {
    let mut u = aggregate(us, id, false);
    u.m = normalize(&us[0].m.raw, us[0].m.refs.clone());
    u.repeats = Some(us.to_vec());
    u
}
fn page_list(us: &[Unit]) -> String {
    us.iter()
        .map(|u| (u.page() + 1).to_string())
        .collect::<Vec<_>>()
        .join(", ")
}
fn compare_repeated(
    as_: &[Unit],
    bs: &[Unit],
    method: &str,
    prefix: &str,
    pairs: &mut Vec<Pair>,
    ul: &mut Set<String>,
    ur: &mut Set<String>,
    singles: &mut Vec<(Option<Unit>, Option<Unit>)>,
) {
    let texts = |us: &[Unit]| group(us, &Set::new(), |u| Some(variant(u)));
    let l = texts(as_);
    let r = texts(bs);
    if l.len() == 1 && r.len() == 1 {
        let shown = |us: &[Unit], other: &str, id: String| {
            let i = if l.keys().next() == r.keys().next() {
                None
            } else {
                us.iter().position(|u| u.m.raw != other)
            };
            let mut order = us.to_vec();
            if let Some(i) = i {
                if i > 0 {
                    let u = order.remove(i);
                    order.insert(0, u)
                }
            }
            let mut u = repeated(&order, id);
            u.repeats = Some(us.to_vec());
            u
        };
        let b = shown(bs, &as_[0].m.raw, format!("{prefix}-right-{}", bs[0].id));
        let a = shown(as_, &b.m.raw, format!("{prefix}-left-{}", as_[0].id));
        bind(pairs, ul, ur, a, b, method, None);
        return;
    }
    let quote = |us: &[Unit]| {
        format!(
            "“{}”{}",
            trim(&us[0].m.raw),
            if us.iter().map(|u| trim(&u.m.raw)).collect::<Set<_>>().len() > 1 {
                " and other variants (page numbers vary by page)"
            } else {
                ""
            }
        )
    };
    for (own, other, is_right) in [(&r, &l, true), (&l, &r, false)] {
        let (name, other_name) = if is_right {
            ("Revised", "Baseline")
        } else {
            ("Baseline", "Revised")
        };
        let unchanged: Vec<_> = own
            .iter()
            .filter(|(t, _)| other.contains_key(*t))
            .flat_map(|(_, us)| us.clone())
            .collect();
        for (text, us) in own {
            if other.contains_key(text) {
                continue;
            }
            let kept = if other.len() == 1 {
                other.values().next()
            } else {
                None
            };
            if kept.is_none() && own.len() == 1 {
                continue;
            }
            let mut note = format!(
                "Text varies within this group: {name} pages {} show {} text",
                page_list(us),
                if is_right { "revised" } else { "baseline" }
            );
            if let Some(kept) = kept {
                if !unchanged.is_empty() {
                    note += &format!(
                        "; {name} pages {} retain {other_name} text {}",
                        page_list(&unchanged),
                        quote(kept)
                    );
                }
            } else {
                note += &format!("; {other_name} has no identical text")
            };
            let mut card = repeated(
                us,
                format!(
                    "{prefix}-{}-{}",
                    if is_right { "right" } else { "left" },
                    us[0].id
                ),
            );
            card.others = unchanged.clone();
            card.separate = true;
            card.note = note;
            if let Some(kept) = kept {
                let whole = repeated(
                    kept,
                    format!(
                        "{prefix}-{}-{}",
                        if is_right { "left" } else { "right" },
                        kept[0].id
                    ),
                );
                if is_right {
                    bind(pairs, ul, ur, whole, card, method, None)
                } else {
                    bind(pairs, ul, ur, card, whole, method, None)
                }
            } else {
                singles.push(if is_right {
                    (None, Some(card))
                } else {
                    (Some(card), None)
                });
            }
        }
    }
    let one_sided = |own: &Map<String, Vec<Unit>>, other: &Map<String, Vec<Unit>>| {
        own.keys().any(|t| !other.contains_key(t))
    };
    if (l.len() == 1 && one_sided(&r, &l)) || (r.len() == 1 && one_sided(&l, &r)) {
        return;
    }
    for (text, ls) in &l {
        let Some(rs) = r.get(text) else { continue };
        if rs.len() == ls.len() {
            continue;
        }
        let others = |m: &Map<String, Vec<Unit>>| {
            m.iter()
                .filter(|(t, _)| *t != text)
                .flat_map(|(_, us)| us.clone())
                .collect::<Vec<_>>()
        };
        let lo = others(&l);
        let ro = others(&r);
        let mut note = "Other variants of the same line are context only and are excluded from the count for this variant".to_string();
        if !lo.is_empty() {
            note += &format!(": Baseline pages {}", page_list(&lo))
        }
        if !ro.is_empty() {
            note += &format!(
                "{}Revised pages {}",
                if lo.is_empty() { ": " } else { "; " },
                page_list(&ro)
            )
        }
        let mut a = repeated(ls, format!("{prefix}-left-{}", ls[0].id));
        a.others = lo;
        a.separate = true;
        a.note = note;
        let mut b = repeated(rs, format!("{prefix}-right-{}", rs[0].id));
        b.others = ro;
        b.separate = true;
        bind(pairs, ul, ur, a, b, method, None);
    }
}
struct Scoring<'a> {
    budget: &'a V,
    candidates: usize,
    products: u64,
    exhausted: bool,
}
impl Scoring<'_> {
    fn score(&mut self, a: &Unit, b: &Unit, threshold: f64) -> Option<f64> {
        let at = tokenize(&a.m.text);
        let bt = tokenize(&b.m.text);
        let denom = (at.len() + bt.len()) as f64;
        if at.is_empty() || bt.is_empty() || 2. * at.len().min(bt.len()) as f64 / denom < threshold
        {
            return None;
        }
        let counts = |ts: &Vec<String>| {
            let mut m: Map<String, usize> = Map::new();
            for t in ts {
                *m.entry(t.clone()).or_default() += 1
            }
            m
        };
        let ac = counts(&at);
        let bc = counts(&bt);
        let intersection: usize = ac
            .iter()
            .map(|(t, n)| (*n).min(*bc.get(t).unwrap_or(&0)))
            .sum();
        if 2. * intersection as f64 / denom < threshold {
            return None;
        }
        if self.candidates as f64 >= n(&self.budget["candidates"])
            || (self
                .products
                .saturating_add(work_product(at.len(), bt.len()))) as f64
                > n(&self.budget["tokenProducts"])
        {
            self.exhausted = true;
            return None;
        }
        self.candidates += 1;
        self.products += work_product(at.len(), bt.len());
        let v = 2. * lcs_length(&at, &bt) as f64 / denom;
        if v >= threshold { Some(v) } else { None }
    }
}
fn joint_align(
    as_: &[Unit],
    bs: &[Unit],
    heads: &[Headings; 2],
    sc: &mut Scoring,
    threshold: f64,
) -> Vec<(Vec<Unit>, Vec<Unit>, f64)> {
    let _ = heads;
    let w = bs.len() + 1;
    let mut cost = vec![f64::INFINITY; (as_.len() + 1) * w];
    let mut prev = vec![0; cost.len()];
    let mut values = Map::new();
    cost[0] = 0.;
    let choices = [(1, 1), (1, 2), (2, 1), (1, 0), (0, 1)];
    let can_join = |a: &Unit, b: &Unit| {
        a.order + 1 == b.order
            && a.cells.is_none()
            && b.cells.is_none()
            && a.title == b.title
            && a.section() == b.section()
    };
    let get = |us: &[Unit]| {
        if us.len() == 1 {
            us[0].clone()
        } else {
            aggregate(
                us,
                us.iter()
                    .map(|u| {
                        u.m.refs
                            .iter()
                            .flatten()
                            .next()
                            .map(|r| format!("{}:{}:{}", r.p, r.c, r.l))
                            .unwrap_or(u.id.clone())
                    })
                    .collect::<Vec<_>>()
                    .join("+"),
                false,
            )
        }
    };
    for i in 0..=as_.len() {
        for j in 0..=bs.len() {
            crate::checkpoint();
            for (c, (di, dj)) in choices.iter().copied().enumerate() {
                if i + di > as_.len()
                    || j + dj > bs.len()
                    || (di == 2 && !can_join(&as_[i], &as_[i + 1]))
                    || (dj == 2 && !can_join(&bs[j], &bs[j + 1]))
                {
                    continue;
                }
                let value = if di > 0 && dj > 0 {
                    let aa = &as_[i..i + di];
                    let bb = &bs[j..j + dj];
                    if aa.iter().chain(bb).any(|u| u.cells.is_some()) {
                        None
                    } else {
                        let a = get(aa);
                        let b = get(bb);
                        if a.title != b.title
                            || a.section() != b.section()
                            || as_
                                .iter()
                                .filter(|u| u.m.raw == a.m.raw && u.title == a.title)
                                .count()
                                > 1
                            || bs
                                .iter()
                                .filter(|u| u.m.raw == b.m.raw && u.title == b.title)
                                .count()
                                > 1
                        {
                            None
                        } else {
                            sc.score(&a, &b, threshold)
                        }
                    }
                } else {
                    None
                };
                if di > 0 && dj > 0 && value.is_none() {
                    continue;
                }
                let next = (i + di) * w + j + dj;
                let v = cost[i * w + j]
                    + if di > 0 && dj > 0 {
                        1. - value.unwrap() + 0.03 * (di + dj - 2) as f64
                    } else {
                        1.
                    };
                if v < cost[next] - 1e-12 {
                    cost[next] = v;
                    prev[next] = c + 1;
                    if let Some(v) = value {
                        values.insert(next, v);
                    }
                }
            }
        }
    }
    let (mut i, mut j) = (as_.len(), bs.len());
    let mut out = vec![];
    while i > 0 || j > 0 {
        let c = prev[i * w + j];
        if c == 0 {
            break;
        }
        let (di, dj) = choices[c - 1];
        if di > 0 && dj > 0 {
            out.push((
                as_[i - di..i].to_vec(),
                bs[j - dj..j].to_vec(),
                values[&(i * w + j)],
            ));
        }
        i -= di;
        j -= dj;
    }
    out.reverse();
    out
}
pub fn compare(l: &Doc, r: &Doc, p: &V, budget: &V) -> Result<V, String> {
    if digest(&l.meta["extractor"]) != digest(&r.meta["extractor"]) {
        return Err("Both documents must be extracted with the same engine, version and options".into());
    }
    crate::notify(0);
    let snapshots = [l.snapshot(), r.snapshot()];
    let mut coverage = vec![];
    for (d, side) in [(l, "left"), (r, "right")] {
        for page in &d.pages {
            for issue in &page.issues {
                let mut i = issue.clone();
                i["side"] = json!(side);
                coverage.push(i)
            }
        }
    }
    crate::notify(1);
    let shared = [furniture_signatures(l), furniture_signatures(r)].concat();
    let la: Vec<_> = structure(l, p, &shared)?
        .into_iter()
        .filter(|u| u.role != "logical_separator")
        .collect();
    let rb: Vec<_> = structure(r, p, &shared)?
        .into_iter()
        .filter(|u| u.role != "logical_separator")
        .collect();
    let mut pairs = vec![];
    let (mut ul, mut ur) = (Set::new(), Set::new());
    let mut un = vec![];
    let mut layout = [Set::new(), Set::new()];
    let titled = |u: &&Unit| u.role == "page_heading" || u.role == "heading";
    let tl: Set<_> = la.iter().filter(titled).map(|u| trim(&u.m.raw)).collect();
    let tr: Set<_> = rb.iter().filter(titled).map(|u| trim(&u.m.raw)).collect();
    for (side, us) in [&la, &rb].iter().enumerate() {
        for u in us.iter().filter(titled) {
            if let Some(m) = re(r"(?i)^(.+?)[\s(,:–-]*\b(?:continued|cont['’]d|cont\.?)\)?\.?$")
                .captures(trim(&u.m.raw))
                .ok()
                .flatten()
            {
                let base = trim(m.get(1).unwrap().as_str());
                if tl.contains(base) && tr.contains(base) {
                    layout[side].insert(u.id.clone());
                }
            }
        }
    }
    crate::notify(2);
    let heads = row_headings(&la, &rb);
    let uncertain_l: Vec<_> = la.iter().filter(|u| u.ambiguous).cloned().collect();
    let uncertain_r: Vec<_> = rb.iter().filter(|u| u.ambiguous).cloned().collect();
    for (us, side) in [(&uncertain_l, 0), (&uncertain_r, 1)] {
        for u in us {
            if side == 0 {
                ul.insert(u.id.clone());
            } else {
                ur.insert(u.id.clone());
            }
            un.push(unresolved("ambiguous_identity","These complete text lines may represent multiple records or one record with wrapped cells; local structure and identity remain unresolved, and the source text is retained separately",if side==0{std::slice::from_ref(u)}else{&[]},if side==1{std::slice::from_ref(u)}else{&[]},l,r));
        }
    }
    table_pairs(&la, &rb, &mut pairs, &mut ul, &mut ur, &mut un, l, r);
    let il = group(&la, &ul, |u| u.identity.clone());
    let ir = group(&rb, &ur, |u| u.identity.clone());
    let mut declared = vec![];
    for (key, as_) in il {
        crate::checkpoint();
        let Some(bs) = ir.get(&key) else { continue };
        if as_.len() == 1 && bs.len() == 1 {
            bind(
                &mut pairs,
                &mut ul,
                &mut ur,
                as_[0].clone(),
                bs[0].clone(),
                "reliable-field-identity",
                None,
            )
        } else if as_
            .iter()
            .chain(bs)
            .all(|u| u.path["section"] == "repeated_header" || u.role == "table_header")
        {
            declared.push((as_.clone(), bs.clone()));
            mark(&mut ul, &as_);
            mark(&mut ur, bs);
        } else if as_
            .iter()
            .chain(bs)
            .all(|u| u.role == "field" || u.role == "label")
        {
            let titles: Set<_> = as_
                .iter()
                .map(|u| u.title.clone())
                .filter(|t| !t.is_empty())
                .collect();
            for title in titles {
                let aa: Vec<_> = as_.iter().filter(|u| u.title == title).cloned().collect();
                let bb: Vec<_> = bs.iter().filter(|u| u.title == title).cloned().collect();
                if aa.len() == 1 && bb.len() == 1 {
                    let mut a = aa[0].clone();
                    let mut b = bb[0].clone();
                    for u in [&mut a, &mut b] {
                        if u.section() != title {
                            u.path["section"] = json!(if u.section() == "risk_details" {
                                title.clone()
                            } else {
                                format!("{} / {title}", u.section())
                            });
                        }
                        u.identity = Some(format!(
                            "{}/{}/{}",
                            u.section(),
                            s(&u.path["entity"]),
                            s(&u.path["field"])
                        ));
                    }
                    bind(
                        &mut pairs,
                        &mut ul,
                        &mut ur,
                        a,
                        b,
                        "reliable-field-identity",
                        None,
                    );
                }
            }
            let aa: Vec<_> = as_
                .iter()
                .filter(|u| !ul.contains(&u.id))
                .cloned()
                .collect();
            let bb: Vec<_> = bs.iter().filter(|u| !ur.contains(&u.id)).cloned().collect();
            if !aa.is_empty() && !bb.is_empty() {
                let a = aggregate(&aa, format!("uncertain-field-left-{key}"), true);
                let b = aggregate(&bb, format!("uncertain-field-right-{key}"), true);
                if a.role == "field" {
                    un.push(unresolved(
                        "ambiguous_identity",
                        "Fields with the same name have no unique owner; source changes within the group remain visible, and equal amounts are not used to match fields across positions",
                        &[a.clone()],
                        &[b.clone()],
                        l,
                        r,
                    ));
                }
                mark(&mut ul, &aa);
                mark(&mut ur, &bb);
                bind(
                    &mut pairs,
                    &mut ul,
                    &mut ur,
                    a,
                    b,
                    "unresolved-field-group",
                    None,
                );
            }
        }
    }
    let mut singles = vec![];
    for (a, b) in declared {
        compare_repeated(
            &a,
            &b,
            "repeated-header",
            "repeat",
            &mut pairs,
            &mut ul,
            &mut ur,
            &mut singles,
        )
    }
    let furniture_key = |u: &Unit| {
        u.furniture
            .as_ref()
            .map(|f| format!("{}\0{}\0{}\0{}", f.pattern, f.x0, f.x1, f.y))
    };
    let lf = group(&la, &ul, furniture_key);
    let mut rf = group(&rb, &ur, furniture_key);
    let mut lone = [vec![], vec![]];
    for (_, aa) in lf {
        let f = aa[0].furniture.as_ref().unwrap();
        let distance = |g: &Furniture| {
            let down = (f.y - g.y).abs();
            let across = (f.x0 - g.x0)
                .abs()
                .min((f.x1 - g.x1).abs())
                .min((f.x0 + f.x1 - g.x0 - g.x1).abs() / 2.);
            if down <= 12. && across <= 12. {
                down + across
            } else {
                f64::INFINITY
            }
        };
        let key = rf
            .iter()
            .filter(|(_, bs)| {
                bs[0].furniture.as_ref().unwrap().pattern == f.pattern
                    && distance(bs[0].furniture.as_ref().unwrap()).is_finite()
            })
            .min_by(|(_, a), (_, b)| {
                distance(a[0].furniture.as_ref().unwrap())
                    .total_cmp(&distance(b[0].furniture.as_ref().unwrap()))
            })
            .map(|(key, _)| key.clone());
        mark(&mut ul, &aa);
        if let Some(key) = key {
            let bs = rf.shift_remove(&key).unwrap();
            mark(&mut ur, &bs);
            compare_repeated(
                &aa,
                &bs,
                "page-furniture",
                "furniture",
                &mut pairs,
                &mut ul,
                &mut ur,
                &mut singles,
            )
        } else {
            lone[0].extend(aa)
        }
    }
    for (_, bs) in rf {
        mark(&mut ur, &bs);
        lone[1].extend(bs);
    }
    for (side, us, d) in [(0, &la, l), (1, &rb, r)] {
        let used = if side == 0 { &mut ul } else { &mut ur };
        for (_, mut g) in group(&lone[side], &Set::new(), |u| Some(variant(u))) {
            let text = variant(&g[0]);
            for u in us {
                let f = u.m.refs.iter().flatten().next().unwrap();
                let y = f.ch(d).origin[1];
                if !used.contains(&u.id)
                    && variant(u) == text
                    && (y < 0.16 * d.pages[f.p].height || y > 0.88 * d.pages[f.p].height)
                {
                    g.push(u.clone());
                    used.insert(u.id.clone());
                }
            }
            g.sort_by_key(|u| u.order);
            let mut u = repeated(
                &g,
                format!(
                    "furniture-{}-{}",
                    if side == 0 { "left" } else { "right" },
                    g[0].id
                ),
            );
            u.role = "furniture".into();
            u.furniture = g.iter().find_map(|u| u.furniture.clone());
            u.path["section"] = json!("page_furniture");
            singles.push(if side == 0 {
                (Some(u), None)
            } else {
                (None, Some(u))
            });
        }
    }
    let header_key = |u: &Unit, h: &Headings| {
        if u.cells.is_none() || (test(r"\p{N}", &u.m.raw) && !h.starts.contains(&u.id)) {
            return None;
        }
        if h.starts.contains(&u.id) {
            Some(format!(
                "{}\0{}\0{}\0{}",
                u.section(),
                u.title,
                u.m.raw,
                cell_key(u)
            ))
        } else {
            let mut ids: Vec<_> = identity_cells(u, h).into_iter().collect();
            ids.sort();
            Some(format!(
                "{}\0{}\0{}\0{}",
                h.scope(u),
                u.m.raw,
                canonical(&json!(ids)),
                h.slots(u)
            ))
        }
    };
    let rh = group(&rb, &ur, |u| header_key(u, &heads[1]));
    for (key, as_) in group(&la, &ul, |u| header_key(u, &heads[0])) {
        let Some(bs) = rh.get(&key) else { continue };
        let pages = |us: &Vec<Unit>| us.iter().map(Unit::page).collect::<Set<_>>().len();
        if pages(&as_).max(pages(bs)) < 2 {
            continue;
        }
        mark(&mut ul, &as_);
        mark(&mut ur, bs);
        bind(
            &mut pairs,
            &mut ul,
            &mut ur,
            repeated(&as_, format!("header-left-{}", as_[0].id)),
            repeated(bs, format!("header-right-{}", bs[0].id)),
            "repeated-table-header",
            None,
        );
    }
    let raw_key = |u: &Unit, h: &Headings| {
        if u.identity.is_none() && u.role != "cell" {
            Some(format!(
                "{}/{}{}",
                u.role,
                if u.cells.is_some() {
                    format!("{}\0", h.scope(u))
                } else {
                    String::new()
                },
                u.m.raw
            ))
        } else {
            None
        }
    };
    let el = group(&la, &ul, |u| raw_key(u, &heads[0]));
    let er = group(&rb, &ur, |u| raw_key(u, &heads[1]));
    let same_ids = |a: &Unit, b: &Unit| {
        a.cells.is_none() || b.cells.is_none() || heads[0].slots(a) == heads[1].slots(b)
    };
    for (key, as_) in el {
        crate::checkpoint();
        let Some(bs) = er.get(&key) else { continue };
        if as_.len() == 1 && bs.len() == 1 {
            if same_ids(&as_[0], &bs[0]) {
                bind(
                    &mut pairs,
                    &mut ul,
                    &mut ur,
                    as_[0].clone(),
                    bs[0].clone(),
                    "unique-exact",
                    None,
                )
            }
        } else if as_
            .iter()
            .all(|u| ["page_heading", "footer", "heading"].contains(&u.role.as_str()))
        {
            let mut a = aggregate(&as_, format!("repeat-left-{}", as_[0].id), false);
            let mut b = aggregate(bs, format!("repeat-right-{}", bs[0].id), false);
            a.m.raw = as_[0].m.raw.clone();
            b.m.raw = a.m.raw.clone();
            mark(&mut ul, &as_);
            mark(&mut ur, bs);
            bind(&mut pairs, &mut ul, &mut ur, a, b, "repeat-role", None);
        } else {
            for a in &as_ {
                let cs: Vec<_> = bs
                    .iter()
                    .filter(|b| {
                        !ur.contains(&b.id) && a.section() == b.section() && a.title == b.title
                    })
                    .collect();
                if cs.len() == 1
                    && as_
                        .iter()
                        .filter(|x| x.section() == a.section() && x.title == a.title)
                        .count()
                        == 1
                    && same_ids(a, cs[0])
                {
                    bind(
                        &mut pairs,
                        &mut ul,
                        &mut ur,
                        a.clone(),
                        cs[0].clone(),
                        "exact-context",
                        None,
                    )
                }
            }
        }
    }
    row_identity(
        &la, &rb, &heads, &mut pairs, &mut ul, &mut ur, &mut un, l, r,
    );
    for reverse in [false, true] {
        let (source, target) = if reverse { (&rb, &la) } else { (&la, &rb) };
        for a in source {
            let su = if reverse { &ur } else { &ul };
            if su.contains(&a.id) || a.role != "body" || a.cells.is_some() {
                continue;
            }
            for j in 0..target.len().saturating_sub(1) {
                let (b, c) = (&target[j], &target[j + 1]);
                let tu = if reverse { &ul } else { &ur };
                if tu.contains(&b.id)
                    || tu.contains(&c.id)
                    || b.role != "body"
                    || c.role != "body"
                    || b.cells.is_some()
                    || c.cells.is_some()
                    || b.section() != c.section()
                    || b.title != c.title
                {
                    continue;
                }
                let merged =
                    aggregate(&[b.clone(), c.clone()], format!("{}+{}", b.id, c.id), false);
                if a.m.raw == merged.m.raw {
                    if reverse {
                        mark(&mut ul, &[b.clone(), c.clone()]);
                        bind(
                            &mut pairs,
                            &mut ul,
                            &mut ur,
                            merged,
                            a.clone(),
                            "adjacent-merge",
                            None,
                        )
                    } else {
                        mark(&mut ur, &[b.clone(), c.clone()]);
                        bind(
                            &mut pairs,
                            &mut ul,
                            &mut ur,
                            a.clone(),
                            merged,
                            "adjacent-split",
                            None,
                        )
                    }
                    break;
                }
            }
        }
    }
    let mut sc = Scoring {
        budget,
        candidates: 0,
        products: 0,
        exhausted: false,
    };
    let mut candidates: Vec<(Unit, Unit, f64)> = vec![];
    let anchors = monotone(
        &pairs
            .iter()
            .filter(|p| {
                la.iter().any(|u| u.id == p.a.id)
                    && rb.iter().any(|u| u.id == p.b.id)
                    && p.a.role != "cell"
            })
            .cloned()
            .collect::<Vec<_>>(),
        |p| p.a.order as f64,
        |p| p.b.order as f64,
        |p| {
            if p.method == "reliable-field-identity" {
                4.
            } else {
                2.
            }
        },
    );
    let mut bounds = vec![(-1, -1)];
    bounds.extend(anchors.iter().map(|p| (p.a.order as i32, p.b.order as i32)));
    bounds.push((la.len() as i32, rb.len() as i32));
    for k in 1..bounds.len() {
        if sc.exhausted {
            break;
        }
        let (lo, hi) = (bounds[k - 1], bounds[k]);
        let aa: Vec<_> = la
            .iter()
            .filter(|u| {
                !ul.contains(&u.id)
                    && u.role == "body"
                    && u.order as i32 > lo.0
                    && (u.order as i32) < hi.0
            })
            .cloned()
            .collect();
        let bb: Vec<_> = rb
            .iter()
            .filter(|u| {
                !ur.contains(&u.id)
                    && u.role == "body"
                    && u.order as i32 > lo.1
                    && (u.order as i32) < hi.1
            })
            .cloned()
            .collect();
        if aa.is_empty() || bb.is_empty() || work_product(aa.len(), bb.len()) > 4096 {
            continue;
        }
        let matches = joint_align(&aa, &bb, &heads, &mut sc, n(&p["thresholds"]["local"]));
        if !sc.exhausted {
            for (aa, bb, score) in matches {
                let get = |us: &Vec<Unit>, d: &Doc| {
                    if us.len() == 1 {
                        us[0].clone()
                    } else {
                        aggregate(
                            us,
                            us.iter()
                                .map(|u| {
                                    u.m.refs
                                        .iter()
                                        .flatten()
                                        .next()
                                        .map(|r| r.ch(d).id.clone())
                                        .unwrap_or(u.id.clone())
                                })
                                .collect::<Vec<_>>()
                                .join("+"),
                            false,
                        )
                    }
                };
                mark(&mut ul, &aa);
                mark(&mut ur, &bb);
                bind(
                    &mut pairs,
                    &mut ul,
                    &mut ur,
                    get(&aa, l),
                    get(&bb, r),
                    "joint-local-alignment",
                    Some(score),
                );
            }
        }
    }
    for a in &la {
        if ul.contains(&a.id) || a.role == "cell" {
            continue;
        }
        for b in &rb {
            if ur.contains(&b.id)
                || b.role == "cell"
                || a.role != b.role
                || a.identity != b.identity
                || a.cells.is_some()
                || b.cells.is_some()
            {
                continue;
            }
            let same = a.section() == b.section() && a.title == b.title;
            let at = tokenize(&a.m.text);
            let bt = tokenize(&b.m.text);
            if at.is_empty()
                || bt.is_empty()
                || (!same
                    && (at.len().min(bt.len()) as f64) < n(&p["thresholds"]["globalMinTokens"]))
            {
                continue;
            }
            if let Some(v) = sc.score(
                a,
                b,
                n(&p["thresholds"][if same { "local" } else { "global" }]),
            ) {
                candidates.push((a.clone(), b.clone(), v))
            }
            if sc.exhausted {
                break;
            }
        }
        if sc.exhausted {
            break;
        }
    }
    candidates.sort_by(|x, y| {
        y.2.total_cmp(&x.2)
            .then(x.0.order.cmp(&y.0.order))
            .then(x.1.order.cmp(&y.1.order))
    });
    for (i, (a, b, score)) in candidates.iter().enumerate() {
        if ul.contains(&a.id) || ur.contains(&b.id) {
            continue;
        }
        let tied = candidates.iter().enumerate().any(|(j, o)| {
            i != j
                && o.2 == *score
                && ((o.0.id == a.id && !ur.contains(&o.1.id))
                    || (o.1.id == b.id && !ul.contains(&o.0.id)))
        });
        if !tied {
            bind(
                &mut pairs,
                &mut ul,
                &mut ur,
                a.clone(),
                b.clone(),
                "contextual-token-lcs",
                Some(*score),
            )
        }
    }
    let unmatched_l: Vec<_> = la.iter().filter(|u| !ul.contains(&u.id)).cloned().collect();
    let unmatched_r: Vec<_> = rb.iter().filter(|u| !ur.contains(&u.id)).cloned().collect();
    let (mut al, mut ar) = (Set::new(), Set::new());
    if sc.exhausted {
        un.push(unresolved(
            "budget",
            "Matching work budget exhausted; the following regions were not completed and cannot be reported as unchanged",
            &unmatched_l,
            &unmatched_r,
            l,
            r,
        ));
    } else {
        let group_body = |us: &[Unit]| {
            group(us, &Set::new(), |u| {
                if u.role == "body" {
                    Some(u.m.text.clone())
                } else {
                    None
                }
            })
        };
        let left_groups = group_body(&unmatched_l);
        let right_groups = group_body(&unmatched_r);
        for (key, aa) in left_groups {
            if let Some(bb) = right_groups.get(&key) {
                mark(&mut al, &aa);
                mark(&mut ar, bb);
                un.push(unresolved(
                    "ambiguous_match",
                    "Identity is not unique for this repeated source text; other unambiguous changes remain visible",
                    &aa,
                    bb,
                    l,
                    r,
                ));
            }
        }
    }
    crate::notify(3);
    let body_pairs: Vec<_> = pairs
        .iter()
        .enumerate()
        .filter(|(_, p)| p.a.role == "body" && p.a.section() == p.b.section())
        .map(|(i, _)| i)
        .collect();
    let stable: Set<_> = monotone(
        &body_pairs,
        |i| pairs[*i].a.order as f64,
        |i| pairs[*i].b.order as f64,
        |i| {
            pairs[*i]
                .a
                .m
                .raw
                .encode_utf16()
                .count()
                .min(pairs[*i].b.m.raw.encode_utf16().count()) as f64
        },
    )
    .into_iter()
    .collect();
    let mut diffs = vec![];
    for (i, pair) in pairs.iter().enumerate() {
        crate::checkpoint();
        let moved =
            pair.a.role == "body" && (pair.a.section() != pair.b.section() || !stable.contains(&i));
        emit(
            Some(&pair.a),
            Some(&pair.b),
            &pair.method,
            pair.score,
            moved,
            l,
            r,
            budget,
            &layout,
            &heads,
            &mut diffs,
            &mut un,
        );
    }
    for (a, b) in &singles {
        emit(
            a.as_ref(),
            b.as_ref(),
            "page-furniture",
            None,
            false,
            l,
            r,
            budget,
            &layout,
            &heads,
            &mut diffs,
            &mut un,
        )
    }
    for u in &uncertain_l {
        emit(
            Some(u),
            None,
            "unresolved-row-structure",
            None,
            false,
            l,
            r,
            budget,
            &layout,
            &heads,
            &mut diffs,
            &mut un,
        )
    }
    for u in &uncertain_r {
        emit(
            None,
            Some(u),
            "unresolved-row-structure",
            None,
            false,
            l,
            r,
            budget,
            &layout,
            &heads,
            &mut diffs,
            &mut un,
        )
    }
    if !sc.exhausted {
        for u in &unmatched_l {
            if !al.contains(&u.id) {
                emit(
                    Some(u),
                    None,
                    "unmatched",
                    None,
                    false,
                    l,
                    r,
                    budget,
                    &layout,
                    &heads,
                    &mut diffs,
                    &mut un,
                )
            }
        }
        for u in &unmatched_r {
            if !ar.contains(&u.id) {
                emit(
                    None,
                    Some(u),
                    "unmatched",
                    None,
                    false,
                    l,
                    r,
                    budget,
                    &layout,
                    &heads,
                    &mut diffs,
                    &mut un,
                )
            }
        }
    }
    let position = |u: &Unit, d: &Doc| {
        let f = u.m.refs.iter().flatten().next().unwrap();
        f.p as f64 * 1_000_000. + f.ch(d).origin[1]
    };
    let ap = monotone(
        &pairs
            .iter()
            .filter(|p| {
                p.a.m.refs.first().copied().flatten().is_some()
                    && p.b.m.refs.first().copied().flatten().is_some()
                    && p.a.path["confidence"] != "unresolved"
            })
            .cloned()
            .collect::<Vec<_>>(),
        |p| position(&p.a, l),
        |p| position(&p.b, r),
        |p| {
            if p.method == "reliable-field-identity" {
                4.
            } else {
                1.
            }
        },
    );
    let alignment:Vec<_>=ap.iter().map(|p|{let a=p.a.m.refs.iter().flatten().next().unwrap();let b=p.b.m.refs.iter().flatten().next().unwrap();json!({"leftPage":a.p,"leftY":a.ch(l).origin[1],"rightPage":b.p,"rightY":b.ch(r).origin[1]})}).collect();
    let source_pos = |d: &V| {
        let loc = d["left"]
            .as_array()
            .and_then(|x| x.first())
            .or_else(|| d["right"].as_array().and_then(|x| x.first()));
        loc.map(|x| {
            n(&x["pageIndex"]) * 1_000_000.
                + [1, 3, 5, 7]
                    .iter()
                    .map(|i| n(&x["quads"][0][*i]))
                    .fold(f64::INFINITY, f64::min)
        })
        .unwrap_or(-1.)
    };
    diffs.sort_by(|a, b| {
        source_pos(a)
            .total_cmp(&source_pos(b))
            .then(s(&a["id"]).cmp(s(&b["id"])))
    });
    let count = diffs.len();
    let occurrences: usize = diffs
        .iter()
        .map(|d| d["occurrences"].as_array().unwrap().len().max(1))
        .sum();
    let result = json!({"schemaVersion":"policy-compare-result/2","coreVersion":crate::CORE_VERSION,"extractors":[l.meta["extractor"],r.meta["extractor"]],"snapshotHashVersion":"page-merkle/1","tokenizerVersion":"unicode-tokens/1","profileVersion":p["version"],"documentHashes":[l.meta["contentHash"],r.meta["contentHash"]],"extractionSnapshotHashes":snapshots,"configDigest":digest(&json!({"profile":p,"budget":budget})),"scope":"extracted_text","status":if coverage.is_empty()&&un.is_empty(){"complete_for_scope"}else{"partial"},"differences":diffs,"coverage":coverage,"unresolved":un,"alignment":alignment,"stats":{"leftScalars":l.pages.iter().map(|p|p.chars.last().map(|c|c.raw_range[1]).unwrap_or(0)).sum::<usize>(),"rightScalars":r.pages.iter().map(|p|p.chars.last().map(|c|c.raw_range[1]).unwrap_or(0)).sum::<usize>(),"candidates":sc.candidates,"tokenProducts":sc.products,"differenceCount":count,"occurrenceCount":occurrences},"diagnostics":[]});
    crate::notify(4);
    Ok(result)
}
fn emit(
    a: Option<&Unit>,
    b: Option<&Unit>,
    method: &str,
    score: Option<f64>,
    moved: bool,
    l: &Doc,
    r: &Doc,
    budget: &V,
    layout: &[Set<String>; 2],
    heads: &[Headings; 2],
    diffs: &mut Vec<V>,
    un: &mut Vec<V>,
) {
    let ar = a.and_then(|u| u.repeats.as_ref());
    let br = b.and_then(|u| u.repeats.as_ref());
    let recount = ar.is_some() && br.is_some() && ar.unwrap().len() != br.unwrap().len();
    if let (Some(a), Some(b)) = (a, b) {
        if a.m.raw == b.m.raw && !moved && !recount {
            if a.cells.is_some() && b.cells.is_some() && heads[0].slots(a) != heads[1].slots(b) {
                un.push(unresolved(
                    "ambiguous_match",
                    "This table row has identical source text in both versions, but the cell boundaries differ; column ownership of the values is unresolved",
                    &[a.clone()],
                    &[b.clone()],
                    l,
                    r,
                ));
            }
            return;
        }
    }
    let kind = if moved {
        "Moved"
    } else if a.is_some() && b.is_some() {
        "Replaced"
    } else if a.is_some() {
        "Removed"
    } else {
        "Added"
    };
    let u = a.or(b).unwrap();
    let old = a.map(|u| u.m.raw.as_str()).unwrap_or("");
    let now = b.map(|u| u.m.raw.as_str()).unwrap_or("");
    let left = a.map(|u| u.loc(l, "left")).unwrap_or_default();
    let right = b.map(|u| u.loc(r, "right")).unwrap_or_default();
    let ops = text_ops(a, b, l, r, budget, un);
    let mut occ = vec![];
    if a.map(|u| u.separate).unwrap_or(false) || b.map(|u| u.separate).unwrap_or(false) {
        for (side, u, d) in [("left", a, l), ("right", b, r)] {
            if let Some(u) = u {
                for g in u.repeats.iter().flatten() {
                    let mut v = json!({"left":[],"right":[]});
                    v[side] = json!(g.loc(d, side));
                    occ.push(v)
                }
                for g in &u.others {
                    let mut v = json!({"left":[],"right":[],"context":true});
                    v[side] = json!(g.loc(d, side));
                    occ.push(v)
                }
            }
        }
    } else if ar.is_some() || br.is_some() {
        for i in 0..ar
            .map(Vec::len)
            .unwrap_or(0)
            .max(br.map(Vec::len).unwrap_or(0))
        {
            occ.push(json!({"left":ar.and_then(|us|us.get(i)).map(|u|u.loc(l,"left")).unwrap_or_default(),"right":br.and_then(|us|us.get(i)).map(|u|u.loc(r,"right")).unwrap_or_default()}));
        }
    }
    let repeat = if ar.is_some() || br.is_some() {
        json!({"left":ar.map(Vec::len).unwrap_or(0),"right":br.map(Vec::len).unwrap_or(0),"leftPages":l.pages.len(),"rightPages":r.pages.len()})
    } else {
        V::Null
    };
    let reasons = if u.path["confidence"] == "unresolved" {
        vec![if u.path["table"].is_string() {
            "A unique table row identity could not be established".to_string()
        } else {
            "A unique owner could not be established for fields with the same name".into()
        }]
    } else if ar.is_some() || br.is_some() {
        let notes = a
            .into_iter()
            .chain(b)
            .filter(|u| !u.note.is_empty())
            .map(|u| format!("; {}", u.note))
            .collect::<String>();
        vec![format!(
            "Text occurrences: {} → {}; document pages: {} → {}{}; see occurrence locations for each source",
            ar.map(Vec::len).unwrap_or(0),
            br.map(Vec::len).unwrap_or(0),
            l.pages.len(),
            r.pages.len(),
            notes
        )]
    } else {
        vec![]
    };
    let id = format!(
        "d-{}",
        &digest(
            &json!({"kind":kind,"old":old,"new":now,"left":left.iter().map(|x|x["charIds"].clone()).collect::<Vec<_>>(),"right":right.iter().map(|x|x["charIds"].clone()).collect::<Vec<_>>()})
        )[..20]
    );
    diffs.push(json!({"id":id,"kind":kind,"structurePath":u.path,"left":left,"right":right,"oldText":old,"newText":now,"textOps":ops,"hasTextChange":old!=now,"facts":facts(a,b,layout),"repeat":repeat,"defaultVisible":true,"matchEvidence":{"method":method,"score":score,"details":[if method=="reliable-field-identity"{"Entity and field identities match"}else{method}]},"reviewReasons":reasons,"occurrences":occ}));
}
