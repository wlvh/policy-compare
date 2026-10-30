"""Development triage of author renewal events against one comparison result.

Usage:
  python3 scripts/renewal-triage.py CHANGES_JSON RESULT_JSON [--events OUT_JSON] [--identity DECLARATIONS_JSON] > SUMMARY_JSON

Every author change becomes atoms: one per edit (old -> new) for Replaced and
Moved (plus the paragraph opening for Moved), one per cell for table rows
written as "a | b | c" that were Added/Removed, one per opening fragment for
other Added/Removed paragraphs. Each atom keeps its candidate cards (text on
the stated pages) apart from the cards finally accepted for it.

Table rows need record identity. It comes only from a reviewer's declaration
(--identity, e.g. scripts/renewal-identity.json): per table, the author events
it holds and which author-row cells are the per-side source anchor, with the
printed heading or layout they were read from. These are anchors a reviewer set
from the frozen author events and the PDFs, not business keys the author
confirmed; the SHA-256 of the author changes file only binds the declaration to
that file version. The product never reads it. Block ids and "the first
name-like cell" are not identity; a row whose table declares no anchor is not
evaluated (its candidate cards are still listed). A card is accepted for a row
when all of that side's anchor cells (AND; each side its own author row) sit in a
source unit of the occurrence that makes the change (renewal-triage/7): an
unchanged occurrence of the same text, or another unit of the card, lends no
identity. A rowKey that is not a cell of the row,
or another declared record's identity in that unit, is a contradiction
(misattributed) unless that card is accepted by the other row's own event. Delete + add on separate cards
counts only as an attributable split when, on each side, the occurrence that
makes the change shows the record (rows) or the author paragraph (text) in its
own source units read on the stated pages; another page of the card lends no
context. The edit, the identity or context, the stated pages and the evidence
written out all come from that one occurrence. An Added/Removed row must sit
in one unit of a card of its own kind: inside a neighbour row's card it is
"merged" (not evaluable); paired against a different record it is misattributed.

A Replaced or Moved edit is accepted, on one card or as a delete + add split,
only on cards whose text operations change that very fragment, in a source unit
that holds it: a card holding the old text on the left and the new text on the
right without changing them there (an unchanged move, unchanged context, an
edit in another unit) is not evidence. A side the author edit leaves as it is
(an author move, an insertion's left side) needs no change.

Text counts only where it is found in sources on the author's pages: an
occurrence whose every character comes from a source unit on a stated page
(any page when none is stated), read as the source has it (renewal-triage/9):
within a unit each next character comes later and skips no cited character,
inside a word or number it is the very next raw character, and characters of
two units are separated by a space. A card carries an edit only through a
changed character of that occurrence; a changed space collapsed beside
unchanged words (extra spaces around an amount) is not the edit unless the
author edit itself only changes spaces. On one card, the old and the new
occurrence must line up in the card's edit script (renewal-triage/10): the
unchanged characters of the context the author edit keeps on each side are
paired with the other occurrence, and every unchanged character between the two
belongs to one of them; currency codes swapped while the amounts stay paired
elsewhere do not show "USD 100" -> "USD 200". A card that changes both texts
without lining them up is reported as such ("same_card_unaligned",
renewal-triage/11), not as a card that leaves them unchanged. A pure insertion or deletion needs no
text on its empty side; its other side needs the edit with the record identity
or the author paragraph in that occurrence's own units. The paragraph counts
when shown whole, however short, or with at least ten more of its characters
(renewal-triage/12). On a side the edit changes, the record identity must sit in
a unit holding a changed character of the occurrence, not in a unit of it whose
text the card leaves unchanged (renewal-triage/13). Cells of an Added/Removed row
match only as whole numbers, and each author cell needs its own occurrence in
the record unit (renewal-triage/14); every author cell counts, however short, and
overlapping cells need separate stretches of text; delete + add on separate
cards must change the part the author edit changes on each side
(renewal-triage/15). A number does not match inside a signed one, cells are
allocated over every candidate stretch, and the full-row check of a Replaced
row allocates its cells the same way (renewal-triage/16). Replaced values follow the
same sign rule, and a source range a card lists twice counts once (renewal-triage/17). A
same-card paragraph replacement needs the author paragraph around the lined-up occurrences
(whitespace aside, as for split cards and one-sided edits), and copies of one cell are
allocated in text order only (renewal-triage/18). Source ranges that meet join without a
space only where the card's own text shows them together, and the full row reads only the units
where the record's identity was confirmed (renewal-triage/19). The paragraph context comes from
the units carrying the edit, a whole paragraph is context even when it is the edit, and the
page and date facts need whole page numbers and real dates (renewal-triage/20). A whole
paragraph is context only around the edited occurrence itself, and a split row is full from
its Removed and Added cards (renewal-triage/21). A Moved paragraph is met by a card that reports
the move, by the paragraph removed in one place and added in another, or by a card carrying one of
the event's own edits (a moved and edited paragraph may show as a replacement); a card keeping the
paragraph unchanged around another change is no evidence of the move; a split row reads only the
units where each half's identity was confirmed (renewal-triage/22). Source ranges that meet join
only where the card's own text shows those two characters side by side, and an Added/Removed
paragraph is kept on the other side only as a whole-number match (renewal-triage/23). A date's
day and year are whole numbers of the text, and an Added/Removed row on a card that names another
record's row key is misattributed (renewal-triage/24); one on a card the product marked unresolved
is not evaluated (renewal-triage/25). A row key naming another record is misattributed on every
entry (replaced, one-sided and added/removed rows) whether or not the product marked the row
unresolved; only a right row key with that mark is not evaluated (renewal-triage/26).
A pure insertion or deletion on a card that also shows the other side counts only where the card
makes it as one: a card replacing another word with it (earlier -> later) reports no insertion,
unless the event's other edits account for the replaced text (renewal-triage/27). Within one
source unit, a record identity counts for an edit only when nothing but the author row's own words
and numbers lies between them (renewal-triage/28). A card adding or removing one copy of a repeated
paragraph shows that addition or removal; a moved row is full only with every author cell
(renewal-triage/29). A sign right after a currency code (USD\u2212100) is the amount's sign, as in
#10's scorer (renewal-triage/30). The identity also stands on the same side of the edit as in the
author row, the words between them in the author's order (renewal-triage/31). The two halves of a move without
edits each take the paragraph out or put it in (renewal-triage/32). Copies of one edit each need an
edited occurrence of their own on the accepted cards (renewal-triage/33), and a row's full-row check
reads every accepted card, not only the first one per side (renewal-triage/34).
A number at either end of the author text
matches only as a whole number (renewal-triage/8): "USD 100" inside
"USD 1000" or "USD 100,000" is another value; a 40-character opening ends
before a number it would split. Candidate matching, the edit check and the
evidence written out all use the source units of such occurrences; a card
holding the text on another page, with unrelated text on the stated page, is
not evidence.

Matching is whitespace-normalised substring search, so superscripts and line
breaks can hide present text: "not_located" means the script could not locate
it, not that the product missed it. An Added/Removed paragraph is accepted only
on a card that adds or removes it; a card that keeps the text on the other side
too (an unchanged move) does not count. A row is fully recovered when every
author cell is in the full source text of the accepted record units. Page-furniture (Header) events are listed
separately and are not evaluable: the result contract has no furniture role.
The script does not check highlight geometry, and "unexplained" cards are a
noise estimate, not a false-positive rate.

Results of format 1 (with importance categories) and format 2 are both read;
categories are not evaluated. Facts a format-2 card states are re-checked
against its own old and new text, which can contradict a fact but not prove
page numbers are confirmed.
"""
import bisect
import collections
import datetime
import hashlib
import json
import re
import sys

TOOL = 'renewal-triage/34'
# Event verdicts, most decisive first; an event takes the first one any of its atoms has.
VERDICTS = ('misattributed', 'one_side_only', 'not_evaluable')


QUOTES = {'’': "'", '‘': "'", '“': '"', '”': '"'}


def norm(s):
    for a, b in QUOTES.items():
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def space(c):
    return re.match(r'\s', c) is not None


def pages(locations):
    return {l['pageIndex'] + 1 for l in locations}


def cells(text):
    return [norm(c) for c in text.split(' | ')] if text and ' | ' in text else None


NUMBER = re.compile(r'\d(?:[.,]?\d)*')


SIGN = '-\u2212+'
# Currency codes after which a sign is the amount's (USD\u2212100), as #10's scorer reads them (ea444a0).
CODES = ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CNY', 'HKD', 'SGD', 'MYR', 'AUD', 'CAD')


def signed(text, i):
    """A number starting at i of the text carries a sign: one right before it that does not follow
    a letter, digit, '.' or ',' ("-100", "(\u2212100)"; not "1-200" or "SYN-1026"), or that follows a
    currency code (USD\u2212100, PR #11 comment 6516032862), as #10's scorer reads signs (b6aa2c8,
    ea444a0)."""
    if not (i > 0 and text[i - 1] in SIGN):
        return False
    code = i > 3 and text[i - 4:i - 1] in CODES and not (i > 4 and re.match(r'[0-9A-Za-z]', text[i - 5]))
    return code or not (i > 1 and re.match(r'[0-9A-Za-z.,]', text[i - 2]))


def splits_number(text):
    """Positions strictly inside a number of the text: a match starting or ending there would cut
    the number ("USD 100" in "USD 1000" or "USD 100,000", "0.0425%" in "10.0425%")."""
    return {i for m in NUMBER.finditer(text) for i in range(m.start() + 1, m.end())}


def occurs(needle, text):
    """Substring search that takes a number at either end of the needle only as a whole number,
    and a number at its start not as the unsigned part of a signed one."""
    cut, i = splits_number(text), text.find(needle) if needle else -1
    while i >= 0 and (i in cut or i + len(needle) in cut or needle[0].isdigit() and signed(text, i)):
        i = text.find(needle, i + 1)
    return i >= 0


def opening(text):
    """The first 40 characters of a text, ending before a number the cut would split."""
    t = norm(text)
    if len(t) > 40 and 40 in splits_number(t):
        return t[:next(m.start() for m in NUMBER.finditer(t) if m.start() < 40 < m.end())].rstrip()
    return t[:40]


def whole(needle):
    """Whole-token pattern: no letter or digit beside it, and no number continued past it by "."
    or "," and a digit, so "1315" is not in "21,315,000" nor "USD 100" in "USD 100,000"
    (r4416863588); a number is not the unsigned part of a signed one ("100" in "-100",
    r4417384098; see signed())."""
    code = '|'.join(CODES)
    sign = (r'(?:(?<![-\u2212+])|(?<=[0-9A-Za-z.,][-\u2212+])(?<!(?<![0-9A-Za-z])(?:' + code + r')[-\u2212+]))'
            if needle[:1].isdigit() else '')
    return re.compile(r'(?<![0-9A-Za-z])(?<![0-9][.,])' + sign + re.escape(needle) + r'(?![0-9A-Za-z])(?![.,][0-9])')


def bounded(needle, text):
    return bool(needle) and whole(needle).search(text) is not None


def ref(loc):
    return {'page': loc['pageIndex'] + 1, 'unitId': loc['unitId'], 'rawRange': loc['rawRange'],
            'text': loc['text'][:80]}


def pieces(locs):
    """A unit's locations with each source character once, in the card's order: a range the card
    lists twice or inside another adds nothing, and of two overlapping ranges the later one keeps
    only its new part (r4417511075)."""
    keep, end = {}, None
    for k, l in sorted(enumerate(locs), key=lambda x: (x[1]['rawRange'][0], -x[1]['rawRange'][1])):
        a, b = l['rawRange']
        if end is not None and b <= end:
            continue
        keep[k] = l if end is None or a >= end else dict(l, rawRange=[end, b], text=l['text'][end - a:])
        end = b
    return [keep[k] for k in sorted(keep)]


def spliced(parts, joined=frozenset()):
    """Texts of source locations, in order, set off by spaces. Raw ranges that meet are not always
    one word (a PDF places words apart without a space), so one that starts where the previous one
    ends in the same unit continues its text only where the card's own text shows the two
    characters side by side (`joined`, see touching()): a space there would split a number the
    card shows whole (USD 100,000 as USD 100 ,000, #11 comment 6508515495), and the same digits
    spaced elsewhere on the card say nothing about this place (#11 comment 6512133284)."""
    out, end = '', None
    for unit, (a, b), text in parts:
        glued = bool(out) and end == (unit, a) and (unit, a) in joined
        out = out + text if glued else (out + ' ' if out else '') + text
        end = (unit, b)
    return out


def touching(*sides):
    """Where the card's own text puts a source character right after the one before it in the same
    unit, with no space between: the (unit, raw position) of the later one. sides: (card, side)."""
    out = set()
    for d, side in sides:
        m = marked(d, side)
        out |= {(b[1], b[3]) for a, b in zip(m, m[1:]) if b[1] and a[1] == b[1] and b[3] == a[3] + 1}
    return frozenset(out)


def units(locations, wanted, joined=frozenset()):
    """Source units (page, unitId) of one side, in order, limited to the stated pages. A unit's
    text follows its source: its pieces in raw order, not in the order the card lists them, each
    source character once."""
    out = collections.OrderedDict()
    for loc in locations:
        if wanted and loc['pageIndex'] + 1 not in wanted:
            continue
        out.setdefault((loc['pageIndex'] + 1, loc['unitId']), []).append(loc)
    return [{'page': k[0], 'unitId': k[1], 'locs': pieces(v),
             'text': norm(spliced(((k, l['rawRange'], l['text']) for l in sorted(pieces(v), key=lambda l: l['rawRange'][0])),
                                  joined))}
            for k, v in out.items()]


def side_text(d, side):
    return norm(d['oldText'] if side == 'left' else d['newText'])


def marked(d, side):
    """One card side rebuilt from its text operations and normalised as norm() does: per character,
    its source unit (page, unitId), whether the card changes it (deleted left, inserted right),
    its raw position in that unit's page stream and its place in the card's edit script
    (operation, offset, unchanged); None for both for a space."""
    changed = 'delete' if side == 'left' else 'insert'
    out = []
    for n, op in enumerate(d.get('textOps') or []):
        if op['kind'] not in ('equal', changed):
            continue
        # Operation text and its source locations agree once whitespace is removed.
        owners = [((l['pageIndex'] + 1, l['unitId']), l['rawRange'][0] + i)
                  for l in op[side] for i, c in enumerate(l['text']) if not space(c)]
        k = 0
        for at_op, c in enumerate(op['text']):
            flag = op['kind'] == changed
            if space(c):
                if out and out[-1][0] == ' ':
                    out[-1] = (' ', None, out[-1][2] or flag, None, None)
                elif out:
                    out.append((' ', None, flag, None, None))
                continue
            unit, at = owners[k] if k < len(owners) else (None, None)
            out.append((QUOTES.get(c, c), unit, flag, at, (n, at_op, op['kind'] == 'equal')))
            k += 1
    while out and out[-1][0] == ' ':
        out.pop()
    return out


def cited(d, side):
    """Raw positions of the non-space characters a card side cites, per source unit."""
    out = collections.defaultdict(list)
    for l in d[side]:
        for i, c in enumerate(l['text']):
            if not space(c):
                out[(l['pageIndex'] + 1, l['unitId'])].append(l['rawRange'][0] + i)
    return {k: sorted(v) for k, v in out.items()}


def in_source_order(span, known):
    """The occurrence reads its characters as the source has them: within a source unit each next
    character comes later, with no cited character of that unit skipped, and inside a word or
    number (no space between) it is the very next raw character. A space may stand for raw
    whitespace or a line break; characters of another unit are separated by a space."""
    prev, spaced = None, False
    for c, unit, _, at, _ in span:
        if c == ' ':
            spaced = True
            continue
        if unit is None:
            return False
        if prev is not None:
            last, xs = prev[1], known.get(unit, [])
            skipped = bisect.bisect_left(xs, at) - bisect.bisect_right(xs, last)
            if prev[0] != unit and not spaced:
                return False
            if prev[0] == unit and (at <= last or skipped or (not spaced and at != last + 1)):
                return False
        prev, spaced = (unit, at), False
    return True


def carries(span, edit, within=False):
    """The occurrence carries the author edit: a character of it that the card changes. A changed
    space collapsed beside unchanged words (extra spaces around an amount) disappears under
    normalisation and is not the edit; it counts only when the part the author edit changes on
    this side (`edit`, its slice of the needle) is nothing but spaces. Which copy of a repeated
    digit or word the card marks is the product's alignment and is not checked."""
    if not edit:
        return True
    lo, hi = edit if isinstance(edit, tuple) else (0, len(span))
    blank = all(x[0] == ' ' for x in span[lo:hi])
    # With `within`, the change must fall in the part the author edit changes (split cards,
    # r4416771397): there is no same-card line-up to tie an edit elsewhere to this one.
    return any(x[2] and (x[0] != ' ' or blank) for x in (span[lo:hi] if within else span))


def needs_edit(old, new):
    """Sides an author edit changes and, per side, the slice of the author text it changes: what
    remains after the common prefix and suffix (None where nothing remains)."""
    p = 0
    while p < min(len(old), len(new)) and old[p] == new[p]:
        p += 1
    s = 0
    while s < min(len(old), len(new)) - p and old[-1 - s] == new[-1 - s]:
        s += 1
    return {'left': (p, len(old) - s) if len(old) > p + s else None,
            'right': (p, len(new) - s) if len(new) > p + s else None}


def occurrences(d, side, needle, wanted):
    """Occurrences of the needle in one card side whose characters all come from source units on
    the wanted pages (any page when none is wanted), read in source order: per occurrence, its
    start in the side's normalised text and its characters (see marked()). A number at either end
    of the needle counts only as a whole number (r4413938264), and at its start not as the unsigned
    part of a signed one (r4417560178)."""
    chars = marked(d, side)
    text = ''.join(x[0] for x in chars)
    cut, known = splits_number(text), cited(d, side)
    out = []
    i = text.find(needle) if needle else -1
    while i >= 0:
        span = chars[i:i + len(needle)]
        owners = [x[1] for x in span if x[1] is not None]
        if owners and (not wanted or all(page in wanted for page, _ in owners)) \
                and i not in cut and i + len(needle) not in cut and not (needle[0].isdigit() and signed(text, i)) \
                and in_source_order(span, known):
            out.append((i, span))
        i = text.find(needle, i + 1)
    return out


def found(d, side, needle, wanted):
    return [span for _, span in occurrences(d, side, needle, wanted)]


def unchanged_script(d):
    """Places in a card's edit script of the non-space characters of its unchanged operations."""
    return sorted((n, k) for n, op in enumerate(d.get('textOps') or []) if op['kind'] == 'equal'
                  for k, c in enumerate(op['text']) if not space(c))


def lined_up(left, right, unchanged, need):
    """An old and a new occurrence on one card line up in the card's edit script: every unchanged
    character of the context the author edit keeps on one side (outside the part `need` says it
    changes there) is paired with a character of the other occurrence, and every unchanged
    character between the two belongs to one of them. Otherwise the two texts are paired with other
    text and the card's edits show some other change (r4415913728: currency codes swapped while
    the amounts stay paired elsewhere). The part the edit changes may be paired elsewhere (an
    inserted clause repeating the words after it), and which copy of a repeated word the card marks
    as inserted does not matter."""
    def places(span, cut=None):
        lo, hi = cut if isinstance(cut, tuple) else (0, 0)
        return {x[4][:2] for k, x in enumerate(span) if x[4] and x[4][2] and not lo <= k < hi}
    la, ra = places(left), places(right)
    if not (places(left, need['left']) <= ra and places(right, need['right']) <= la):
        return False
    every = [x[4][:2] for x in left + right if x[4]]
    lo, hi = min(every), max(every)
    return all(p in la | ra for p in unchanged if lo < p < hi)


def located(d, side, needle, wanted):
    return bool(found(d, side, needle, wanted))


def edited(d, side, needle, wanted, edit=True):
    """The card changes the needle itself (inside the slice `edit` changes), in an occurrence on the
    wanted pages."""
    return any(carries(span, edit) for span in found(d, side, needle, wanted))


def declarations(path, changes_path):
    """The declared tables of the author changes file, by event id, or {} when none is declared."""
    if not path:
        return {}, None
    with open(path, encoding='utf-8') as f:
        decl = json.load(f)
    digest = sha256(changes_path)
    pair = next((p for p in decl['pairs'] if p['changes_sha256'] == digest), None)
    info = {'path': path, 'sha256': sha256(path), 'version': decl['version'], 'pair': pair and pair['pair']}
    tables = {str(e): t for t in (pair or {}).get('tables', []) for e in t['events']}
    return tables, info


def expected_identity(change, declared=None):
    """Row identity from the acceptance-side declaration, or None for paragraphs. Per side, the
    author-row cells the declaration names as the record's identifier; none when undeclared."""
    left, right = cells(change.get('left_text') or ''), cells(change.get('right_text') or '')
    if change['kind'] == 'Replaced' and not (left and right) or not (left or right):
        return None
    table = (declared or {}).get(str(change['id']))
    pick = lambda row: [row[k] for k in (table or {}).get('identity', []) if row and k < len(row) and row[k]]
    ident = {'left': pick(left), 'right': pick(right), 'table': table and table['table']}
    ident['cells'] = list(dict.fromkeys(ident['left'] + ident['right']))
    ident['source'] = 'declared' if ident['cells'] else None
    return ident


def holds(text, keys):
    return bool(keys) and all(bounded(c, text) for c in keys)


def linked(d, side, start, needle, keys, change):
    """Each identity cell has an occurrence on the card side that reaches the edited occurrence (at
    `start`) as the author row of this side does: on the same side of the edit, across only words
    and numbers the author row has between them there, in its order (some may be missing). In one
    source unit holding two records, another record's text before the edit, or the next record's
    identifier right after it, is not this record's (PR #11 comments 6514897964, 6515923611)."""
    text = ''.join(x[0] for x in marked(d, side))
    author = norm(change.get('left_text' if side == 'left' else 'right_text') or '')
    words = lambda x: re.findall(r'[^\W_]+', x.lower())
    end = start + len(needle)

    def ordered(got, want):
        rest = iter(want)
        return all(w in rest for w in got)

    def ways(c):
        """Per occurrence pair in the author row: whether the identity comes first, and the words between."""
        out = []
        for m in whole(c).finditer(author):
            # A cut opening may end in a space (a Moved row's 40 characters): search its words.
            for n in whole(needle.strip()).finditer(author) if needle.strip() else ():
                if m.start() < n.end() and n.start() < m.end():
                    out.append((None, []))
                else:
                    first = m.end() <= n.start()
                    out.append((first, words(author[m.end():n.start()] if first else author[n.end():m.start()])))
        return out

    def near(c):
        want = ways(c)
        for m in whole(c).finditer(text):
            if m.start() < end and start < m.end():
                if any(first is None for first, _ in want):
                    return True
                continue
            first = m.end() <= start
            got = words(text[m.end():start] if first else text[end:m.start()])
            if any(f == first and ordered(got, w) for f, w in want):
                return True
        return False
    return bool(keys) and all(near(c) for c in keys)


def fragments(change):
    """Comparable atoms and the edits normalisation leaves nothing to compare in."""
    kind, atoms, dropped = change['kind'], [], []
    if kind in ('Added', 'Removed'):
        text = change['right_text'] if kind == 'Added' else change['left_text']
        row = cells(text)
        # Every author cell counts, however short (r4416771405); an opening needs two characters.
        for p in [c for c in row if c] if row else [c for c in [opening(text)] if len(c) >= 2]:
            atoms.append({'old': p if kind == 'Removed' else None, 'new': p if kind == 'Added' else None,
                          'cell': row is not None, 'authorCategory': change['category']})
        return atoms, dropped
    if kind == 'Moved':
        atoms.append({'old': opening(change['left_text']), 'new': opening(change['right_text']),
                      'cell': False, 'opening': True, 'authorCategory': change['category']})
    for e in change.get('edits', []):
        if norm(e['old']) == norm(e['new']):
            dropped.append({'old': e['old'], 'new': e['new'],
                            'reason': 'only whitespace or quote-style difference; nothing comparable after normalisation'})
        else:
            atoms.append({'old': norm(e['old']), 'new': norm(e['new']), 'cell': False,
                          'authorCategory': e.get('category') or change['category']})
    return atoms, dropped


def on_pages(locations, wanted):
    return not wanted or bool(pages(locations) & wanted)


def hits(d, side, needle, wanted, edit=False, only=None, changed=False, within=False, starts=False):
    """Qualifying occurrences of the needle on one card side: every character from a source unit on
    the wanted pages and, when the author edit changes this side, carrying changed characters (and,
    with `only`, among those starts). Each occurrence is the set of source units (page, unitId) its
    characters come from; with `changed`, when the side carries an edit, only the units holding a
    changed character of it (r4416699649), or all its units when no unit holds one. With `starts`,
    each comes with its start in the side's text."""
    out = []
    for i, span in occurrences(d, side, needle, wanted):
        if not carries(span, edit, within) or (only is not None and i not in only):
            continue
        keys = {x[1] for x in span if x[1] is not None}
        mine = {x[1] for x in span if x[1] is not None and x[2]} if changed and edit else set()
        out.append((i, mine or keys) if starts else mine or keys)
    return out


def local(d, side, needle, wanted, edit=False, only=None):
    """Source units of a card side that the needle's qualifying occurrences come from."""
    keep = set().union(*hits(d, side, needle, wanted, edit, only))
    return [u for u in units(d[side], wanted, touching((d, side))) if (u['page'], u['unitId']) in keep]


def judge_identity(d, needles, ident, others, change, wanted, edit=None, only=None, within=False):
    """Identity status of one card for one record: confirmed, contradicted, ambiguous, unconfirmed.
    Each side is judged on one qualifying occurrence at a time (carrying the edit where `edit` says
    the side changes): the identity must sit in the units of the occurrence that makes the change,
    not in an unchanged occurrence, another unit of the card, or a unit of the occurrence whose text
    the card leaves unchanged (r4416699649), and reach that occurrence across the author row's own
    text only (see linked())."""
    edit = edit or {}
    sp = d.get('structurePath') or {}
    unresolved = sp.get('confidence') == 'unresolved'
    key = sp.get('rowKey')
    row_text = norm((change.get('left_text') or '') + ' | ' + (change.get('right_text') or ''))
    # A row key naming another record is a wrong statement whether or not the product also marked
    # the row unresolved; an unresolved mark does not hide it (PR #9 comment 6514246431).
    if key and not bounded(norm(key), row_text):
        return 'contradicted', f'rowKey {key!r} is not a cell of this record' + (
            '; the product also marked the row identity unresolved' if unresolved else ''), {}
    if unresolved:
        return 'product_unresolved', 'product marked the row identity unresolved', {}
    order = ('confirmed', 'contradicted', 'ambiguous', 'unconfirmed')
    seen, status = {}, []
    for side, needle in needles.items():
        mine = ident[side] or ident['cells']
        best = ('unconfirmed', {'units': [], 'identity': [], 'otherRecords': []})
        for start, keys in hits(d, side, needle, wanted[side], edit.get(side, False), (only or {}).get(side),
                                changed=True, within=within, starts=True):
            us = [u for u in units(d[side], wanted[side], touching((d, side))) if (u['page'], u['unitId']) in keys]
            own = any(holds(u['text'], mine) for u in us) and linked(d, side, start, needle, mine, change)
            foreign = [list(o) for o in others if o != tuple(mine) and any(holds(u['text'], o) for u in us)]
            st = ('confirmed' if own and not foreign else 'contradicted' if foreign and not own
                  else 'ambiguous' if foreign else 'unconfirmed')
            # The first occurrence is written out even when unconfirmed, so its units can be checked.
            if order.index(st) < order.index(best[0]) or not best[1]['units']:
                best = (st, {'units': [u['unitId'] for u in us], 'identity': mine if own else [],
                             'otherRecords': foreign})
        status.append(best[0])
        seen[side] = best[1]
    for s in ('contradicted', 'ambiguous', 'unconfirmed'):
        if s in status:
            return s, f'record unit on {", ".join(k for k, v in zip(needles, status) if v == s)}: {s}', seen
    return 'confirmed', 'declared identity in the source unit that makes the change', seen


def in_context(card, needle, author):
    """Card shows the author paragraph around the change, not just the changed words: the whole
    paragraph, however short (r4416398168), or at least ten more of its characters."""
    a = norm(author or '')
    if needle not in card:
        return False
    return (bool(a) and a in card) or (
        len(a) >= len(needle) + 10 and card in a and len(card) >= len(needle) + 10)


def around(d, side, start, needle, author):
    """The author paragraph, whitespace aside, surrounds the occurrence that starts at `start` in
    the card side's text: it holds that edited occurrence, not only another copy of its words in
    the same unit (PR #11 comment 6510958743)."""
    text = ''.join(x[0] for x in marked(d, side))
    keep = [k for k, c in enumerate(text) if not c.isspace()]
    squeezed, a = ''.join(text[k] for k in keep), re.sub(r'\s+', '', norm(author or ''))
    lo, hi = bisect.bisect_left(keep, start), bisect.bisect_left(keep, start + len(needle))
    p = squeezed.find(a) if a else -1
    while p >= 0:
        if p <= lo and hi <= p + len(a):
            return True
        p = squeezed.find(a, p + 1)
    return False


def context(d, side, needle, wanted, author, edit=False, within=False, only=None):
    """A qualifying occurrence whose own source units, read on the wanted pages only, show the
    author paragraph around it. Whitespace does not count: source units are joined with spaces
    the author text may not have, and lose ones it has (LIMITEDand/or, Liability:COVERED). Where
    the author edit changes this side, only the units carrying the change count: an unchanged
    unit of the occurrence does not lend its paragraph to another unit's edit (PR #11 comment
    6507993515). A whole paragraph counts only when it surrounds the occurrence itself."""
    squeeze = lambda x: re.sub(r'\s+', '', x)
    a = squeeze(norm(author or ''))
    for start, keys in hits(d, side, needle, wanted, edit, only, changed=bool(edit), within=within, starts=True):
        ids = {uid for _, uid in keys}
        text = squeeze(norm(' '.join(u['text'] for u in units(d[side], wanted, touching((d, side))) if u['unitId'] in ids)))
        if in_context(text, squeeze(needle), a) and (a not in text or around(d, side, start, needle, author)):
            return True
    return False


def evidence(d, side, needle, wanted, edit=False, only=None):
    return [ref(l) for u in local(d, side, needle, wanted, edit, only) for l in u['locs']] if needle else []


def candidate(d, needles, wanted, identity=None, reason=None, seen=None, edit=None, need=None, only=None):
    """need: sides that the author edit changes. Their evidence is the occurrences that carry the
    edit (and, with `only`, line up with the other side's), as for an accepted card; a card without
    such an occurrence lists all its occurrences."""
    sp = d.get('structurePath') or {}
    need, only = need or {}, only or {}
    side = lambda k: (evidence(d, k, needles.get(k), wanted[k], need.get(k, False), only.get(k))
                      or evidence(d, k, needles.get(k), wanted[k]))
    return {'card': d['id'], 'kind': d['kind'], 'facts': d.get('facts'),
            'table': sp.get('table'), 'rowKey': sp.get('rowKey'), 'confidence': sp.get('confidence'),
            'identity': identity, 'identityReason': reason, 'identityCells': seen or None, 'editShown': edit,
            'left': side('left'), 'right': side('right')}


def unresolved_hits(result, side, needle, wanted, row_cell=False):
    """Unresolved groups holding the needle on one side, judged per group and page."""
    hits = []
    for i, u in enumerate(result['unresolved']):
        for unit in units(u[side], wanted):
            if (bounded(needle, unit['text']) if row_cell else occurs(needle, unit['text'])):
                hits.append({'group': i, 'reason': u['reason'], 'side': side, 'page': unit['page'],
                             'unitId': unit['unitId']})
    return hits


def text_atom(atom, change, ctx, claimed):
    """Replaced/Moved atom: same card, attributable split, one side, or not located."""
    diffs, result, wanted = ctx['diffs'], ctx['result'], ctx['wanted']
    old, new, ident, others = atom['old'], atom['new'], ctx['ident'], ctx['others']
    needles = {'left': old, 'right': new}
    need = needs_edit(old, new)

    def shows(d, side, needle):
        return not need[side] or edited(d, side, needle, wanted[side], need[side])
    if not (old and new):
        return one_side_edit(atom, change, ctx, claimed, need)
    oc = [d for d in diffs if located(d, 'left', old, wanted['left'])]
    nc = [d for d in diffs if located(d, 'right', new, wanted['right'])]
    same = [d for d in oc if d in nc]
    cands, accepted, suspects, open_, unedited, unaligned, unmoved = [], [], [], [], [], [], []
    for d in same:
        # The old and the new occurrence that carry the edit and line up in the card's edit script.
        unchanged = unchanged_script(d)
        lo = [(i, s) for i, s in occurrences(d, 'left', old, wanted['left']) if carries(s, need['left'])]
        ro = [(j, s) for j, s in occurrences(d, 'right', new, wanted['right']) if carries(s, need['right'])]
        both = [(i, j) for i, l in lo for j, r in ro if lined_up(l, r, unchanged, need)]
        if not (shows(d, 'left', old) and shows(d, 'right', new)) or not both:
            # The card holds both texts but does not make this edit there: no evidence for or against.
            cands.append(candidate(d, needles, wanted, edit=False))
            unedited.append(d)
            if lo and ro:
                unaligned.append(d)
            continue
        only = {'left': {i for i, _ in both}, 'right': {j for _, j in both}}
        if ident is None:
            # The author paragraph must sit around the lined-up occurrences on each side: another
            # paragraph's card making the same edit is not this one (r4417631502).
            author = {'left': change.get('left_text'), 'right': change.get('right_text')}
            ok = all(context(d, k, needles[k], wanted[k], author[k], need[k], only=only[k]) for k in needles)
            status, why, seen = ('confirmed' if ok else 'unconfirmed'), \
                'author paragraph around the edit in the source units of the lined-up occurrences', None
        else:
            status, why, seen = judge_identity(d, needles, ident, others, change, wanted, need, only)
        cands.append(candidate(d, needles, wanted, status, why, seen, edit=True if any(need.values()) else None,
                               need=need, only=only))
        if status in ('confirmed', 'not_applicable') and atom.get('opening') and d['kind'] != 'Moved' \
                and d['id'] not in ctx.get('edited', ()):
            # The paragraph is on both sides, but the card neither reports a move nor carries one of
            # the event's edits: it keeps the paragraph around another change (PR #11 comment 6511895761).
            unmoved.append(d)
        elif status in ('confirmed', 'not_applicable'):
            accepted.append(d)
        elif status == 'contradicted' and not (claimed.get(d['id'], set()) - {ctx['id']}):
            suspects.append(d)
        elif status != 'contradicted':
            open_.append((d, status))
    if accepted or suspects:
        state = ('same_card_plus_misattributed' if accepted and suspects else
                 'same_card' if accepted else 'same_card_misattributed')
        verdict = 'misattributed' if suspects else 'correct'
        return state, verdict, accepted, cands, [], ''
    if open_ and ident is None:
        return ('same_card_context_unconfirmed', 'not_evaluable', [], cands, [],
                'same card, but the author paragraph is not around the edit')
    if open_:
        return ('same_card_identity_unconfirmed', 'not_evaluable', [], cands, [],
                'same card, but the record identity is ' + ', '.join(sorted({s for _, s in open_})))
    # No card carries both sides: look for each side separately.
    olds, news = [d for d in oc if d not in same], [d for d in nc if d not in same]
    ou = unresolved_hits(result, 'left', old, wanted['left'])
    nu = unresolved_hits(result, 'right', new, wanted['right'])
    def half(d, side, needle):
        """A card holding one side; with an identity, the units where it was confirmed are kept for
        the full row (PR #11 comment 6511895761)."""
        if ident is None:
            return candidate(d, {side: needle}, wanted, need=need)
        status, why, seen = judge_identity(d, {side: needle}, ident, others, change, wanted, {side: need[side]},
                                           within=bool(need[side]))
        return candidate(d, {side: needle}, wanted, status, why, seen, need=need)
    cands += [half(d, 'left', old) for d in olds] + [half(d, 'right', new) for d in news]
    if olds and news:
        # The context or identity must sit with the occurrence on the stated pages that makes the
        # edit (el, er); lk, rk only tell whether some occurrence has it without the edit.
        if ident is None:
            author = {'left': change.get('left_text'), 'right': change.get('right_text')}
            ok = lambda d, side, n, e: context(d, side, n, wanted[side], author[side], e, within=bool(e))
            why = 'author paragraph text around the change, in the source units of that occurrence'
        else:
            ok = lambda d, side, n, e: judge_identity(d, {side: n}, ident, others, change, wanted,
                                                     {side: e}, within=bool(e))[0] == 'confirmed'
            why = 'expected record identity in the source unit of each side\'s change'
        lk, rk = [d for d in olds if ok(d, 'left', old, False)], [d for d in news if ok(d, 'right', new, False)]
        el = [d for d in olds if ok(d, 'left', old, need['left'])]
        er = [d for d in news if ok(d, 'right', new, need['right'])]
        if atom.get('opening') and not (need['left'] or need['right']):
            # A move without edits: each half must take the paragraph out (old side) or put it in
            # (new side), every character of it changed; cards keeping it in place around another
            # change do not show the move (PR #11 comment 6516504352).
            gone = lambda d, side, n: any(all(x[2] for x in s if x[0] != ' ') for s in found(d, side, n, wanted[side]))
            el, er = [d for d in el if gone(d, 'left', old)], [d for d in er if gone(d, 'right', new)]
        if el and er:
            return 'split_attributable', 'split_attributable', el + er, cands, ou + nu, 'separate cards; ' + why
        if lk and rk and not unmoved:
            return ('separate_cards_without_edit', 'not_evaluable', [], cands, ou + nu,
                    'separate cards with the context, but the ' + ' and '.join(
                        s for s, e in (('left', el), ('right', er)) if not e) + ' card does not change the text')
        if not unmoved:
            return ('separate_cards', 'not_evaluable', [], cands, ou + nu,
                    'separate cards without verifiable common context (' + why + ')')
    if unmoved:
        return ('same_card_without_move', 'not_evaluable', [], cands, ou + nu,
                'cards hold the paragraph on both sides, but none reports it moved or carries its edits')
    if unedited and len(unaligned) == len(unedited):
        return ('same_card_unaligned', 'not_evaluable', [], cands, ou + nu,
                'cards change both texts, but their edits pair them with other text, not with each other')
    if unedited:
        return ('same_card_without_edit', 'not_evaluable', [], cands, ou + nu,
                'cards hold both texts but none changes them here (e.g. an unchanged move)'
                + ('; others change both but pair them with other text' if unaligned else ''))
    if (olds or ou) and (news or nu):
        return ('in_unresolved_group', 'not_evaluable', [], cands, ou + nu,
                'one or both sides only in a product unresolved group')
    if olds or ou or news or nu:
        side = 'left' if (olds or ou) else 'right'
        return 'one_side_found', 'one_side_only', [], cands, ou + nu, f'only the {side} side was located'
    return 'not_found', 'not_located', [], cands, [], 'script did not locate either side'


def pure(d, side, needle, wanted, edit, change):
    """Starts of the occurrences whose change the card makes as an insertion (right) or deletion
    (left): the run of changed operations around its changed characters removes (or adds) on the
    other side only text the event's other edits remove (or add) there. A card that replaces
    another word with it (earlier -> later) reports no insertion (PR #11 comment 6514669354)."""
    ops, other = d.get('textOps') or [], 'delete' if side == 'right' else 'insert'
    squeeze = lambda x: re.sub(r'\s+', '', norm(x))
    known = [squeeze(e['new' if side == 'left' else 'old']) for e in change.get('edits', [])]
    out = set()
    for i, span in occurrences(d, side, needle, wanted):
        if not carries(span, edit):
            continue
        run = {x[4][0] for x in span if x[4] and x[2]}
        for n in sorted(run):
            for step in (-1, 1):
                k = n + step
                while 0 <= k < len(ops) and ops[k]['kind'] != 'equal':
                    run.add(k)
                    k += step
        if all(not squeeze(ops[k]['text']) or any(squeeze(ops[k]['text']) in e for e in known if e)
               for k in run if ops[k]['kind'] == other):
            out.add(i)
    return out


def one_side_edit(atom, change, ctx, claimed, need):
    """A pure insertion or deletion: its empty side needs no text. The other side needs an
    occurrence carrying the edit with, in that occurrence's own source units, the declared record
    identity (rows) or the author paragraph around it (text). On a card that also shows the other
    side, the occurrence's change must be the insertion or deletion itself (see pure())."""
    diffs, wanted, ident, others = ctx['diffs'], ctx['wanted'], ctx['ident'], ctx['others']
    side = 'right' if atom['new'] else 'left'
    needle, edit = atom[{'left': 'old', 'right': 'new'}[side]], need[side]
    author = change.get('left_text' if side == 'left' else 'right_text')
    cands, accepted, suspects, open_, replaced = [], [], [], [], []
    for d in diffs:
        if not hits(d, side, needle, wanted[side], edit):
            continue
        only = None
        if d['left' if side == 'right' else 'right']:
            only = pure(d, side, needle, wanted[side], edit, change)
            if not only:
                cands.append(candidate(d, {side: needle}, wanted, edit=False, need=need))
                replaced.append(d)
                continue
        if ident is None:
            ok = context(d, side, needle, wanted[side], author, edit, only=only)
            status, why, seen = ('confirmed' if ok else 'unconfirmed'), \
                'author paragraph around the edit in the source units of that occurrence', None
        else:
            status, why, seen = judge_identity(d, {side: needle}, ident, others, change, wanted, {side: edit},
                                               only=None if only is None else {side: only})
        cands.append(candidate(d, {side: needle}, wanted, status, why, seen, edit=True, need=need,
                               only=None if only is None else {side: only}))
        if status == 'confirmed':
            accepted.append(d)
        elif status == 'contradicted' and not (claimed.get(d['id'], set()) - {ctx['id']}):
            suspects.append(d)
        elif status != 'contradicted':
            open_.append((d, status))
    if accepted or suspects:
        return ('same_card_plus_misattributed' if accepted and suspects else
                'same_card' if accepted else 'same_card_misattributed'), \
            'misattributed' if suspects else 'correct', accepted, cands, [], ''
    held = [d for d in diffs if located(d, side, needle, wanted[side]) and d not in [c for c, _ in open_] + replaced]
    for d in held:
        cands.append(candidate(d, {side: needle}, wanted, need=need))
    un = unresolved_hits(ctx['result'], side, needle, wanted[side])
    if open_:
        return ('edit_without_context', 'not_evaluable', [], cands, un,
                'the edit is on a card, but its record identity or author paragraph is ' +
                ', '.join(sorted({s for _, s in open_})))
    if replaced:
        return ('same_card_unaligned', 'not_evaluable', [], cands, un,
                'the card changes the text there, but replaces other text with it rather than '
                + ('inserting' if side == 'right' else 'deleting') + ' it')
    if held:
        return ('same_card_without_edit', 'not_evaluable', [], cands, un,
                'cards hold the text but none makes this edit here')
    if un:
        return 'in_unresolved_group', 'not_evaluable', [], cands, un, 'only in a product unresolved group'
    return 'not_found', 'not_located', [], cands, [], 'script did not locate the edited side'


def allocate(texts, text):
    """The author cells a unit's text holds, each cell copy with a stretch of the text of its own:
    a text the row has twice is found twice only where the unit holds it twice (r4416863597), and
    overlapping cells (USD 100, 100) need separate stretches (r4417192877). Every candidate
    stretch, overlapping ones included, is tried, so an allocation is found whenever one exists
    (r4417384107); the result holds as many cells as can be placed. Copies of one cell are
    interchangeable: they take stretches in text order, and once one is left out so are the rest,
    so their orders are not tried one by one (r4417631513)."""
    cells = sorted((t for t in texts if t), key=lambda t: (-len(t), t))
    spans = {t: [(m.start(), m.end()) for i in range(len(text)) for m in [whole(t).match(text, i)] if m]
             for t in set(cells)}
    best = []

    def place(k, taken, found, prev):
        nonlocal best
        if k == len(cells):
            if len(found) > len(best):
                best = list(found)
            return
        # The copies from k on can take at most the stretches after the previous copy's.
        copy = k > 0 and cells[k] == cells[k - 1]
        run = next((j for j in range(k, len(cells)) if cells[j] != cells[k]), len(cells)) - k
        room = 0 if copy and prev is None else len(spans[cells[k]]) - (prev + 1 if copy else 0)
        if len(found) + min(run, room) + len(cells) - k - run <= len(best):
            return
        if not (copy and prev is None):
            for n, (a, b) in enumerate(spans[cells[k]]):
                if copy and n <= prev:
                    continue
                if all(b <= x or a >= y for x, y in taken):
                    place(k + 1, taken + [(a, b)], found + [cells[k]], n)
                    if len(best) == len(cells):
                        return
        place(k + 1, taken, found, None)
    place(0, [], [], None)
    return best


def row_cells(atoms, change, ctx):
    """Added/Removed table row: all cells must sit in one unit that carries the record identity."""
    diffs, result, wanted, ident, others = ctx['diffs'], ctx['result'], ctx['wanted'], ctx['ident'], ctx['others']
    side = 'right' if change['kind'] == 'Added' else 'left'
    texts = [a['new'] if side == 'right' else a['old'] for a in atoms]
    pool = []
    for d in diffs:
        for u in units(d[side], wanted[side], touching((d, side))):
            found = allocate(texts, u['text'])
            if found:
                pool.append((d, u, found))
    mine = ident[side] if ident else []
    anchors = [(d, u, f) for d, u, f in pool if holds(u['text'], mine)]
    # A removed (added) row belongs on a card of its own kind; inside another kind it was merged or paired.
    own_kind = [a for a in anchors if a[0]['kind'] == change['kind']]
    anchor = max(own_kind or anchors, key=lambda x: len(x[2]), default=None)
    paired = merged = False
    if anchor is not None and not own_kind:
        # Merged: what the card holds besides this row is a neighbour matched on the other side.
        rest = anchor[1]['text']
        for t in texts:
            rest = rest.replace(t, ' ')
        words = set(re.findall(r'\w+', rest.casefold()))
        opposite = set(re.findall(r'\w+', side_text(anchor[0], 'left' if side == 'right' else 'right').casefold()))
        merged = len(words) >= 2 and len(words & opposite) >= len(words) / 2
        paired = not merged
    mixed = anchor and [' / '.join(o) for o in others if o != tuple(mine) and holds(anchor[1]['text'], o)]
    # A card that names a row key that is no cell of this record attributes the row to another one,
    # as judge_identity() reads it for replacements (PR #11 comment 6513304357).
    sp = (anchor[0].get('structurePath') or {}) if anchor else {}
    key = sp.get('rowKey')
    # A card whose row correspondence the product marked unresolved certifies no row
    # (PR #11 comment 6513806516), as judge_identity() reads it for replacements.
    unresolved = sp.get('confidence') == 'unresolved'
    wrong_key = bool(key) and not bounded(norm(key), norm((change.get('left_text') or '') + ' | ' + (change.get('right_text') or '')))
    left = collections.Counter(anchor[2]) if anchor else collections.Counter()
    out = []
    for atom, t in zip(atoms, texts):
        # This cell's own occurrence in the record unit, used up by the cell that takes it.
        mine_here = left[t] > 0
        left[t] -= mine_here
        where = [{'card': d['id'], 'kind': d['kind'], 'page': u['page'],
                  'unitId': u['unitId']} for d, u, f in pool if t in f]
        un = unresolved_hits(result, side, t, wanted[side], True)
        if paired and mine_here:
            out.append(('paired_with_other_record', 'misattributed', [], where, un,
                        f'{change["kind"].lower()} row paired with another record in a {anchor[0]["kind"]} card'))
        elif merged and mine_here:
            out.append(('merged_into_neighbour_card', 'not_evaluable', [], where, un,
                        f'{change["kind"].lower()} row shown as extra text in a neighbour row\'s '
                        f'{anchor[0]["kind"]} card'))
        elif anchor and mine_here and wrong_key:
            # A wrong row key stays a wrong statement under an unresolved mark (PR #9 comment 6514246431).
            out.append(('row_key_contradicted', 'misattributed', [], where, un,
                        f'the card names rowKey {key!r}, which is not a cell of this record'
                        + ('; the product also marked the row identity unresolved' if unresolved else '')))
        elif anchor and mine_here and unresolved:
            out.append(('product_unresolved', 'not_evaluable', [], where, un,
                        'product marked the row identity unresolved'))
        elif anchor and mine_here and not mixed:
            out.append(('in_record', 'correct', [anchor[0]], where, un, ''))
        elif anchor and mine_here:
            out.append(('record_mixed', 'not_evaluable', [], where, un,
                        'record unit also carries ' + ', '.join(mixed)))
        elif anchor and t in anchor[2]:
            out.append(('record_short', 'not_evaluable', [], where, un,
                        'the record unit holds this text fewer times than the author row'))
        elif anchor and (where or un):
            out.append(('outside_record', 'not_evaluable', [], where, un,
                        'cell found only outside the unit that carries the record identity'))
        elif anchor:
            out.append(('not_found', 'not_located', [], [], [], 'script did not locate the cell'))
        elif where or un:
            out.append(('record_unconfirmed', 'not_evaluable', [], where, un,
                        'no unit carries the declared record identity' if mine
                        else 'no declared record identity'))
        else:
            out.append(('not_found', 'not_located', [], [], [], 'script did not locate the cell'))
    record = None
    if anchor:
        record = {'card': anchor[0]['id'], 'kind': anchor[0]['kind'], 'page': anchor[1]['page'],
                  'unitId': anchor[1]['unitId'], 'otherRecords': mixed or [],
                  'refs': [ref(l) for l in anchor[1]['locs']]}
    return out, record


def paragraph_atom(atom, change, ctx):
    side = 'right' if change['kind'] == 'Added' else 'left'
    other = 'left' if side == 'right' else 'right'
    t, wanted = atom['new'] if side == 'right' else atom['old'], ctx['wanted'][side]
    held = [d for d in ctx['diffs'] if located(d, side, t, wanted)]
    cands = [candidate(d, {side: t}, ctx['wanted'], 'not_applicable', 'paragraph event: no record identity')
             for d in held]
    # The card must add or remove the text: one that keeps it on the other side
    # too (an unchanged move, unchanged context) does neither, unless the card itself
    # adds or removes this copy, every character of it changed (a second copy beside
    # the first, PR #9 comment 6515226035).
    # Matched as the text was found: a longer number there is another text (PR #9 comment 6512254699).
    whole = lambda d: any(all(x[2] for x in span if x[0] != ' ') for span in found(d, side, t, wanted))
    hits = [d for d in held if not occurs(t, side_text(d, other)) or whole(d)]
    if hits:
        return 'found', 'correct', hits, cands, [], ''
    if held:
        return 'kept_on_other_side', 'not_located', [], cands, [], \
            'every card holding the text keeps it on the other side too (e.g. an unchanged move)'
    un = unresolved_hits(ctx['result'], side, t, wanted)
    if un:
        return 'unresolved_only', 'not_evaluable', [], cands, un, 'only in a product unresolved group'
    return 'not_found', 'not_located', [], cands, [], 'script did not locate the text'


def copies(cards, side, needle, edit, change, ctx):
    """Distinct source occurrences of the needle on one side of the cards that carry the edit and
    belong to the event: for a row, the record identity reaches that occurrence (judge_identity() on
    it alone); for a paragraph, the author paragraph surrounds it (context()). An occurrence two cards
    cite counts once."""
    ident, wanted, seen, n = ctx['ident'], ctx['wanted'], set(), 0
    author = change.get('left_text' if side == 'left' else 'right_text')
    for d in cards:
        for i, span in occurrences(d, side, needle, wanted[side]):
            ids = {(x[1], x[3]) for x in span if x[1] is not None}
            if not carries(span, edit) or ids & seen:
                continue
            if (judge_identity(d, {side: needle}, ident, ctx['others'], change, wanted, {side: edit},
                               {side: {i}})[0] != 'confirmed' if ident is not None
                    else not context(d, side, needle, wanted[side], author, edit, only={i})):
                continue
            seen |= ids
            n += 1
    return n


def event_verdict(verdicts):
    if not verdicts:
        return 'excluded'
    if all(v == 'correct' for v in verdicts):
        return 'correct'
    for v in VERDICTS:
        if v in verdicts:
            return v
    if all(v in ('correct', 'split_attributable') for v in verdicts):
        return 'split_attributable'
    return 'not_located' if all(v == 'not_located' for v in verdicts) else 'partly_located'


def legacy_outcome(verdict, verdicts):
    if verdict in ('excluded', 'not_located'):
        return 'not_found' if verdict == 'not_located' else 'excluded'
    if verdict == 'correct':
        return 'complete'
    return 'partly_complete' if 'correct' in verdicts else 'incomplete'


def triage(change, result, declared, family, claimed):
    lp, rp = set(change.get('left_pages') or []), set(change.get('right_pages') or [])
    ident = expected_identity(change, declared)
    own = {tuple(ident[s]) for s in ('left', 'right')} if ident else set()
    others = sorted(family.get(ident['table'], set()) - own) if ident and ident['table'] else []
    ctx = {'id': str(change['id']), 'diffs': result['differences'], 'result': result,
           'wanted': {'left': lp, 'right': rp}, 'ident': ident, 'others': others}
    atoms, dropped = fragments(change)
    record = None
    if change['kind'] in ('Added', 'Removed') and atoms and atoms[0]['cell']:
        judged, record = row_cells(atoms, change, ctx)
        judged = [(s, v, acc, [], un, why, where) for (s, v, acc, where, un, why) in judged]
    else:
        judge = lambda a: (*(paragraph_atom(a, change, ctx) if change['kind'] in ('Added', 'Removed')
                             else text_atom(a, change, ctx, claimed)), None)
        # A Moved event's edits first: a card carrying one shows the moved paragraph for its opening.
        done = {i: judge(a) for i, a in enumerate(atoms) if not a.get('opening')}
        ctx['edited'] = {d['id'] for j in done.values() for d in j[2]}
        judged = [done[i] if i in done else judge(a) for i, a in enumerate(atoms)]
        # Copies of one edit each need an edited occurrence of their own on the accepted cards: one
        # edited copy does not show two (PR #11 comment 6516690587).
        copied = collections.defaultdict(list)
        for i, a in enumerate(atoms):
            if not a.get('opening') and judged[i][1] in ('correct', 'split_attributable'):
                copied[(a['old'], a['new'])].append(i)
        for (old, new), ks in copied.items():
            n = sum(1 for a in atoms if not a.get('opening') and (a['old'], a['new']) == (old, new))
            if n < 2:
                continue
            need = needs_edit(old or '', new or '')
            cards = list({d['id']: d for i in ks for d in judged[i][2]}.values())
            room = min(copies(cards, side, text, need[side], change, ctx)
                       for side, text in (('left', old), ('right', new)) if text and need[side])
            for i in ks[room:]:
                _, _, _, cands, un, _, where = judged[i]
                judged[i] = ('copies_short', 'not_evaluable', [], cands, un,
                             f'the accepted cards make this edit {room} time(s); the author lists it {n} times', where)
    detail = []
    for i, (atom, (state, verdict, acc, cands, un, why, where)) in enumerate(zip(atoms, judged)):
        detail.append({'index': i, 'old': atom['old'], 'new': atom['new'], 'authorCategory': atom['authorCategory'],
                       'state': state, 'verdict': verdict, 'reason': why,
                       'accepted': [d['id'] for d in acc], 'candidates': cands,
                       **({'cellHits': where} if where is not None else {}),
                       'unresolved': un, 'acceptedFacts': [d.get('facts') for d in acc]})
    verdicts = [a['verdict'] for a in detail]
    verdict = event_verdict(verdicts)
    if ident is not None:
        def own(c, side):
            """The record's locations: those in the units where its identity was confirmed, not
            another record the card also edits (#11 comment 6508818754)."""
            keep = ((c.get('identityCells') or {}).get(side) or {}).get('units')
            return [r for r in c[side] if not keep or r['unitId'] in keep]
        if record is None:
            # Each side from the accepted cards that hold it: one card, the Removed and the Added
            # card of a split (PR #11 comment 6511266424), or several cards, one per edit, whose
            # locations are read together, each source character once (PR #11 comment 6517133695).
            held = {side: list({c['card']: None for a in detail for c in a['candidates']
                                if c['card'] in a['accepted'] and c[side]}) for side in ('left', 'right')}
            first = (held['left'] or held['right'] or [None])[0]

            def merged(side):
                locs = [r for k in held[side] for a in detail for c in a['candidates']
                        if c['card'] == k and k in a['accepted'] for r in own(c, side)]
                by = collections.OrderedDict()
                for r in locs:
                    by.setdefault((r['page'], r['unitId']), []).append(r)
                return [r for v in by.values() for r in pieces(v)]
            if first:
                record = {'card': first, 'left': merged('left'), 'right': merged('right'),
                          **({'rightCard': held['right'][0]} if held['right'] and held['right'][0] != first else {}),
                          **({'cards': held} if len(held['left']) > 1 or len(held['right']) > 1 else {})}
        lc, rc = cells(change.get('left_text') or ''), cells(change.get('right_text') or '')
        diff = lambda i: next(d for d in result['differences'] if d['id'] == i)
        card = record and diff(record['card'])
        cards = record and {s: [diff(k) for k in (record.get('cards') or {}).get(s) or
                                [record.get('rightCard', record['card']) if s == 'right' else record['card']]]
                            for s in ('left', 'right')}

        def source(key, r):
            """Full text of one accepted record location; refs keep only a preview (r4415969212). A
            location trimmed to its new characters (pieces()) is read from the card's location."""
            sides, (a, b) = ('left', 'right') if key == 'refs' else (key,), r['rawRange']
            return next((l['text'][a - l['rawRange'][0]:b - l['rawRange'][0]] for side in sides for d in cards[side]
                         for l in d[side] if l['pageIndex'] + 1 == r['page'] and l['unitId'] == r['unitId']
                         and l['rawRange'][0] <= a and b <= l['rawRange'][1]), r['text'])

        def text(*keys):
            sides = sorted({s for k in keys for s in (('left', 'right') if k == 'refs' else (k,))})
            joined = touching(*((d, s) for s in sides for d in cards[s])) if card else frozenset()
            return norm(spliced((((r['page'], r['unitId']), r['rawRange'], source(k, r))
                                 for k in keys for r in (record or {}).get(k, [])), joined))
        full = None
        # A moved row, too, is full only with every author cell, not by its opening (PR #11
        # comment 6515146325).
        if record and change['kind'] in ('Replaced', 'Moved'):
            # Each author cell needs its own stretch of the record text (r4417329496).
            full = all(len(allocate(row, text(side))) == len([c for c in row if c])
                       for side, row in (('left', lc or []), ('right', rc or [])))
        elif record:
            full = all(a['verdict'] == 'correct' for a in detail)
        shown = text('left', 'right', 'refs')
        record = {'expectedIdentity': ident, 'acceptedRecord': record, 'fullRowRecovered': full,
                  'primaryIdentityOnRecord': bool(record and ident['cells'] and bounded(ident['cells'][0], shown)),
                  'cells': {'left': len([c for c in lc or [] if c]), 'right': len([c for c in rc or [] if c])}}
    accepted = sorted({c for a in detail for c in a['accepted']})
    return {'id': str(change['id']), 'block': change['block'], 'scope': 'body', 'kind': change['kind'],
            'authorCategory': change['category'], 'authorExpect': change.get('expect'),
            'pages': {'left': sorted(lp), 'right': sorted(rp)},
            'outcome': legacy_outcome(verdict, verdicts), 'verdict': verdict,
            'atoms': [a['state'] for a in detail],
            'acceptedCards': accepted, 'row': record, 'atomEvidence': detail,
            'excludedAtoms': dropped, 'note': (change.get('notes') or [''])[0]}


def furniture(change, result):
    """Page furniture: report body cards carrying the text; the role itself cannot be checked."""
    lp, rp = set(change.get('left_pages') or []), set(change.get('right_pages') or [])
    hits, compact = [], lambda t: re.sub(r'\s+', '', t)
    # Whitespace is ignored here: footer barcodes are extracted as spaced characters.
    for e in change.get('edits', []):
        old, new = compact(norm(e['old'])), compact(norm(e['new']))
        hits += [d for d in result['differences'] if d not in hits and (
            (old and old in compact(d['oldText']) and on_pages(d['left'], lp)) or
            (new and new in compact(d['newText']) and on_pages(d['right'], rp)))]
    return {'id': str(change['id']), 'block': change['block'], 'scope': 'page_furniture', 'kind': change['kind'],
            'authorCategory': change['category'], 'outcome': 'page_furniture', 'verdict': 'not_evaluable', 'atoms': [],
            'reason': 'result contract has no page-furniture role; the script only counts body cards '
                      'carrying the literal author text, ignoring whitespace (a pattern such as "Page n of N" '
                      'is not literal and finds nothing)',
            'edits': [{'old': e['old'], 'new': e['new']} for e in change.get('edits', [])],
            'bodyCardsWithText': len(hits), 'cards': [d['id'] for d in hits], 'note': (change.get('notes') or [''])[0]}


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


PAGE = re.compile(r'\bpage\s*(\d+)(?:\s*(?:of|/)\s*(\d+))?', re.I)


def page_masked(text):
    """The text with the counter and total of each Page n expression replaced by #, each only when
    it is a whole number of the text (not the 1 of Page 1.1 or the 100 of Page 100,000), as the
    product's maskedPageNumbers() reads them (PR #11 comment 6509987949)."""
    whole = {m.span() for m in re.finditer(r'\d+(?:[.,]\d+)*', text)}
    out, at = '', 0
    for m in PAGE.finditer(text):
        for g in (1, 2):
            if m.group(g) and m.span(g) in whole:
                out += text[at:m.start(g)] + '#'
                at = m.end(g)
    return out + text[at:]
# Day and year are whole numbers of the text, as the scorer and the product read them (#10 4a12cd0).
DATE = re.compile(r'(?<!\d)(?<!\d[.,])(\d{1,2}) ([A-Za-z]+) (\d{4})(?![.,]?\d)')
MONTHS = {m: i + 1 for i, m in enumerate(('january', 'february', 'march', 'april', 'may', 'june', 'july',
                                          'august', 'september', 'october', 'november', 'december'))}


def real(date):
    """A (day, month name, year) that exists on the calendar: 29 February 2025 does not (PR #9
    comment 6508226511)."""
    day, month, year = date
    try:
        datetime.date(int(year), MONTHS[month.lower()], int(day))
    except (KeyError, ValueError):
        return False
    return True


def fact_check(d):
    """Facts a card states, re-read from its own old and new text: each 'consistent' with the
    texts or 'contradicted' by them. Consistent is not proof (page tokens are not re-confirmed)."""
    old, new = d['oldText'], d['newText']
    checks = {}
    for f in d.get('facts') or []:
        if f == 'whitespace_only':
            ok = old != new and old.split() == new.split()
        elif f == 'page_number_only':
            ok = old != new and (page_masked(old) == page_masked(new) if old and new else not PAGE.sub('', old or new).strip())
        elif f == 'dates_rolled_forward_one_year':
            a, b = DATE.findall(old), DATE.findall(new)
            ok = (len(a) == len(b) == 2 and all(real(x) and real(y) for x, y in zip(a, b))
                  and all(x[:2] == y[:2] and int(y[2]) == int(x[2]) + 1 for x, y in zip(a, b))
                  and DATE.sub('<date>', old) == DATE.sub('<date>', new))
        elif f == 'continued_heading':
            ok = not (old and new) and re.search(r"(?i)\b(?:continued|cont['’]d|cont\.?)\)?\.?$",
                                                 (old or new).strip()) is not None
        else:
            ok = None
        checks[f] = None if ok is None else 'consistent' if ok else 'contradicted'
    return checks


def main(changes_path, result_path, events_out=None, identity_path=None):
    with open(changes_path, encoding='utf-8') as f:
        changes = json.load(f)['changes']
    with open(result_path, encoding='utf-8') as f:
        result = json.load(f)
    declared, identity_info = declarations(identity_path, changes_path)
    body = [c for c in changes if c['kind'] != 'Header']
    # The declared identities of each table, so a card holding another record's identity is caught.
    family = collections.defaultdict(set)
    for c in body:
        ident = expected_identity(c, declared)
        if ident and ident['table']:
            family[ident['table']] |= {tuple(ident[s]) for s in ('left', 'right') if ident[s]}
    # Pass 1 finds the cards each event accepts; pass 2 lets a contradicting card count
    # as misattributed only when no other event accepted it as its own record.
    claimed = collections.defaultdict(set)
    for c in body:
        for card in triage(c, result, declared, family, {})['acceptedCards']:
            claimed[card].add(str(c['id']))
    rows = [triage(c, result, declared, family, claimed) for c in body]
    furn = [furniture(c, result) for c in changes if c['kind'] == 'Header']
    scored = [r for r in rows if r['verdict'] != 'excluded']
    accepted = {c for r in rows for c in r['acceptedCards']}
    furniture_cards = {c for f in furn for c in f['cards']}
    candidates = {c['card'] for r in rows for a in r['atomEvidence'] for c in a['candidates']}
    candidates |= {h['card'] for r in rows for a in r['atomEvidence'] for h in a.get('cellHits', [])}
    unexplained = [d for d in result['differences'] if d['id'] not in accepted | furniture_cards]
    tables = [r for r in scored if r['row']]
    atoms = [a for r in scored for a in r['atomEvidence']]
    facts = [(d['id'], f, v) for d in result['differences'] for f, v in fact_check(d).items()]
    summary = {
        'tool': TOOL,
        'inputs': {'changes': {'path': changes_path, 'sha256': sha256(changes_path)},
                   'result': {'path': result_path, 'sha256': sha256(result_path)},
                   'identity': identity_info},
        'resultFormat': result.get('schemaVersion'),
        'authorEvents': len(changes),
        'bodyEvents': len(rows),
        'pageFurnitureEvents': len(furn),
        'excluded': [{'id': r['id'], 'block': r['block'],
                      'reason': 'only whitespace or quote-style edits; no comparable fragment',
                      'edits': [{'old': a['old'], 'new': a['new']} for a in r['excludedAtoms']], 'note': r['note']}
                     for r in rows if r['verdict'] == 'excluded'],
        'excludedAtomsInScoredEvents': [{'id': r['id'], 'edits': r['excludedAtoms']}
                                        for r in scored if r['excludedAtoms']],
        'scored': len(scored),
        'verdicts': dict(collections.Counter(r['verdict'] for r in scored)),
        'verdictEvents': {v: [r['id'] for r in scored if r['verdict'] == v]
                          for v in sorted({r['verdict'] for r in scored})},
        'outcomes': dict(collections.Counter(r['outcome'] for r in scored)),
        'atoms': len(atoms),
        'atomVerdicts': dict(collections.Counter(a['verdict'] for a in atoms)),
        'tableRowEvents': {
            'total': len(tables),
            'changeCorrectlyAttributed': [r['id'] for r in tables if r['verdict'] == 'correct'],
            'fullRowRecovered': [r['id'] for r in tables if r['row']['fullRowRecovered']],
            'identityDeclared': sum(r['row']['expectedIdentity']['source'] == 'declared' for r in tables),
            'noDeclaredIdentity': [r['id'] for r in tables if not r['row']['expectedIdentity']['cells']],
            'acceptedWithoutPrimaryIdentity': [r['id'] for r in tables if r['row']['acceptedRecord']
                                               and not r['row']['primaryIdentityOnRecord']],
        },
        'sameCardWithoutRecordCells': [r['id'] for r in scored if 'same_card_identity_unconfirmed' in r['atoms']],
        'facts': {
            'stated': dict(collections.Counter(f for _, f, _ in facts)),
            'checks': dict(collections.Counter(f'{f}:{v}' for _, f, v in facts)),
            'contradicted': [{'card': i, 'fact': f} for i, f, v in facts if v == 'contradicted'],
        },
        'pageFurniture': [{k: f[k] for k in ('id', 'verdict', 'bodyCardsWithText', 'note')} for f in furn],
        'cards': len(result['differences']),
        'cardsOver600Chars': sum(1 for d in result['differences']
                                 if max(len(d['oldText']), len(d['newText'])) > 600),
        'acceptedCards': len(accepted),
        'pageFurnitureCards': len(furniture_cards - accepted),
        'unexplainedCards': len(unexplained),
        'unexplainedCandidateCards': sum(d['id'] in candidates for d in unexplained),
        'unresolvedGroups': len(result['unresolved']),
        'status': result['status'],
        'coreVersion': result.get('coreVersion'),
        'extractor': result['extractors'][0]['version'],
        'limitations': [
            'not_located means the script could not locate the text, not that the product missed it',
            'a table row whose identity is not declared is not evaluated',
            'highlight geometry is not checked; browser fine-position acceptance is out of scope',
            'unexplainedCards is a noise estimate, not a false-positive rate',
            'a consistent fact check does not re-confirm page tokens',
        ],
    }
    if events_out:
        with open(events_out, 'w', encoding='utf-8') as f:
            json.dump(rows + furn, f, ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    args = sys.argv[1:]
    opts = {}
    for name in ('--events', '--identity'):
        if name in args:
            i = args.index(name)
            opts[name] = args[i + 1]
            del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1], opts.get('--events'), opts.get('--identity'))
