use crate::{model::*, text::*};
use serde_json::json;

#[derive(Clone, Debug)]
pub struct Unit {
    pub m: Mapped,
    pub id: String,
    pub order: usize,
    pub path: V,
    pub cells: Vec<String>,
    pub spans: Vec<[f64; 2]>,
}
impl Unit {
    pub fn loc(&self, d: &Doc, side: &str) -> Vec<V> {
        locations(&self.m.refs, d, side, &self.id)
    }
    pub fn page(&self) -> usize {
        self.m.refs.iter().flatten().next().unwrap().p
    }
}
fn bounds(rs: &[Ref], d: &Doc) -> [f64; 4] {
    let mut b = [
        f64::INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::NEG_INFINITY,
    ];
    for r in rs {
        for i in 0..4 {
            b[0] = b[0].min(r.ch(d).quad[i * 2]);
            b[1] = b[1].min(r.ch(d).quad[i * 2 + 1]);
            b[2] = b[2].max(r.ch(d).quad[i * 2]);
            b[3] = b[3].max(r.ch(d).quad[i * 2 + 1]);
        }
    }
    b
}
// Text and geometry only. No field dictionary, business identity, margin role or
// template. Join baseline fragments before making correspondence candidates.
pub fn structure(d: &Doc) -> Vec<Unit> {
    let mut units = vec![];
    for (p, page) in d.pages.iter().enumerate() {
        let ix: Map<_, _> = page
            .chars
            .iter()
            .enumerate()
            .map(|(i, c)| (c.id.as_str(), i))
            .collect();
        let mut rows: Vec<(Vec<Ref>, f64, [f64; 2])> = vec![];
        for (l, line) in page.lines.iter().enumerate() {
            crate::checkpoint();
            let rs: Vec<_> = line
                .char_ids
                .iter()
                .map(|id| Ref {
                    p,
                    c: ix[id.as_str()],
                    l,
                })
                .collect();
            if rs.is_empty() {
                continue;
            }
            let b = bounds(&rs, d);
            let y = line.baseline[1];
            // Only horizontal fragments on the same baseline can form a row.
            if line.direction[0].abs() > 0.98 {
                if let Some(row) = rows
                    .iter_mut()
                    .rev()
                    .find(|row| (row.1 - y).abs() <= 2. && row.2[0].abs() > 0.98)
                {
                    row.0.extend(rs);
                    continue;
                }
            }
            rows.push((rs, if y.is_finite() { y } else { b[1] }, line.direction));
        }
        rows.sort_by(|a, b| a.1.total_cmp(&b.1));
        for (mut rs, _, dir) in rows {
            if dir[0] > 0.98 {
                rs.sort_by(|a, b| a.ch(d).origin[0].total_cmp(&b.ch(d).origin[0]));
            }
            let mut raw = String::new();
            let mut refs = vec![];
            let mut cells = vec![];
            let mut spans = vec![];
            let mut cell = String::new();
            let mut start = 0.;
            let mut end = 0.;
            let mut prev: Option<Ref> = None;
            for r in rs {
                let c = r.ch(d);
                let b = bounds(&[r], d);
                if let Some(pr) = prev {
                    let gap = b[0] - bounds(&[pr], d)[2];
                    if dir[0] > 0.98 && gap > c.size * 1.5 {
                        cells.push(words(&cell));
                        spans.push([start, end]);
                        cell.clear();
                        if !raw.ends_with(' ') && !c.text.starts_with(' ') {
                            raw.push(' ');
                            refs.push(None)
                        }
                        start = b[0];
                    } else if dir[0] > 0.98
                        && gap > c.size * 0.18
                        && !raw.ends_with(char::is_whitespace)
                        && !c.text.starts_with(char::is_whitespace)
                    {
                        raw.push(' ');
                        refs.push(None);
                        cell.push(' ');
                    }
                } else {
                    start = b[0]
                }
                raw.push_str(&c.text);
                cell.push_str(&c.text);
                refs.extend(c.text.chars().map(|_| Some(r)));
                end = b[2];
                prev = Some(r);
            }
            cells.push(words(&cell));
            spans.push([start, end]);
            if raw.is_empty() {
                continue;
            }
            let i = units.len();
            units.push(Unit{m:normalize(&raw,refs),id:format!("u{i}"),order:i,path:json!({"section":"document","entity":null,"field":null,"table":null,"rowKey":null,"confidence":"candidate"}),cells,spans});
        }
    }
    let mut merged: Vec<Unit> = vec![];
    for u in units {
        let can_join = merged.last().is_some_and(|prev| {
            let a = prev.m.refs.iter().flatten().last().unwrap();
            let b = u.m.refs.iter().flatten().next().unwrap();
            let dy = b.ch(d).origin[1] - a.ch(d).origin[1];
            prev.cells.len() == 1
                && u.cells.len() == 1
                && a.p == b.p
                && a.line(d).direction[0] > 0.98
                && b.line(d).direction[0] > 0.98
                && !prev.m.raw.trim_end().ends_with(['.', ':', '!', '?', ';'])
                && dy > 2.
                && dy <= a.ch(d).size * 1.75
                && (prev.spans[0][0] - u.spans[0][0]).abs() <= a.ch(d).size
        });
        if can_join {
            let prev = merged.pop().unwrap();
            merged.push(joined(&[prev, u]));
        } else {
            merged.push(u)
        }
    }
    for (i, u) in merged.iter_mut().enumerate() {
        u.id = format!("u{i}");
        u.order = i;
    }
    merged
}
pub fn cell_unit(u: &Unit, k: usize, d: &Doc) -> Unit {
    let mut cell = u.clone();
    let span = u.spans[k];
    let refs: Vec<_> =
        u.m.refs
            .iter()
            .flatten()
            .filter(|r| r.ch(d).origin[0] >= span[0] - 0.1 && r.ch(d).origin[0] <= span[1] + 0.1)
            .copied()
            .collect();
    let raw = refs
        .iter()
        .map(|r| r.ch(d).text.as_str())
        .collect::<String>();
    cell.m = normalize(
        &raw,
        refs.iter()
            .flat_map(|r| r.ch(d).text.chars().map(|_| Some(*r)))
            .collect(),
    );
    cell.id = format!("{}:cell{k}", u.id);
    cell.cells = vec![words(&raw)];
    cell.spans = vec![span];
    cell
}
pub fn joined(us: &[Unit]) -> Unit {
    let mut u = us[0].clone();
    for next in &us[1..] {
        if !u.m.raw.ends_with(char::is_whitespace) && !next.m.raw.starts_with(char::is_whitespace) {
            u.m.raw.push(' ');
            u.m.refs.push(None)
        }
        u.m.raw.push_str(&next.m.raw);
        u.m.refs.extend(&next.m.refs);
    }
    u.m = normalize(&u.m.raw, u.m.refs.clone());
    u
}
// Lightweight script check, deliberately not language identification. Latin
// accents and combining marks are allowed; unsupported letters get exact ranges.
pub fn language_gaps(d: &Doc, side: &str) -> Vec<V> {
    let mut out = vec![];
    for (p, page) in d.pages.iter().enumerate() {
        let ix: Map<_, _> = page
            .chars
            .iter()
            .enumerate()
            .map(|(i, c)| (c.id.as_str(), i))
            .collect();
        for (l, line) in page.lines.iter().enumerate() {
            let text = line
                .char_ids
                .iter()
                .map(|id| page.chars[ix[id.as_str()]].text.as_str())
                .collect::<String>();
            // Isolated non-Latin letters can be mathematical/unit symbols in an
            // English sentence. Runs of non-Latin letters are a scope gap.
            let script_gap = test(r"[^\p{Latin}\p{M}\P{L}]{2,}", &text);
            // A small admission check, not language identification. Long Latin
            // sentences without any ordinary English function word are left
            // unconfirmed rather than silently declaring English coverage.
            let tokens = tokenize(&text.to_lowercase());
            let prose_gap = text.trim_end().ends_with('.')
                && !text.contains(':')
                && tokens.iter().filter(|t| test(r"^\p{L}+$", t)).count() >= 10
                && !tokens.iter().any(|t| {
                    [
                        "the", "and", "of", "to", "with", "from", "for", "shall", "must", "will",
                        "this", "that", "are", "not", "under",
                    ]
                    .contains(&t.as_str())
                });
            if !script_gap && !prose_gap {
                continue;
            }
            let rs: Vec<_> = line
                .char_ids
                .iter()
                .map(|id| Ref {
                    p,
                    c: ix[id.as_str()],
                    l,
                })
                .filter(|r| !script_gap || test(r"[^\p{Latin}\p{M}\P{L}]", &r.ch(d).text))
                .collect();
            out.push(json!({"side":side,"pageIndex":p,"region":bounds(&rs,d),"reason":"unsupported_language","evidence":text,"message":if script_gap{"English scope: this line contains a run of non-Latin letters that is not covered. The original text remains visible."}else{"English scope could not be confirmed for this long sentence. This lightweight check does not identify its language; the original text remains visible."},"defaultVisible":true}));
        }
    }
    out
}

// These are observations, not proof of a continued table or merged cells.
// Keep the range and partial status; local text comparison still runs.
pub fn structure_gaps(us: &[Unit], d: &Doc, side: &str) -> Vec<V> {
    let mut gaps = vec![];
    for (i, u) in us.iter().enumerate() {
        let prev = us.get(i.wrapping_sub(1));
        let cross = u.cells.len() > 1
            && us[..i]
                .iter()
                .any(|p| p.page() != u.page() && p.cells == u.cells);
        let wrap = prev.is_some_and(|p| {
            p.cells.len() >= 3 && u.cells.len() != p.cells.len() && p.page() == u.page() && {
                let a = p.m.refs.iter().flatten().last().unwrap();
                let b = u.m.refs.iter().flatten().next().unwrap();
                (b.ch(d).origin[1] - a.ch(d).origin[1]).abs() <= a.ch(d).size * 1.8
            }
        });
        if cross || wrap {
            let rs: Vec<_> = u.m.refs.iter().flatten().copied().collect();
            gaps.push(json!({"side":side,"pageIndex":u.page(),"region":bounds(&rs,d),"reason":"unsupported_structure","layoutHint":if cross{"repeated_tabular_text"}else{"varying_cell_boundaries"},"evidence":u.m.raw,"message":if cross{"Tabular text also occurs on another page. This alone does not establish a continued table; cross-page relationships are unverified. Original text is still compared locally."}else{"Nearby lines have different cell counts. This alone does not establish wrapped or merged cells; cell structure is unverified. Original text is still compared locally."},"defaultVisible":true}));
        }
    }
    gaps
}
