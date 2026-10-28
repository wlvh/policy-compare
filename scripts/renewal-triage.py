"""Development triage of author renewal events against one comparison result.

Usage:
  python3 scripts/renewal-triage.py CHANGES_JSON RESULT_JSON [--events OUT_JSON] > SUMMARY_JSON

Every author change becomes atoms: one per edit (old -> new) for Replaced and
Moved (plus the paragraph opening for Moved), one per cell for table rows
written as "a | b | c" that were Added/Removed, one per opening fragment for
other Added/Removed paragraphs. Each atom keeps its candidate cards (text on
the stated pages) apart from the cards finally accepted for it.

Table rows need record identity. The expected identity comes from the author
answer only: cells named by the author's block id (ac_1315 -> "1315"), else the
first unchanged name-like cell; never an amount, percentage or date. A card
is accepted for a row when that identity sits in the same source unit as the
changed text on each side. A rowKey that is not a cell of the row, or another
row's identity in that unit, is a contradiction (misattributed) unless that
card is accepted by the other row's own event. Delete + add on separate cards
counts only as an attributable split when both sides show the record (rows)
or the author paragraph (text) around the change. An Added/Removed row must sit
in one unit of a card of its own kind: inside a neighbour row's card it is
"merged" (not evaluable); paired against a different record it is misattributed.

Matching is whitespace-normalised substring search, so superscripts and line
breaks can hide present text: "not_located" means the script could not locate
it, not that the product missed it. Page-furniture (Header) events are listed
separately and are not evaluable: the result contract has no furniture role.
The script does not check highlight geometry, and "unexplained" cards are a
noise estimate, not a false-positive rate.
"""
import collections
import hashlib
import json
import re
import sys

RANK = {'Material': 0, 'Review': 1, 'RollForward': 2, 'Cosmetic': 3}
TOOL = 'renewal-triage/2'
# Event verdicts, most decisive first; an event takes the first one any of its atoms has.
VERDICTS = ('misattributed', 'one_side_only', 'not_evaluable')


def norm(s):
    for a, b in (('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def pages(locations):
    return {l['pageIndex'] + 1 for l in locations}


def cells(text):
    return [norm(c) for c in text.split(' | ')] if text and ' | ' in text else None


def bounded(needle, text):
    """Whole-token search, so "1315" does not match inside "21,315,000"."""
    return bool(needle) and re.search(r'(?<![0-9A-Za-z])' + re.escape(needle) + r'(?![0-9A-Za-z])', text) is not None


def best(categories):
    return min(categories, key=RANK.get) if categories else None


def ref(loc):
    return {'page': loc['pageIndex'] + 1, 'unitId': loc['unitId'], 'rawRange': loc['rawRange'],
            'text': loc['text'][:80]}


def units(locations, wanted):
    """Source units (page, unitId) of one side, in order, limited to the stated pages."""
    out = collections.OrderedDict()
    for loc in locations:
        if wanted and loc['pageIndex'] + 1 not in wanted:
            continue
        out.setdefault((loc['pageIndex'] + 1, loc['unitId']), []).append(loc)
    return [{'page': k[0], 'unitId': k[1], 'text': norm(' '.join(l['text'] for l in v)), 'locs': v}
            for k, v in out.items()]


def side_text(d, side):
    return norm(d['oldText'] if side == 'left' else d['newText'])


def identifier_like(cell):
    return re.search(r'[A-Za-z]{2}', cell) is not None and not re.match(r'(?:USD|EUR|GBP)\s?\d', cell)


def expected_identity(change):
    """Row identity taken from the author answer, or None for paragraphs."""
    left, right = cells(change.get('left_text') or ''), cells(change.get('right_text') or '')
    if change['kind'] == 'Replaced':
        if not left or not right:
            return None
        pool = [a for a, b in zip(left, right) if a == b and a]
    elif left or right:
        pool = [c for c in (left or right) if c]
    else:
        return None
    parts = change['block'].split('_')
    rest = parts[1:] or parts
    named = []
    # Block order decides the primary cell: cp_M-FNKB_Selwyn -> "M-FNKB", then the party name.
    for token in ['.'.join(rest).casefold(), *(p.casefold() for p in rest)]:
        named += [c for c in pool if len(token) >= 2 and c not in named and (
            c.casefold() == token or token in re.split(r'[\s,]+', c.casefold()))]
    if named:
        return {'cells': named, 'source': 'author_block_id'}
    named = [c for c in pool if identifier_like(c)][:1]
    return {'cells': named, 'source': 'identifier_like_cell' if named else None}


def fragments(change):
    """Comparable atoms and the edits normalisation leaves nothing to compare in."""
    kind, atoms, dropped = change['kind'], [], []
    if kind in ('Added', 'Removed'):
        text = change['right_text'] if kind == 'Added' else change['left_text']
        row = cells(text)
        for p in [c for c in (row or [norm(text)[:40]]) if len(c) >= 2]:
            atoms.append({'old': p if kind == 'Removed' else None, 'new': p if kind == 'Added' else None,
                          'cell': row is not None, 'authorCategory': change['category']})
        return atoms, dropped
    if kind == 'Moved':
        atoms.append({'old': norm(change['left_text'])[:40], 'new': norm(change['right_text'])[:40],
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


def local(d, side, needle, wanted):
    """Units of a card side holding the needle; the whole side if it spans units."""
    us = units(d[side], wanted)
    hit = [u for u in us if needle in u['text']]
    return hit or us


def judge_identity(d, needles, ident, others, change, wanted):
    """Identity status of one card for one record: confirmed, contradicted, ambiguous, unconfirmed."""
    sp = d.get('structurePath') or {}
    if sp.get('confidence') == 'unresolved':
        return 'product_unresolved', 'product marked the row identity unresolved', {}
    key = sp.get('rowKey')
    row_text = norm((change.get('left_text') or '') + ' | ' + (change.get('right_text') or ''))
    if key and not bounded(norm(key), row_text):
        return 'contradicted', f'rowKey {key!r} is not a cell of this record', {}
    seen, status = {}, []
    for side, needle in needles.items():
        us = local(d, side, needle, wanted[side])
        own = [c for c in ident['cells'] if any(bounded(c, u['text']) for u in us)]
        foreign = [c for c in others if any(bounded(c, u['text']) for u in us)]
        seen[side] = {'units': [u['unitId'] for u in us], 'identity': own, 'otherRecords': foreign}
        status.append('confirmed' if own and not foreign else 'contradicted' if foreign and not own
                      else 'ambiguous' if foreign else 'unconfirmed')
    for s in ('contradicted', 'ambiguous', 'unconfirmed'):
        if s in status:
            return s, f'record unit on {", ".join(k for k, v in zip(needles, status) if v == s)}: {s}', seen
    return 'confirmed', 'expected identity in the same source unit as the change', seen


def in_context(card, needle, author):
    """Card shows the author paragraph around the change, not just the changed words."""
    a = norm(author or '')
    return len(a) >= len(needle) + 10 and needle in card and (a in card or (card in a and len(card) >= len(needle) + 10))


def evidence(d, side, needle, wanted):
    return [ref(l) for u in local(d, side, needle, wanted) for l in u['locs']] if needle else []


def candidate(d, needles, wanted, identity=None, reason=None, seen=None):
    sp = d.get('structurePath') or {}
    return {'card': d['id'], 'kind': d['kind'], 'category': d['category'],
            'table': sp.get('table'), 'rowKey': sp.get('rowKey'), 'confidence': sp.get('confidence'),
            'identity': identity, 'identityReason': reason, 'identityCells': seen or None,
            'left': evidence(d, 'left', needles.get('left'), wanted['left']),
            'right': evidence(d, 'right', needles.get('right'), wanted['right'])}


def unresolved_hits(result, side, needle, wanted, row_cell=False):
    """Unresolved groups holding the needle on one side, judged per group and page."""
    hits = []
    for i, u in enumerate(result['unresolved']):
        for unit in units(u[side], wanted):
            if (bounded(needle, unit['text']) if row_cell else needle in unit['text']):
                hits.append({'group': i, 'reason': u['reason'], 'side': side, 'page': unit['page'],
                             'unitId': unit['unitId']})
    return hits


def text_atom(atom, change, ctx, claimed):
    """Replaced/Moved atom: same card, attributable split, one side, or not located."""
    diffs, result, wanted = ctx['diffs'], ctx['result'], ctx['wanted']
    old, new, ident, others = atom['old'], atom['new'], ctx['ident'], ctx['others']
    needles = {'left': old, 'right': new}
    oc = [d for d in diffs if old in side_text(d, 'left') and on_pages(d['left'], wanted['left'])]
    nc = [d for d in diffs if new in side_text(d, 'right') and on_pages(d['right'], wanted['right'])]
    same = [d for d in oc if d in nc]
    cands, accepted, suspects, open_ = [], [], [], []
    for d in same:
        if ident is None:
            status, why, seen = 'not_applicable', 'paragraph event: no record identity', None
        else:
            status, why, seen = judge_identity(d, needles, ident, others, change, wanted)
        cands.append(candidate(d, needles, wanted, status, why, seen))
        if status in ('confirmed', 'not_applicable'):
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
    if open_:
        return ('same_card_identity_unconfirmed', 'not_evaluable', [], cands, [],
                'same card, but the record identity is ' + ', '.join(sorted({s for _, s in open_})))
    # No card carries both sides: look for each side separately.
    olds, news = [d for d in oc if d not in same], [d for d in nc if d not in same]
    ou = unresolved_hits(result, 'left', old, wanted['left'])
    nu = unresolved_hits(result, 'right', new, wanted['right'])
    for d in olds:
        cands.append(candidate(d, {'left': old}, wanted))
    for d in news:
        cands.append(candidate(d, {'right': new}, wanted))
    if olds and news:
        if ident is None:
            lk = [d for d in olds if in_context(side_text(d, 'left'), old, change.get('left_text'))]
            rk = [d for d in news if in_context(side_text(d, 'right'), new, change.get('right_text'))]
            why = 'author paragraph text around the change'
        else:
            judged = lambda ds, side, n: [d for d in ds if judge_identity(
                d, {side: n}, ident, others, change, wanted)[0] == 'confirmed']
            lk, rk = judged(olds, 'left', old), judged(news, 'right', new)
            why = 'expected record identity in each side unit'
        if lk and rk:
            return 'split_attributable', 'split_attributable', lk + rk, cands, ou + nu, 'separate cards; ' + why
        return ('separate_cards', 'not_evaluable', [], cands, ou + nu,
                'separate cards without verifiable common context (' + why + ')')
    if (olds or ou) and (news or nu):
        return ('in_unresolved_group', 'not_evaluable', [], cands, ou + nu,
                'one or both sides only in a product unresolved group')
    if olds or ou or news or nu:
        side = 'left' if (olds or ou) else 'right'
        return 'one_side_found', 'one_side_only', [], cands, ou + nu, f'only the {side} side was located'
    return 'not_found', 'not_located', [], cands, [], 'script did not locate either side'


def row_cells(atoms, change, ctx):
    """Added/Removed table row: all cells must sit in one unit that carries the record identity."""
    diffs, result, wanted, ident, others = ctx['diffs'], ctx['result'], ctx['wanted'], ctx['ident'], ctx['others']
    side = 'right' if change['kind'] == 'Added' else 'left'
    texts = [a['new'] if side == 'right' else a['old'] for a in atoms]
    pool = []
    for d in diffs:
        for u in units(d[side], wanted[side]):
            found = [t for t in texts if bounded(t, u['text'])]
            if found:
                pool.append((d, u, found))
    anchors = [(d, u, f) for d, u, f in pool if ident and any(bounded(c, u['text']) for c in ident['cells'])]
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
    mixed = anchor and [c for c in others if bounded(c, anchor[1]['text'])]
    out = []
    for atom, t in zip(atoms, texts):
        where = [{'card': d['id'], 'kind': d['kind'], 'category': d['category'], 'page': u['page'],
                  'unitId': u['unitId']} for d, u, f in pool if t in f]
        un = unresolved_hits(result, side, t, wanted[side], True)
        if paired and t in anchor[2]:
            out.append(('paired_with_other_record', 'misattributed', [], where, un,
                        f'{change["kind"].lower()} row paired with another record in a {anchor[0]["kind"]} card'))
        elif merged and t in anchor[2]:
            out.append(('merged_into_neighbour_card', 'not_evaluable', [], where, un,
                        f'{change["kind"].lower()} row shown as extra text in a neighbour row\'s '
                        f'{anchor[0]["kind"]} card'))
        elif anchor and t in anchor[2] and not mixed:
            out.append(('in_record', 'correct', [anchor[0]], where, un, ''))
        elif anchor and t in anchor[2]:
            out.append(('record_mixed', 'not_evaluable', [], where, un,
                        'record unit also carries ' + ', '.join(mixed)))
        elif anchor and (where or un):
            out.append(('outside_record', 'not_evaluable', [], where, un,
                        'cell found only outside the unit that carries the record identity'))
        elif anchor:
            out.append(('not_found', 'not_located', [], [], [], 'script did not locate the cell'))
        elif where or un:
            out.append(('record_unconfirmed', 'not_evaluable', [], where, un,
                        'no unit carries the expected record identity' if ident and ident['cells']
                        else 'no expected record identity'))
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
    t, wanted = atom['new'] if side == 'right' else atom['old'], ctx['wanted'][side]
    hits = [d for d in ctx['diffs'] if t in side_text(d, side) and on_pages(d[side], wanted)]
    cands = [candidate(d, {side: t}, ctx['wanted'], 'not_applicable', 'paragraph event: no record identity')
             for d in hits]
    if hits:
        return 'found', 'correct', hits, cands, [], ''
    un = unresolved_hits(ctx['result'], side, t, wanted)
    if un:
        return 'unresolved_only', 'not_evaluable', [], cands, un, 'only in a product unresolved group'
    return 'not_found', 'not_located', [], cands, [], 'script did not locate the text'


def category_check(author, period, product):
    if product is None:
        return None
    if product == 'Review':
        return 'review'
    if author == 'RollForward' and not period:
        return 'outside_product_roll_forward_definition'
    expected = {'Material': 'Material', 'Cosmetic': 'Cosmetic', 'RollForward': 'RollForward'}[author]
    if product == expected:
        return 'consistent'
    return 'upgraded' if RANK[product] < RANK[expected] else 'downgraded'


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


def triage(change, result, family, claimed):
    lp, rp = set(change.get('left_pages') or []), set(change.get('right_pages') or [])
    ident = expected_identity(change)
    own = set(ident['cells']) if ident else set()
    prefix = change['block'].split('_')[0] if '_' in change['block'] else None
    others = sorted({c for c in family.get(prefix, ()) if c not in own}) if prefix else []
    ctx = {'id': str(change['id']), 'diffs': result['differences'], 'result': result,
           'wanted': {'left': lp, 'right': rp}, 'ident': ident, 'others': others}
    atoms, dropped = fragments(change)
    period = change['block'] == 'period' and change['category'] == 'RollForward'
    record = None
    if change['kind'] in ('Added', 'Removed') and atoms and atoms[0]['cell']:
        judged, record = row_cells(atoms, change, ctx)
        judged = [(s, v, acc, [], un, why, where) for (s, v, acc, where, un, why) in judged]
    else:
        judged = [(*(paragraph_atom(a, change, ctx) if change['kind'] in ('Added', 'Removed')
                     else text_atom(a, change, ctx, claimed)), None) for a in atoms]
    detail = []
    for i, (atom, (state, verdict, acc, cands, un, why, where)) in enumerate(zip(atoms, judged)):
        cats = [d['category'] for d in acc]
        detail.append({'index': i, 'old': atom['old'], 'new': atom['new'], 'authorCategory': atom['authorCategory'],
                       'state': state, 'verdict': verdict, 'reason': why,
                       'accepted': [d['id'] for d in acc], 'candidates': cands,
                       **({'cellHits': where} if where is not None else {}),
                       'unresolved': un, 'productCategories': cats, 'category': best(cats),
                       'categoryCheck': category_check(atom['authorCategory'], period, best(cats))})
    verdicts = [a['verdict'] for a in detail]
    verdict = event_verdict(verdicts)
    if ident is not None:
        record = record or next((
            {'card': c['card'], 'left': c['left'], 'right': c['right']}
            for a in detail for c in a['candidates'] if c['card'] in a['accepted']), None)
        lc, rc = cells(change.get('left_text') or ''), cells(change.get('right_text') or '')
        full = None
        if record and change['kind'] == 'Replaced':
            def holds(side, row):
                text = norm(' '.join(r['text'] for r in record[side]))
                return all(bounded(c, text) for c in row if c)
            full = holds('left', lc) and holds('right', rc)
        elif record:
            full = all(a['verdict'] == 'correct' for a in detail)
        shown = norm(' '.join(r['text'] for k in ('left', 'right', 'refs') for r in (record or {}).get(k, [])))
        record = {'expectedIdentity': ident, 'acceptedRecord': record, 'fullRowRecovered': full,
                  'primaryIdentityOnRecord': bool(record and ident['cells'] and bounded(ident['cells'][0], shown)),
                  'cells': {'left': len([c for c in lc or [] if c]), 'right': len([c for c in rc or [] if c])}}
    accepted = sorted({c for a in detail for c in a['accepted']})
    return {'id': str(change['id']), 'block': change['block'], 'scope': 'body', 'kind': change['kind'],
            'authorCategory': change['category'], 'authorExpect': change.get('expect'),
            'policyPeriodRollForward': period, 'pages': {'left': sorted(lp), 'right': sorted(rp)},
            'outcome': legacy_outcome(verdict, verdicts), 'verdict': verdict,
            'atoms': [a['state'] for a in detail],
            'bestProductCategory': best([c for a in detail for c in a['productCategories']]),
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
            'bodyCardsWithText': len(hits), 'cardCategories': dict(collections.Counter(d['category'] for d in hits)),
            'cards': [d['id'] for d in hits], 'note': (change.get('notes') or [''])[0]}


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def main(changes_path, result_path, events_out=None):
    with open(changes_path, encoding='utf-8') as f:
        changes = json.load(f)['changes']
    with open(result_path, encoding='utf-8') as f:
        result = json.load(f)
    body = [c for c in changes if c['kind'] != 'Header']
    family = collections.defaultdict(set)
    for c in body:
        ident = expected_identity(c)
        if ident and ident['cells'] and '_' in c['block']:
            family[c['block'].split('_')[0]].add(ident['cells'][0])
    # Pass 1 finds the cards each event accepts; pass 2 lets a contradicting card count
    # as misattributed only when no other event accepted it as its own record.
    claimed = collections.defaultdict(set)
    for c in body:
        for card in triage(c, result, family, {})['acceptedCards']:
            claimed[card].add(str(c['id']))
    rows = [triage(c, result, family, claimed) for c in body]
    furn = [furniture(c, result) for c in changes if c['kind'] == 'Header']
    scored = [r for r in rows if r['verdict'] != 'excluded']
    material = [r for r in scored if r['authorCategory'] == 'Material']
    accepted = {c for r in rows for c in r['acceptedCards']}
    furniture_cards = {c for f in furn for c in f['cards']}
    candidates = {c['card'] for r in rows for a in r['atomEvidence'] for c in a['candidates']}
    candidates |= {h['card'] for r in rows for a in r['atomEvidence'] for h in a.get('cellHits', [])}
    unexplained = [d for d in result['differences'] if d['id'] not in accepted | furniture_cards]
    tables = [r for r in scored if r['row']]
    atoms = [a for r in scored for a in r['atomEvidence']]
    summary = {
        'tool': TOOL,
        'inputs': {'changes': {'path': changes_path, 'sha256': sha256(changes_path)},
                   'result': {'path': result_path, 'sha256': sha256(result_path)}},
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
        'atomCategoryChecks': dict(collections.Counter(str(a['categoryCheck']) for a in atoms)),
        'tableRowEvents': {
            'total': len(tables),
            'changeCorrectlyAttributed': [r['id'] for r in tables if r['verdict'] == 'correct'],
            'fullRowRecovered': [r['id'] for r in tables if r['row']['fullRowRecovered']],
            'identityFromAuthorBlockId': sum(r['row']['expectedIdentity']['source'] == 'author_block_id'
                                             for r in tables),
            'identityFromNameLikeCell': sum(r['row']['expectedIdentity']['source'] == 'identifier_like_cell'
                                            for r in tables),
            'noExpectedIdentity': [r['id'] for r in tables if not r['row']['expectedIdentity']['cells']],
            'acceptedWithoutPrimaryIdentity': [r['id'] for r in tables if r['row']['acceptedRecord']
                                               and not r['row']['primaryIdentityOnRecord']],
        },
        'sameCardWithoutRecordCells': [r['id'] for r in scored if 'same_card_identity_unconfirmed' in r['atoms']],
        'rollForward': {
            'author': [r['id'] for r in rows if r['authorCategory'] == 'RollForward'],
            'policyPeriod': [{'id': r['id'], 'productCategories': [a['category'] for a in r['atomEvidence']],
                              'checks': [a['categoryCheck'] for a in r['atomEvidence']]}
                             for r in rows if r['policyPeriodRollForward']],
        },
        'authorMaterial': len(material),
        'authorMaterialShownOnlyAsCosmetic': [r['id'] for r in material if r['bestProductCategory'] == 'Cosmetic'],
        'pageFurniture': [{k: f[k] for k in ('id', 'verdict', 'bodyCardsWithText', 'cardCategories', 'note')}
                          for f in furn],
        'cards': len(result['differences']),
        'cardsOver600Chars': sum(1 for d in result['differences']
                                 if max(len(d['oldText']), len(d['newText'])) > 600),
        'acceptedCards': len(accepted),
        'pageFurnitureCards': len(furniture_cards - accepted),
        'unexplainedCards': len(unexplained),
        'unexplainedCandidateCards': sum(d['id'] in candidates for d in unexplained),
        'unexplainedMaterialCards': sum(d['category'] == 'Material' for d in unexplained),
        'unresolvedGroups': len(result['unresolved']),
        'status': result['status'],
        'coreVersion': result.get('coreVersion'),
        'extractor': result['extractors'][0]['version'],
        'limitations': [
            'not_located means the script could not locate the text, not that the product missed it',
            'highlight geometry is not checked; browser fine-position acceptance is out of scope',
            'unexplainedCards is a noise estimate, not a false-positive rate',
        ],
    }
    if events_out:
        with open(events_out, 'w', encoding='utf-8') as f:
            json.dump(rows + furn, f, ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    args = sys.argv[1:]
    out = None
    if '--events' in args:
        i = args.index('--events')
        out = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1], out)
