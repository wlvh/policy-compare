use crate::{model::*, structure::*, text::*};
use serde_json::json;
#[derive(Clone)]
struct Token {
    start: usize,
    end: usize,
    text: String,
}
fn tokens(cs: &[char]) -> Vec<Token> {
    let kind = |c: char| {
        if test(r"\p{L}", &c.to_string()) {
            'L'
        } else if test(r"\p{N}", &c.to_string()) {
            'N'
        } else if ws(c) {
            'S'
        } else {
            'P'
        }
    };
    let mut out = vec![];
    let mut k = 0;
    while k < cs.len() {
        let t = kind(cs[k]);
        let mut e = k + 1;
        if t != 'P' {
            while e < cs.len()
                && (kind(cs[e]) == t
                    || (t == 'N'
                        && ['.', ','].contains(&cs[e])
                        && e + 1 < cs.len()
                        && kind(cs[e + 1]) == 'N'))
            {
                e += 1
            }
        }
        out.push(Token {
            start: k,
            end: e,
            text: cs[k..e].iter().collect(),
        });
        k = e
    }
    out
}
#[derive(Clone)]
struct Op {
    kind: u8,
    i: usize,
    j: usize,
    text: char,
}
struct Script<'a> {
    x: &'a [char],
    y: &'a [char],
    prefix: usize,
    ops: Vec<Op>,
}
impl Script<'_> {
    fn equal(&mut self, i: usize, j: usize) {
        self.ops.push(Op {
            kind: 0,
            i: self.prefix + i,
            j: self.prefix + j,
            text: self.x[i],
        });
    }
    fn replaced(&mut self, i0: usize, i1: usize, j0: usize, j1: usize) {
        for i in i0..i1 {
            self.ops.push(Op {
                kind: 1,
                i: self.prefix + i,
                j: self.prefix + j0,
                text: self.x[i],
            })
        }
        for j in j0..j1 {
            self.ops.push(Op {
                kind: 2,
                i: self.prefix + i1,
                j: self.prefix + j,
                text: self.y[j],
            })
        }
    }
    fn chars(&mut self, mut i0: usize, i1: usize, mut j0: usize, j1: usize, spaces: bool) {
        let same = |i, j| self.x[i] == self.y[j] && (!spaces || ws(self.x[i]));
        let mut e = 0;
        while i0 + e < i1 && j0 + e < j1 && same(i0 + e, j0 + e) {
            e += 1
        }
        for k in 0..e {
            self.equal(i0 + k, j0 + k)
        }
        i0 += e;
        j0 += e;
        let mut f = 0;
        while i1 - f > i0
            && j1 - f > j0
            && self.x[i1 - 1 - f] == self.y[j1 - 1 - f]
            && (!spaces || ws(self.x[i1 - 1 - f]))
        {
            f += 1
        }
        self.replaced(i0, i1 - f, j0, j1 - f);
        for k in (1..=f).rev() {
            self.equal(i1 - k, j1 - k)
        }
    }
    fn stretch(
        &mut self,
        xc: &[Token],
        yc: &[Token],
        a0: usize,
        a1: usize,
        b0: usize,
        b1: usize,
        mut i0: usize,
        i1: usize,
        mut j0: usize,
        j1: usize,
    ) {
        if a1 - a0 != b1 - b0 {
            self.chars(i0, i1, j0, j1, true);
            return;
        }
        for k in 0..a1 - a0 {
            let (u, v) = (&xc[a0 + k], &yc[b0 + k]);
            self.chars(i0, u.start, j0, v.start, false);
            self.chars(u.start, u.end, v.start, v.end, false);
            i0 = u.end;
            j0 = v.end
        }
        self.chars(i0, i1, j0, j1, false)
    }
}
pub fn text_ops(
    a: Option<&Unit>,
    b: Option<&Unit>,
    l: &Doc,
    r: &Doc,
    budget: &V,
    unresolved: &mut Vec<V>,
) -> Vec<V> {
    let aa: Vec<_> = a.map(|u| u.m.raw.as_str()).unwrap_or("").chars().collect();
    let bb: Vec<_> = b.map(|u| u.m.raw.as_str()).unwrap_or("").chars().collect();
    let at = tokens(&aa);
    let bt = tokens(&bb);
    let mut p = 0;
    while p < at.len() && p < bt.len() && at[p].text == bt[p].text {
        p += 1
    }
    let mut s = 0;
    while s < at.len() - p
        && s < bt.len() - p
        && at[at.len() - 1 - s].text == bt[bt.len() - 1 - s].text
    {
        s += 1
    }
    let prefix = if p > 0 { at[p - 1].end } else { 0 };
    let suffix = if s > 0 {
        aa.len() - at[at.len() - s].start
    } else {
        0
    };
    let x = &aa[prefix..aa.len() - suffix];
    let y = &bb[prefix..bb.len() - suffix];
    let mut script = Script {
        x,
        y,
        prefix,
        ops: (0..prefix)
            .map(|i| Op {
                kind: 0,
                i,
                j: i,
                text: aa[i],
            })
            .collect(),
    };
    let shift = |t: &Token| Token {
        start: t.start - prefix,
        end: t.end - prefix,
        text: t.text.clone(),
    };
    let xc: Vec<_> = at[p..at.len() - s]
        .iter()
        .filter(|t| !t.text.chars().next().map(ws).unwrap_or(false))
        .map(shift)
        .collect();
    let yc: Vec<_> = bt[p..bt.len() - s]
        .iter()
        .filter(|t| !t.text.chars().next().map(ws).unwrap_or(false))
        .map(shift)
        .collect();
    if work_product(xc.len(), yc.len()) as f64 > n(&budget["diffProducts"]) {
        unresolved.push(json!({"reason":"word_diff_budget","message":"Word-level comparison exceeds the work limit; full source text is retained on both sides, with less precise highlighting","left":a.map(|u|u.loc(l,"left")).unwrap_or_default(),"right":b.map(|u|u.loc(r,"right")).unwrap_or_default(),"defaultVisible":true}));
        script.replaced(0, x.len(), 0, y.len())
    } else {
        let (mut ta, mut tb, mut ci, mut cj) = (0, 0, 0, 0);
        for (kind, ti, tj) in lcs(
            &xc.iter().map(|t| t.text.clone()).collect::<Vec<_>>(),
            &yc.iter().map(|t| t.text.clone()).collect::<Vec<_>>(),
        ) {
            if kind != 0 {
                continue;
            }
            let (u, v) = (&xc[ti], &yc[tj]);
            script.stretch(&xc, &yc, ta, ti, tb, tj, ci, u.start, cj, v.start);
            for k in 0..u.end - u.start {
                script.equal(u.start + k, v.start + k)
            }
            ta = ti + 1;
            tb = tj + 1;
            ci = u.end;
            cj = v.end;
        }
        script.stretch(
            &xc,
            &yc,
            ta,
            xc.len(),
            tb,
            yc.len(),
            ci,
            x.len(),
            cj,
            y.len(),
        );
    }
    for k in (1..=suffix).rev() {
        script.ops.push(Op {
            kind: 0,
            i: aa.len() - k,
            j: bb.len() - k,
            text: aa[aa.len() - k],
        })
    }
    let mut groups: Vec<Vec<Op>> = vec![];
    for op in script.ops {
        if groups.last().map(|g| g[0].kind) == Some(op.kind) {
            groups.last_mut().unwrap().push(op)
        } else {
            groups.push(vec![op])
        }
    }
    groups.iter().map(|g|json!({"kind":(["equal","delete","insert"][g[0].kind as usize]),"text":g.iter().map(|o|o.text).collect::<String>(),"left":a.filter(|_|g[0].kind!=2).map(|u|locations(&g.iter().map(|o|u.m.refs.get(o.i).copied().flatten()).collect::<Vec<_>>(),l,"left",&u.id)).unwrap_or_default(),"right":b.filter(|_|g[0].kind!=1).map(|u|locations(&g.iter().map(|o|u.m.refs.get(o.j).copied().flatten()).collect::<Vec<_>>(),r,"right",&u.id)).unwrap_or_default()})).collect()
}
fn dates(text: &str) -> Option<Vec<(i32, i32, i32)>> {
    let re = re(r"(?<!\d)(?<!\d[.,])(\d{1,2}) ([A-Za-z]+) (\d{4})(?![.,]?\d)");
    let matches: Vec<_> = re.captures_iter(text).flatten().collect();
    if matches.len() != 2 {
        return None;
    }
    let mut ds = vec![];
    for m in matches {
        let day = m[1].parse::<i32>().ok()?;
        let month = [
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
        ]
        .iter()
        .position(|v| *v == &m[2])? as i32
            + 1;
        let year = m[3].parse::<i32>().ok()?;
        let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        let max = match month {
            2 => {
                if leap {
                    29
                } else {
                    28
                }
            }
            4 | 6 | 9 | 11 => 30,
            _ => 31,
        };
        if day < 1 || day > max {
            return None;
        }
        ds.push((year, month, day));
    }
    if ds[1] < ds[0] { None } else { Some(ds) }
}
pub fn facts(a: Option<&Unit>, b: Option<&Unit>, layout: &[Set<String>; 2]) -> Vec<&'static str> {
    let u = b.or(a).unwrap();
    let old = a.map(|u| u.m.raw.as_str()).unwrap_or("");
    let now = b.map(|u| u.m.raw.as_str()).unwrap_or("");
    if old == now {
        return vec![];
    }
    if words(old) == words(now) {
        return vec!["whitespace_only"];
    }
    let margin = ["page_heading", "footer", "heading"].contains(&u.role.as_str());
    if u.role == "furniture" || margin {
        let page = |x: &Unit| {
            if let Some(f) = &x.furniture {
                trim(&without_furniture(&x.m.raw, f)).is_empty()
            } else {
                trim(&without_pages(&x.m.raw)).is_empty()
            }
        };
        if match (a, b) {
            (Some(a), Some(b)) => masked(a) == masked(b),
            _ => {
                (u.furniture.as_ref().map(|f| f.page_number).unwrap_or(false) || margin) && page(u)
            }
        } {
            return vec!["page_number_only"];
        }
    }
    if (a.is_none() || b.is_none()) && layout[if b.is_some() { 1 } else { 0 }].contains(&u.id) {
        return vec!["continued_heading"];
    }
    if a.is_some() && b.is_some() && u.path["field"] == "policy_period" {
        if let (Some(before), Some(after)) = (dates(old), dates(now)) {
            if before
                .iter()
                .zip(after.iter())
                .all(|(s, e)| e.0 == s.0 + 1 && e.1 == s.1 && e.2 == s.2)
                && replace(
                    r"(?<!\d)(?<!\d[.,])(\d{1,2}) ([A-Za-z]+) (\d{4})(?![.,]?\d)",
                    old,
                    "<date>",
                ) == replace(
                    r"(?<!\d)(?<!\d[.,])(\d{1,2}) ([A-Za-z]+) (\d{4})(?![.,]?\d)",
                    now,
                    "<date>",
                )
            {
                return vec!["dates_rolled_forward_one_year"];
            }
        }
    }
    vec![]
}
