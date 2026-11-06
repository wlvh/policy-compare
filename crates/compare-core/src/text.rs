use crate::model::*;
use fancy_regex::Regex;
use serde_json::json;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};
use unicode_normalization::UnicodeNormalization;
pub fn re(pattern: &str) -> Regex {
    static CACHE: OnceLock<Mutex<HashMap<String, Regex>>> = OnceLock::new();
    let mut c = CACHE.get_or_init(Default::default).lock().unwrap();
    c.entry(pattern.into())
        .or_insert_with(|| Regex::new(&pattern.replace(r"\d", "[0-9]")).unwrap())
        .clone()
}
pub fn test(p: &str, s: &str) -> bool {
    re(p).is_match(s).expect("Regex evaluation failed")
}
pub fn replace(p: &str, s: &str, t: &str) -> String {
    re(p).replace_all(s, t).into_owned()
}
pub fn nfkc(s: &str) -> String {
    s.nfkc().collect()
}
pub fn ws(c: char) -> bool {
    c == '\u{feff}' || c.is_whitespace() && c != '\u{85}'
}
pub fn trim(s: &str) -> &str {
    s.trim_matches(ws)
}
pub fn words(s: &str) -> String {
    s.split(ws)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}
#[derive(Clone, Default, Debug)]
pub struct Mapped {
    pub raw: String,
    pub refs: Vec<Option<Ref>>,
    pub text: String,
    pub mapping: Vec<Vec<usize>>,
    pub transforms: Vec<V>,
}
pub fn normalize(raw: &str, refs: Vec<Option<Ref>>) -> Mapped {
    let mut chunks: Vec<(String, Vec<usize>)> = vec![];
    for (i, c) in raw.chars().enumerate() {
        if test(r"\p{M}", &c.to_string()) && !chunks.is_empty() {
            let g = chunks.last_mut().unwrap();
            g.0.push(c);
            g.1.push(i)
        } else {
            chunks.push((c.to_string(), vec![i]))
        }
    }
    if chunks.iter().map(|c| nfkc(&c.0)).collect::<String>() != nfkc(raw) {
        chunks = vec![(raw.into(), (0..raw.chars().count()).collect())]
    }
    let mut out = vec![];
    let mut mapping: Vec<Vec<usize>> = vec![];
    let mut transforms = vec![];
    for (s, ix) in chunks {
        let norm = nfkc(&s);
        let start = out.len();
        for c in norm.chars() {
            if ws(c) && out.last() == Some(&' ') {
                mapping.last_mut().unwrap().extend(&ix);
                continue;
            }
            out.push(if ws(c) { ' ' } else { c });
            mapping.push(ix.clone())
        }
        if s != norm {
            transforms.push(json!({"raw":[ix[0],ix.last().unwrap()+1],"match":[start,out.len()],"kind":"NFKC-cluster"}))
        }
    }
    Mapped {
        raw: raw.into(),
        refs,
        text: out.iter().collect(),
        mapping,
        transforms,
    }
}
pub fn tokenize(text: &str) -> Vec<String> {
    re(r"[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*|[^\p{L}\p{M}\p{N}\s]")
        .find_iter(text)
        .filter_map(Result::ok)
        .map(|m| m.as_str().into())
        .collect()
}
pub fn lcs_length(a: &[String], b: &[String]) -> usize {
    let mut prev = vec![0; b.len() + 1];
    let mut next = prev.clone();
    for x in a {
        crate::checkpoint();
        for j in 1..=b.len() {
            next[j] = if x == &b[j - 1] {
                prev[j - 1] + 1
            } else {
                prev[j].max(next[j - 1])
            }
        }
        std::mem::swap(&mut prev, &mut next);
        next.fill(0)
    }
    prev[b.len()]
}
pub fn lcs(a: &[String], b: &[String]) -> Vec<(u8, usize, usize)> {
    let w = b.len() + 1;
    let mut dp = vec![0; (a.len() + 1) * w];
    for i in (0..a.len()).rev() {
        for j in (0..b.len()).rev() {
            dp[i * w + j] = if a[i] == b[j] {
                1 + dp[(i + 1) * w + j + 1]
            } else {
                dp[(i + 1) * w + j].max(dp[i * w + j + 1])
            }
        }
    }
    let (mut i, mut j) = (0, 0);
    let mut out = vec![];
    while i < a.len() || j < b.len() {
        if i < a.len() && j < b.len() && a[i] == b[j] {
            out.push((0, i, j));
            i += 1;
            j += 1
        } else if i < a.len() && (j == b.len() || dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
            out.push((1, i, j));
            i += 1
        } else {
            out.push((2, i, j));
            j += 1
        }
    }
    out
}
// Stable maximum-weight strictly increasing chain, with the same tie choices as the legacy Fenwick tree.
pub fn monotone<T: Clone>(
    items: &[T],
    left: impl Fn(&T) -> f64,
    right: impl Fn(&T) -> f64,
    weight: impl Fn(&T) -> f64,
) -> Vec<T> {
    let mut sorted = items.to_vec();
    sorted.sort_by(|a, b| {
        left(a)
            .total_cmp(&left(b))
            .then(right(a).total_cmp(&right(b)))
    });
    let mut coords: Vec<_> = sorted.iter().map(&right).collect();
    coords.sort_by(f64::total_cmp);
    coords.dedup();
    let mut scores = vec![0.; sorted.len()];
    let mut previous = vec![None; sorted.len()];
    let mut tree = vec![None; coords.len() + 1];
    let mut best = None;
    let better = |a: Option<usize>, b: Option<usize>, sc: &Vec<f64>| match (a, b) {
        (None, x) => x,
        (x, None) => x,
        (Some(a), Some(b)) => Some(if sc[a] >= sc[b] { a } else { b }),
    };
    let mut i = 0;
    while i < sorted.len() {
        let mut j = i;
        while j < sorted.len() && left(&sorted[j]) == left(&sorted[i]) {
            j += 1
        }
        for k in i..j {
            let rank = coords
                .binary_search_by(|x| x.total_cmp(&right(&sorted[k])))
                .unwrap()
                + 1;
            let mut p = rank - 1;
            let mut prev = None;
            while p > 0 {
                prev = better(prev, tree[p], &scores);
                p -= p & (!p + 1)
            }
            previous[k] = prev;
            scores[k] = prev.map(|p| scores[p]).unwrap_or(0.) + weight(&sorted[k]).max(1.);
            best = better(best, Some(k), &scores)
        }
        for k in i..j {
            let mut p = coords
                .binary_search_by(|x| x.total_cmp(&right(&sorted[k])))
                .unwrap()
                + 1;
            while p < tree.len() {
                tree[p] = better(tree[p], Some(k), &scores);
                p += p & (!p + 1)
            }
        }
        i = j
    }
    let mut out = vec![];
    while let Some(p) = best {
        out.push(sorted[p].clone());
        best = previous[p]
    }
    out.reverse();
    out
}
