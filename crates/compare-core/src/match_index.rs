//! Indexes for the existing source-text matching rules. Positions in each
//! posting list follow document order; duplicates remain separate occurrences.
use crate::{
    model::{Map, Set},
    structure::Unit,
    text::ws,
};
use std::{collections::VecDeque, ops::Range};

pub fn label(unit: &Unit) -> Option<&str> {
    unit.m.text
        .split_once(':')
        .map(|(prefix, _)| prefix)
        .filter(|prefix| !prefix.is_empty() && prefix.len() < 100)
}

pub struct SourceIndex<'a> {
    pub units: &'a [Unit],
    pub by_text: Map<&'a str, Vec<usize>>,
    pub by_label: Map<(&'a str, &'a str), Vec<usize>>,
    pub headers: Vec<Option<usize>>,
    pub contexts: Vec<&'a str>,
}

impl<'a> SourceIndex<'a> {
    pub fn new(units: &'a [Unit]) -> Self {
        let mut by_text: Map<&str, Vec<usize>> = Map::new();
        let mut by_label: Map<(&str, &str), Vec<usize>> = Map::new();
        let mut headers = Vec::with_capacity(units.len());
        let mut contexts = Vec::with_capacity(units.len());
        let mut first = 0;
        for (i, unit) in units.iter().enumerate() {
            crate::checkpoint();
            let previous = i.checked_sub(1).map(|k| &units[k]);
            let table = unit.cells.len() > 1;
            let continues_table = table && previous.is_some_and(|p| {
                p.cells.len() == unit.cells.len() && p.page() == unit.page()
            });
            if !continues_table {
                first = i;
            }
            headers.push((table && first < i).then_some(first));
            let key = label(unit);
            let context = match key {
                // Skip a contiguous run of the same literal label.
                Some(key) if previous.is_some_and(|p| label(p) == Some(key)) => contexts[i - 1],
                _ => {
                    let start = if table && key.is_none() { first } else { i };
                    start.checked_sub(1)
                        .map_or("", |k| units[k].m.text.as_str())
                }
            };
            contexts.push(context);
            if let Some(key) = key {
                by_label.entry((key, context)).or_default().push(i);
            }
            by_text.entry(unit.m.text.as_str()).or_default().push(i);
        }
        Self {
            units,
            by_text,
            by_label,
            headers,
            contexts,
        }
    }

    pub fn count(&self, text: &str) -> usize {
        self.by_text.get(text).map_or(0, Vec::len)
    }

    pub fn permits_table_pair(&self, i: usize, other: &Self, j: usize) -> bool {
        let a = &self.units[i];
        let b = &other.units[j];
        if a.cells.len() < 2 || b.cells.len() < 2 || label(a).is_some() || label(b).is_some() {
            return true;
        }
        let left = self.contexts[i];
        let right = other.contexts[j];
        left == right
            || left.is_empty()
            || right.is_empty()
            || !self.by_text.contains_key(right)
            || !other.by_text.contains_key(left)
    }
}

// A window key borrows one slice from a single canonical copy of the whole
// side. Even for overlapping eight-unit windows no window owns a text copy.
pub struct WindowText {
    text: String,
    offsets: Vec<Range<usize>>,
}

impl WindowText {
    pub fn from_raw<'a>(raw: impl Iterator<Item = &'a str>) -> Self {
        let mut text = String::new();
        let mut offsets = Vec::new();
        let mut raw_ends_with_space = false;
        for part in raw {
            crate::checkpoint();
            // Mirror joined()'s original boundary rule, then words()'s
            // normalization. Their whitespace definitions deliberately differ.
            if !offsets.is_empty()
                && !raw_ends_with_space
                && !part.starts_with(char::is_whitespace)
            {
                if !text.ends_with(' ') {
                    text.push(' ');
                }
                raw_ends_with_space = true;
            }
            let start = text.len();
            for c in part.chars() {
                if ws(c) {
                    if !text.ends_with(' ') {
                        text.push(' ');
                    }
                } else {
                    text.push(c);
                }
            }
            if !part.is_empty() {
                raw_ends_with_space = part.ends_with(char::is_whitespace);
            }
            offsets.push(start..text.len());
        }
        Self { text, offsets }
    }

    pub fn get(&self, start: usize, length: usize) -> &str {
        self.text[self.offsets[start].start..self.offsets[start + length - 1].end].trim_matches(' ')
    }
}

const MAX_REFLOW: usize = 8;
type Postings<'a> = Map<(&'a str, Option<&'a str>), VecDeque<(usize, usize)>>;

pub struct ReflowIndex<'a> {
    groups: Postings<'a>,
    singles: Postings<'a>,
}

impl<'a> ReflowIndex<'a> {
    pub fn new(a: &[Unit], left: &WindowText, b: &'a [Unit], right: &'a WindowText) -> Self {
        // Only a whole single-unit string on the other side may match a group.
        let left_singles: Set<_> = a.iter().enumerate()
            .filter(|(_, u)| u.cells.len() <= 1)
            .map(|(i, u)| (left.get(i, 1), u.m.text.split_whitespace().next()))
            .collect();
        let mut groups: Postings = Map::new();
        let mut singles: Postings = Map::new();
        for (j, unit) in b.iter().enumerate().filter(|(_, u)| u.cells.len() <= 1) {
            crate::checkpoint();
            let first = unit.m.text.split_whitespace().next();
            singles.entry((right.get(j, 1), first))
                .or_default()
                .push_back((j, 1));
            for length in 2..=MAX_REFLOW.min(b.len() - j) {
                let key = (right.get(j, length), first);
                if left_singles.contains(&key) {
                    groups.entry(key).or_default().push_back((j, length));
                }
            }
        }
        Self { groups, singles }
    }

    pub fn earliest(
        &mut self,
        a: &'a [Unit],
        text: &'a WindowText,
        i: usize,
        used_left: &Set<usize>,
        used_right: &Set<usize>,
    ) -> Option<(usize, usize, usize)> {
        let first = a[i].m.text.split_whitespace().next();
        let mut best = None;
        for na in 1..=MAX_REFLOW.min(a.len() - i) {
            if used_left.contains(&(i + na - 1)) {
                break;
            }
            let key = (text.get(i, na), first);
            let index = if na == 1 {
                &mut self.groups
            } else {
                &mut self.singles
            };
            if let Some(postings) = index.get_mut(&key) {
                // Consumption is monotonic. A posting removed here cannot
                // correspond to any future left window.
                while let Some(&(j, nb)) = postings.front() {
                    if (j..j + nb).any(|k| used_right.contains(&k)) {
                        postings.pop_front();
                        continue;
                    }
                    let candidate = (j, na, nb);
                    if best.is_none_or(|current| candidate < current) {
                        best = Some(candidate);
                    }
                    break;
                }
            }
        }
        best
    }
}

fn token_counts(tokens: &[String]) -> Map<&str, usize> {
    let mut counts = Map::new();
    for token in tokens {
        *counts.entry(token.as_str()).or_default() += 1;
    }
    counts
}

// A common subsequence cannot contain more copies of a token than either
// source does. This bound only discards a pair if it cannot reach the existing
// scoring threshold, regardless of where either unit occurs in the document.
pub struct TokenIndex<'a> {
    tokens: &'a [Vec<String>],
    postings: Map<&'a str, Vec<(usize, usize)>>,
}

pub fn token_score(common: usize, left: usize, right: usize) -> f64 {
    2. * common as f64 / (left + right).max(1) as f64
}

pub const MIN_SCORE: f64 = 0.55;

impl<'a> TokenIndex<'a> {
    pub fn new(tokens: &'a [Vec<String>]) -> Self {
        let mut postings: Map<&str, Vec<(usize, usize)>> = Map::new();
        for (j, row) in tokens.iter().enumerate() {
            crate::checkpoint();
            for (word, count) in token_counts(row) {
                postings.entry(word).or_default().push((j, count));
            }
        }
        Self { tokens, postings }
    }

    pub fn candidates(&self, left: &[String]) -> Vec<usize> {
        let mut overlap: Map<usize, usize> = Map::new();
        for (word, count) in token_counts(left) {
            crate::checkpoint();
            if let Some(rows) = self.postings.get(word) {
                for &(j, right_count) in rows {
                    *overlap.entry(j).or_default() += count.min(right_count);
                }
            }
        }
        let mut possible: Vec<_> = overlap
            .into_iter()
            .filter(|&(j, n)| token_score(n, left.len(), self.tokens[j].len()) >= MIN_SCORE)
            .map(|(j, _)| j)
            .collect();
        possible.sort_unstable();
        possible
    }

    // An upper bound can only increase as more shared tokens are counted.
    // For an unfinished search, stop at the first eligible candidate.
    pub fn any_candidate(
        &self,
        left: &[String],
        range: Range<usize>,
        eligible: impl Fn(usize) -> bool,
    ) -> bool {
        if range.is_empty() {
            return false;
        }
        let mut overlap: Map<usize, usize> = Map::new();
        for (word, count) in token_counts(left) {
            crate::checkpoint();
            if let Some(rows) = self.postings.get(word) {
                let start = rows.partition_point(|&(j, _)| j < range.start);
                let end = rows.partition_point(|&(j, _)| j < range.end);
                for &(j, right_count) in &rows[start..end] {
                    let shared = overlap.entry(j).or_default();
                    *shared += count.min(right_count);
                    if token_score(*shared, left.len(), self.tokens[j].len()) >= MIN_SCORE
                        && eligible(j)
                    {
                        return true;
                    }
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text::words;

    #[test]
    fn borrowed_windows_match_source_joins_including_unusual_whitespace() {
        let parts = [
            "", "Lúa", "\u{85}", "B", "  ", "q\u{feff}", "z", "", "\n hi", "\t", "",
        ];
        let windows = WindowText::from_raw(parts.iter().copied());
        for i in 0..parts.len() {
            let mut raw = parts[i].to_owned();
            for j in i..parts.len() {
                if j > i {
                    if !raw.ends_with(char::is_whitespace)
                        && !parts[j].starts_with(char::is_whitespace)
                    {
                        raw.push(' ');
                    }
                    raw.push_str(parts[j]);
                }
                assert_eq!(windows.get(i, j - i + 1), words(&raw));
            }
        }
    }

    #[test]
    fn shortlist_keeps_every_qualifying_lcs_and_all_ties_in_source_order() {
        use crate::text::lcs_length;

        let mut rows = Vec::new();
        for length in 0..=5 {
            for mask in 0..(1 << length) {
                let tokens = (0..length)
                    .map(|bit| if mask & (1 << bit) == 0 { "a" } else { "b" })
                    .map(str::to_owned)
                    .collect::<Vec<_>>();
                rows.push(tokens);
            }
        }
        let index = TokenIndex::new(&rows);
        for left in &rows {
            let qualifies = |j: usize| {
                token_score(lcs_length(left, &rows[j]), left.len(), rows[j].len()) >= MIN_SCORE
            };
            let expected: Vec<_> = (0..rows.len()).filter(|&j| qualifies(j)).collect();
            let candidates = index.candidates(left);
            let actual: Vec<_> = candidates.iter().copied().filter(|&j| qualifies(j)).collect();
            assert_eq!(actual, expected);
            for start in 0..rows.len() {
                let end = (start + 4).min(rows.len());
                assert_eq!(
                    index.any_candidate(left, start..end, |j| j % 2 == 0),
                    candidates.iter().any(|&j| (start..end).contains(&j) && j % 2 == 0)
                );
            }
        }

        let repeated = |common: usize, filler: &str| {
            std::iter::repeat_n("x".to_owned(), common)
                .chain(std::iter::repeat_n(filler.to_owned(), 20 - common))
                .collect::<Vec<_>>()
        };
        let left = repeated(11, "a");
        let right = vec![
            repeated(11, "b"),
            repeated(10, "c"),
            repeated(11, "d"),
        ];
        // 11 common tokens / 20 = 0.55. Both ties survive. A single token's
        // presence is insufficient: 10 usable copies among 20 miss the cutoff.
        assert_eq!(TokenIndex::new(&right).candidates(&left), vec![0, 2]);
    }
}
