use crate::{edits::*, model::*, structure::*, text::*};
use crate::match_index::{label, token_score, ReflowIndex, SourceIndex, TokenIndex, WindowText, MIN_SCORE};
use serde_json::json;
#[derive(Clone)]
struct Pair {
    a: Unit,
    b: Unit,
    method: &'static str,
    score: Option<f64>,
}
fn issue(reason: &str, message: &str, a: &[Unit], b: &[Unit], l: &Doc, r: &Doc) -> V {
    json!({"reason":reason,"message":message,"left":a.iter().flat_map(|u|u.loc(l,"left")).collect::<Vec<_>>(),"right":b.iter().flat_map(|u|u.loc(r,"right")).collect::<Vec<_>>(),"defaultVisible":true})
}
// A rectangle's first row only proposes column labels. A non-identity
// permutation needs a witness in the following rows and may not turn a value
// which stayed in its original column into a definite edit. This is evidence
// for a shared column transformation, not a declaration of header semantics.
fn column_mapping(a: &[Unit], b: &[Unit], ha: usize, hb: usize) -> Option<Vec<usize>> {
    let ca = &a[ha].cells;
    let cb = &b[hb].cells;
    if ca.len() != cb.len()
        || !ca
            .iter()
            .all(|c| ca.iter().filter(|x| *x == c).count() == 1 && cb.contains(c))
    {
        return None;
    }
    let map: Vec<_> = ca
        .iter()
        .map(|c| cb.iter().position(|x| x == c).unwrap())
        .collect();
    if map.iter().enumerate().all(|(k, j)| k == *j) {
        return Some(map);
    }
    let end = |us: &[Unit], h: usize| {
        let mut k = h + 1;
        while k < us.len()
            && us[k].cells.len() > 1
            && us[k].page() == us[h].page()
            && us[k].cells.len() == us[h].cells.len()
        {
            k += 1
        }
        k
    };
    let na = end(a, ha) - ha - 1;
    let nb = end(b, hb) - hb - 1;
    if na == 0 || na != nb {
        return None;
    }
    let mut witnessed = false;
    for offset in 1..=na {
        for (k, j) in map.iter().enumerate().filter(|(k, j)| *k != **j) {
            let old = &a[ha + offset].cells[k];
            let same = &b[hb + offset].cells[k];
            let mapped = &b[hb + offset].cells[*j];
            if old == same && old != mapped {
                return None;
            }
            witnessed |= old == mapped && old != same;
        }
    }
    witnessed.then_some(map)
}
fn bind(
    pairs: &mut Vec<Pair>,
    ul: &mut Set<usize>,
    ur: &mut Set<usize>,
    a: &[Unit],
    b: &[Unit],
    i: usize,
    j: usize,
    method: &'static str,
    score: Option<f64>,
) {
    ul.insert(i);
    ur.insert(j);
    pairs.push(Pair {
        a: a[i].clone(),
        b: b[j].clone(),
        method,
        score,
    });
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
    diffs: &mut Vec<V>,
    un: &mut Vec<V>,
) {
    let old = a.map(|u| u.m.raw.as_str()).unwrap_or("");
    let now = b.map(|u| u.m.raw.as_str()).unwrap_or("");
    if old == now && !moved {
        return;
    }
    let positions = |u: &Unit, d: &Doc| {
        u.m.refs
            .iter()
            .flatten()
            .map(|r| (r.p, r.ch(d).quad, r.line(d).direction))
            .collect::<Vec<_>>()
    };
    let moved = moved && !matches!((a,b),(Some(a),Some(b)) if positions(a,l)==positions(b,r));
    if old == now && !moved {
        return;
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
    let left = a.map(|u| u.loc(l, "left")).unwrap_or_default();
    let right = b.map(|u| u.loc(r, "right")).unwrap_or_default();
    let ops = text_ops(a, b, l, r, budget, un);
    let id = format!(
        "d-{}",
        &digest(&json!({"kind":kind,"old":old,"new":now,"left":left,"right":right}))[..20]
    );
    let facts: Vec<&str> = if old != now && words(old) == words(now) {
        vec!["whitespace_only"]
    } else {
        vec![]
    };
    diffs.push(json!({"id":id,"kind":kind,"structurePath":a.or(b).unwrap().path,"left":left,"right":right,"oldText":old,"newText":now,"textOps":ops,"hasTextChange":old!=now,"facts":facts,"repeat":null,"defaultVisible":true,"matchEvidence":{"method":method,"score":score,"details":["Engineering correspondence from source text and local context; no business identity or probability is asserted",method]},"reviewReasons":[],"occurrences":[]}));
}
fn bind_local_intervals(
    left: &SourceIndex,
    right: &SourceIndex,
    pairs: &mut Vec<Pair>,
    ul: &mut Set<usize>,
    ur: &mut Set<usize>,
) {
    let (a, b) = (left.units, right.units);
    let anchors = monotone(
        &(0..pairs.len()).collect::<Vec<_>>(),
        |i| pairs[*i].a.order as f64,
        |i| pairs[*i].b.order as f64,
        |i| pairs[*i].a.m.raw.len() as f64,
    );
    let mut bounds = vec![(-1isize, -1isize)];
    bounds.extend(
        anchors
            .iter()
            .map(|i| (pairs[*i].a.order as isize, pairs[*i].b.order as isize)),
    );
    bounds.push((a.len() as isize, b.len() as isize));
    for w in bounds.windows(2) {
        let aa: Vec<_> = ((w[0].0 + 1) as usize..w[1].0 as usize)
            .filter(|i| !ul.contains(i)).take(2).collect();
        let bb: Vec<_> = ((w[0].1 + 1) as usize..w[1].1 as usize)
            .filter(|j| !ur.contains(j)).take(2).collect();
        if aa.len() == 1 && bb.len() == 1 && left.permits_table_pair(aa[0], right, bb[0]) {
            let i = aa[0];
            let j = bb[0];
            let repeated = left.count(&a[i].m.text) > 1
                || right.count(&b[j].m.text) > 1;
            // Repeated page lines can use explicit adjacent anchors on each page;
            // a repeated data row without such context remains local ambiguity.
            let bounded = w[0].0 >= 0
                && w[1].0 < a.len() as isize
                && w[0].1 >= 0
                && w[1].1 < b.len() as isize;
            let ctx = left.contexts[i];
            let anchored_context = ctx == right.contexts[j]
                && !ctx.is_empty()
                && left.count(ctx) == 1
                && right.count(ctx) == 1;
            if !repeated
                || anchored_context
                || bounded && a[i].cells.len() == 1 && label(&a[i]).is_some()
            {
                bind(
                    pairs,
                    ul,
                    ur,
                    a,
                    b,
                    i,
                    j,
                    "neighboring-source-anchors",
                    None,
                );
            }
        }
    }
}
pub fn compare(l: &Doc, r: &Doc, p: &V, budget: &V) -> Result<V, String> {
    if l.meta["extractor"] != r.meta["extractor"] {
        return Err("Both documents must use the same engine, version and options".into());
    }
    crate::notify(0);
    let snapshots = [l.snapshot(), r.snapshot()];
    let mut coverage = vec![];
    for (side, d) in [("left", l), ("right", r)] {
        for page in &d.pages {
            for v in &page.issues {
                let mut v = v.clone();
                v["side"] = json!(side);
                coverage.push(v)
            }
        }
        coverage.extend(language_gaps(d, side));
    }
    crate::notify(1);
    let a = structure(l);
    let b = structure(r);
    coverage.extend(structure_gaps(&a, l, "left"));
    coverage.extend(structure_gaps(&b, r, "right"));
    let mut pairs = vec![];
    let mut ul = Set::new();
    let mut ur = Set::new();
    let mut un = vec![];
    crate::notify(2);
    let candidate_limit = n(&budget["candidates"]) as u64;
    let token_limit = n(&budget["tokenProducts"]) as u64;
    let has_tokens = |us: &[Unit]| us.iter().any(|u| !tokenize(&u.m.text).is_empty());
    if candidate_limit == 0 || (token_limit == 0 && has_tokens(&a) && has_tokens(&b)) {
        un.push(issue("budget","Matching is disabled by the configured work budget; these source regions have not been compared",&a,&b,l,r));
        crate::notify(3);
        crate::notify(4);
        return Ok(finish(
            l,
            r,
            p,
            budget,
            snapshots,
            coverage,
            un,
            vec![],
            vec![],
            0,
            0,
        ));
    }
    let mut candidates = 0u64;
    let mut products = 0u64;
    let mut exhausted = false;
    // Reflow: compare small consecutive groups before any occurrence is consumed.
    // This is exact text equivalence only, with raw whitespace retained in ops.
    {
        let left_text = WindowText::from_raw(a.iter().map(|u| u.m.raw.as_str()));
        let right_text = WindowText::from_raw(b.iter().map(|u| u.m.raw.as_str()));
        let mut windows = ReflowIndex::new(&a, &left_text, &b, &right_text);
        for (i, unit) in a.iter().enumerate() {
            crate::checkpoint();
            if ul.contains(&i) || unit.cells.len() > 1 {
                continue;
            }
            if let Some((j, na, nb)) = windows.earliest(&a, &left_text, i, &ul, &ur) {
                if candidates >= candidate_limit {
                    exhausted = true;
                    break;
                }
                candidates += 1;
                ul.extend(i..i + na);
                ur.extend(j..j + nb);
                pairs.push(Pair {
                    a: joined(&a[i..i + na]),
                    b: joined(&b[j..j + nb]),
                    method: "exact-text-reflow",
                    score: None,
                });
            }
        }
    }
    let left = SourceIndex::new(&a);
    let right = SourceIndex::new(&b);
    // Exact rows may move as a whole; labels repeated under different local
    // blocks cannot exchange values by using global text equality.
    for i in 0..a.len() {
        if ul.contains(&i) {
            continue;
        }
        crate::checkpoint();
        let Some(positions) = right.by_text.get(a[i].m.text.as_str()) else {
            continue;
        };
        let unique = label(&a[i]).is_none()
            && !test(r"\p{N}", &a[i].m.text)
            && left.count(&a[i].m.text) == 1
            && positions.len() == 1;
        if let Some(&j) = positions.iter().find(|&&j| {
            !ur.contains(&j)
                && left.permits_table_pair(i, &right, j)
                && (unique || left.contexts[i] == right.contexts[j])
        }) {
            bind(
                &mut pairs, &mut ul, &mut ur, &a, &b, i, j, "exact-source-text", None,
            );
        }
    }
    // Local literal labels are useful without a field-name whitelist.
    for i in 0..a.len() {
        if ul.contains(&i) {
            continue;
        }
        let Some(key) = label(&a[i]) else { continue };
        let key = (key, left.contexts[i]);
        let sole_available = |positions: &[usize], used: &Set<usize>| {
            let mut free = positions.iter().copied().filter(|k| !used.contains(k));
            let first = free.next()?;
            free.next().is_none().then_some(first)
        };
        let j = right.by_label.get(&key)
            .and_then(|js| sole_available(js, &ur));
        if let Some(j) = j.filter(|_| sole_available(&left.by_label[&key], &ul) == Some(i)) {
            bind(
                &mut pairs, &mut ul, &mut ur, &a, &b, i, j,
                "literal-label-and-local-context",
                None,
            );
        }
    }
    // Match tables using cell content and header text at the cells' columns.
    // Column names are source text; their spelling has no privileged meaning.
    let mut mappings: Map<(usize, usize), Option<Vec<usize>>> = Map::new();
    let mut shared_cells = |i: usize, j: usize| {
        let map = match (left.headers[i], right.headers[j]) {
            (Some(ha), Some(hb)) => mappings
                .entry((ha, hb))
                .or_insert_with(|| column_mapping(&a, &b, ha, hb))
                .as_ref(),
            _ => None,
        };
        a[i].cells
            .iter()
            .enumerate()
            .filter(|(k, c)| b[j].cells.get(map.map(|m| m[*k]).unwrap_or(*k)) == Some(*c))
            .count()
    };
    for i in 0..a.len() {
        if ul.contains(&i) || a[i].cells.len() < 2 {
            continue;
        }
        let mut candidates = vec![];
        crate::checkpoint();
        for j in 0..b.len() {
            if ur.contains(&j)
                || b[j].cells.len() != a[i].cells.len()
                || !left.permits_table_pair(i, &right, j)
            {
                continue;
            }
            let same = shared_cells(i, j);
            if same > 0 {
                candidates.push((j, same));
            }
        }
        candidates.sort_by_key(|x| std::cmp::Reverse(x.1));
        if let Some(&(j, n)) = candidates.first() {
            let reverse = (0..a.len())
                .filter(|k| {
                    !ul.contains(k)
                        && a[*k].cells.len() == b[j].cells.len()
                        && left.permits_table_pair(*k, &right, j)
                })
                .map(|k| shared_cells(k, j))
                .max()
                .unwrap_or(0);
            if candidates.iter().filter(|x| x.1 == n).count() == 1
                && reverse == n
                && (0..a.len())
                    .filter(|k| {
                        !ul.contains(k)
                            && a[*k].cells.len() == b[j].cells.len()
                            && left.permits_table_pair(*k, &right, j)
                            && shared_cells(*k, j) == n
                    })
                    .count()
                    == 1
            {
                bind(
                    &mut pairs,
                    &mut ul,
                    &mut ur,
                    &a,
                    &b,
                    i,
                    j,
                    "source-cells-and-column-text",
                    None,
                );
            }
        }
    }
    // Unique remaining units between stable source anchors support arbitrary
    // local replacements, including words with no shared tokens. Repeated
    // source rows do not gain an invented identity from their order.
    bind_local_intervals(&left, &right, &mut pairs, &mut ul, &mut ur);
    let mut scored = vec![];
    let right_tokens: Vec<_> = b.iter().enumerate()
        .map(|(j, u)| {
            if ur.contains(&j) || exhausted {
                Vec::new()
            } else {
                tokenize(&u.m.text)
            }
        })
        .collect();
    let token_index = TokenIndex::new(&right_tokens);
    for i in 0..a.len() {
        if exhausted {
            break;
        }
        if ul.contains(&i) {
            continue;
        }
        let ta = tokenize(&a[i].m.text);
        for j in token_index.candidates(&ta) {
            if !left.permits_table_pair(i, &right, j) {
                continue;
            }
            crate::checkpoint();
            let tb = &right_tokens[j];
            let work = work_product(ta.len(), tb.len());
            if candidates >= candidate_limit || work > token_limit.saturating_sub(products)
            {
                exhausted = true;
                break;
            }
            candidates += 1;
            products += work;
            let score = token_score(lcs_length(&ta, tb), ta.len(), tb.len());
            if score >= MIN_SCORE {
                scored.push((i, j, score));
            }
        }
    }
    // A still-unexamined competitor may change either endpoint's pairing.
    if exhausted {
        scored.clear();
    }
    scored.sort_by(|x, y| y.2.total_cmp(&x.2).then(x.0.cmp(&y.0)).then(x.1.cmp(&y.1)));
    for &(i, j, score) in &scored {
        if ul.contains(&i) || ur.contains(&j) {
            continue;
        }
        let tied = scored.iter().any(|&(ii, jj, ss)| {
            ss == score
                && (ii != i || jj != j)
                && !ul.contains(&ii)
                && !ur.contains(&jj)
                && (ii == i || jj == j)
        });
        let repeated = left.count(&a[i].m.text) > 1
            || right.count(&b[j].m.text) > 1;
        let ctx = left.contexts[i];
        let anchored_context = ctx == right.contexts[j]
            && !ctx.is_empty()
            && left.count(ctx) == 1
            && right.count(ctx) == 1;
        if !tied && (!repeated || anchored_context) {
            bind(
                &mut pairs,
                &mut ul,
                &mut ur,
                &a,
                &b,
                i,
                j,
                "local-source-token-correspondence",
                Some(score),
            );
        }
    }
    if !exhausted {
        bind_local_intervals(&left, &right, &mut pairs, &mut ul, &mut ur);
    }
    let al: Vec<_> = a
        .iter()
        .enumerate()
        .filter(|(i, _)| !ul.contains(i))
        .map(|(_, u)| u.clone())
        .collect();
    let br: Vec<_> = b
        .iter()
        .enumerate()
        .filter(|(i, _)| !ur.contains(i))
        .map(|(_, u)| u.clone())
        .collect();
    if exhausted {
        un.push(issue(
            "budget",
            "Matching work budget exhausted; these concrete source regions were not completed",
            &al,
            &br,
            l,
            r,
        ));
    } else {
        // Ambiguity is recorded only for connected competing candidates. Changed
        // occurrences still appear below, with actual inserted/deleted text.
        for x in &al {
            let bs: Vec<_> = br
                .iter()
                .filter(|y| {
                    scored
                        .iter()
                        .any(|(i, j, _)| a[*i].id == x.id && b[*j].id == y.id)
                })
                .cloned()
                .collect();
            if !bs.is_empty() {
                un.push(issue("ambiguous_match","Repeated source or competing local correspondences; no unique pairing is asserted. The actual old and new occurrences are shown separately",&[x.clone()],&bs,l,r));
            }
        }
    }
    crate::notify(3);
    let mut diffs = vec![];
    let stable: Set<_> = monotone(
        &(0..pairs.len()).collect::<Vec<_>>(),
        |i| pairs[*i].a.order as f64,
        |i| pairs[*i].b.order as f64,
        |i| pairs[*i].a.m.raw.len() as f64,
    )
    .into_iter()
    .collect();
    let mut alignment = vec![];
    for (i, pair) in pairs.iter().enumerate() {
        let row_moved = !stable.contains(&i)
            || (pair.a.order != pair.b.order
                && left.contexts[pair.a.order] != right.contexts[pair.b.order]);
        if stable.contains(&i) {
            let aa = pair.a.m.refs.iter().flatten().next().unwrap();
            let bb = pair.b.m.refs.iter().flatten().next().unwrap();
            alignment.push(json!({"leftPage":aa.p,"leftY":aa.ch(l).origin[1],"rightPage":bb.p,"rightY":bb.ch(r).origin[1]}));
        }
        if let (Some(ha), Some(hb)) = (
            left.headers[pair.a.order],
            right.headers[pair.b.order],
        ) {
            let map = mappings
                .entry((ha, hb))
                .or_insert_with(|| column_mapping(&a, &b, ha, hb));
            if let Some(map) = map {
                for (k, j) in map.iter().enumerate() {
                    let aa = cell_unit(&pair.a, k, l);
                    let bb = cell_unit(&pair.b, *j, r);
                    emit(
                        Some(&aa),
                        Some(&bb),
                        "source-column-text",
                        None,
                        row_moved || k != *j,
                        l,
                        r,
                        budget,
                        &mut diffs,
                        &mut un,
                    );
                }
                continue;
            }
        }
        // A row's literal cells can change position without establishing that
        // this row is a header. Do not propagate this permutation by itself.
        if left.headers[pair.a.order].is_none()
            && right.headers[pair.b.order].is_none()
            && pair.a.cells.len() > 1
            && pair.a.cells.len() == pair.b.cells.len()
            && a.get(pair.a.order + 1)
                .is_some_and(|u| u.cells.len() == pair.a.cells.len())
            && b.get(pair.b.order + 1)
                .is_some_and(|u| u.cells.len() == pair.b.cells.len())
            && pair.a.cells.iter().all(|c| {
                pair.a.cells.iter().filter(|x| *x == c).count() == 1 && pair.b.cells.contains(c)
            })
        {
            for (k, name) in pair.a.cells.iter().enumerate() {
                let j = pair.b.cells.iter().position(|c| c == name).unwrap();
                let aa = cell_unit(&pair.a, k, l);
                let bb = cell_unit(&pair.b, j, r);
                emit(
                    Some(&aa),
                    Some(&bb),
                    "literal-cell-position",
                    None,
                    row_moved || k != j,
                    l,
                    r,
                    budget,
                    &mut diffs,
                    &mut un,
                );
            }
            continue;
        }
        emit(
            Some(&pair.a),
            Some(&pair.b),
            pair.method,
            pair.score,
            !stable.contains(&i),
            l,
            r,
            budget,
            &mut diffs,
            &mut un,
        );
    }
    if !exhausted {
        for u in &al {
            emit(
                Some(u),
                None,
                "unmatched",
                None,
                false,
                l,
                r,
                budget,
                &mut diffs,
                &mut un,
            )
        }
        for u in &br {
            emit(
                None,
                Some(u),
                "unmatched",
                None,
                false,
                l,
                r,
                budget,
                &mut diffs,
                &mut un,
            )
        }
    }
    // Count-only folding is last: never erase a local replacement merely
    // because the same values or total counts occur elsewhere in the document.
    let mut left_raw: Map<&str, Vec<&Unit>> = Map::new();
    let mut right_raw: Map<&str, Vec<&Unit>> = Map::new();
    for u in &a {
        left_raw.entry(&u.m.raw).or_default().push(u);
    }
    for u in &b {
        right_raw.entry(&u.m.raw).or_default().push(u);
    }
    let mut counted = Set::new();
    for u in a.iter().chain(b.iter()) {
        if !counted.insert(u.m.raw.as_str()) {
            continue;
        }
        let (Some(aa), Some(bb)) = (
            left_raw.get(u.m.raw.as_str()), right_raw.get(u.m.raw.as_str())
        ) else {
            continue;
        };
        if aa.len() == bb.len() || aa.len().max(bb.len()) < 2 {
            continue;
        }
        if pairs
            .iter()
            .any(|p| (p.a.m.raw == u.m.raw || p.b.m.raw == u.m.raw) && p.a.m.raw != p.b.m.raw)
        {
            continue;
        }
        // Table rows keep their local record relation; count-only summaries are
        // restricted to a single source line, never a collection of cell values.
        if aa.iter().chain(bb).any(|x| x.cells.len() != 1) {
            continue;
        }
        let mut summary = vec![];
        emit(
            Some(aa[0]),
            None,
            "occurrence-count-only",
            None,
            false,
            l,
            r,
            budget,
            &mut summary,
            &mut un,
        );
        let mut v = summary.remove(0);
        v["id"] = json!(format!("count-{}", &digest(&json!(u.m.raw))[..20]));
        v["kind"] = json!("Replaced");
        v["newText"] = json!(u.m.raw);
        v["right"] = json!(bb[0].loc(r, "right"));
        v["textOps"] = json!(text_ops(Some(aa[0]), Some(bb[0]), l, r, budget, &mut un));
        v["hasTextChange"] = json!(false);
        v["repeat"] = json!({"left":aa.len(),"right":bb.len(),"leftPages":l.pages.len(),"rightPages":r.pages.len()});
        v["occurrences"]=json!((0..aa.len().max(bb.len())).map(|i|json!({"left":aa.get(i).map(|u|u.loc(l,"left")).unwrap_or_default(),"right":bb.get(i).map(|u|u.loc(r,"right")).unwrap_or_default()})).collect::<Vec<_>>());
        v["reviewReasons"] = json!([
            "Only the number of occurrences is determined. Source list order does not establish individual correspondence or identify which physical occurrence was added or removed."
        ]);
        diffs.retain(|d| {
            !((d["oldText"] == u.m.raw && (d["newText"] == "" || d["newText"] == u.m.raw))
                || (d["newText"] == u.m.raw && d["oldText"] == ""))
        });
        diffs.push(v);
    }
    diffs.sort_by_key(|v| {
        v["left"][0]["pageIndex"]
            .as_u64()
            .or(v["right"][0]["pageIndex"].as_u64())
            .unwrap_or(0)
    });
    crate::notify(4);
    Ok(finish(
        l, r, p, budget, snapshots, coverage, un, diffs, alignment, candidates, products,
    ))
}
#[allow(clippy::too_many_arguments)]
fn finish(
    l: &Doc,
    r: &Doc,
    p: &V,
    budget: &V,
    snapshots: [String; 2],
    coverage: Vec<V>,
    un: Vec<V>,
    diffs: Vec<V>,
    alignment: Vec<V>,
    candidates: u64,
    products: u64,
) -> V {
    json!({"schemaVersion":"policy-compare-result/2","coreVersion":crate::CORE_VERSION,"extractors":[l.meta["extractor"],r.meta["extractor"]],"snapshotHashVersion":"page-merkle/1","tokenizerVersion":"unicode-tokens/1","profileVersion":p["version"],"documentHashes":[l.meta["contentHash"],r.meta["contentHash"]],"extractionSnapshotHashes":snapshots,"configDigest":digest(&json!({"profile":p,"budget":budget})),"scope":"extracted_text","status":if coverage.is_empty()&&un.is_empty(){"complete_for_scope"}else{"partial"},"stats":{"leftScalars":l.pages.iter().map(|p|p.chars.last().map(|c|c.raw_range[1]).unwrap_or(0)).sum::<usize>(),"rightScalars":r.pages.iter().map(|p|p.chars.last().map(|c|c.raw_range[1]).unwrap_or(0)).sum::<usize>(),"candidates":candidates,"tokenProducts":products,"differenceCount":diffs.len(),"occurrenceCount":diffs.len()},"differences":diffs,"coverage":coverage,"unresolved":un,"alignment":alignment,"diagnostics":[]})
}
