"""Development triage of author renewal events against one comparison result.

Usage:
  python3 scripts/renewal-triage.py CHANGES_JSON RESULT_JSON [--events OUT_JSON]

For every author edit (old -> new) the stated pages are searched for product
cards. A Replaced edit is "same_card" when one card carries both texts and, for
table rows written as "a | b | c", also the row's unchanged cells (the record
identity). Added/Removed rows are checked cell by cell. Matching is by
whitespace-normalised substring, so superscripts and line breaks inside an
author fragment can make the script report "not_found" for text that is
present: "not_found" means "the script could not locate it", not "missed".

This is a development signal, not acceptance: it does not check highlight
geometry, and "unexplained" cards are only a noise estimate.
"""
import collections
import json
import re
import sys

RANK = {'Material': 0, 'Review': 1, 'RollForward': 2, 'Cosmetic': 3}


def norm(s):
    for a, b in (('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"')):
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def pages(locations):
    return {l['pageIndex'] + 1 for l in locations}


def cells(text):
    return [norm(c) for c in text.split(' | ')] if text and ' | ' in text else None


def fragments(change):
    kind = change['kind']
    if kind in ('Added', 'Removed'):
        text = change['right_text'] if kind == 'Added' else change['left_text']
        parts = [c for c in (cells(text) or [norm(text)[:40]]) if len(c) >= 2]
        return [(p if kind == 'Removed' else None, p if kind == 'Added' else None) for p in parts]
    if kind == 'Moved':
        return [(norm(change['left_text'])[:40], norm(change['right_text'])[:40])]
    return [(norm(e['old']), norm(e['new'])) for e in change.get('edits', [])
            if norm(e['old']) != norm(e['new'])]


def record_identity(change):
    left, right = cells(change.get('left_text') or ''), cells(change.get('right_text') or '')
    if not left or not right:
        return None
    same = [a for a, b in zip(left, right) if a == b]
    return same[:2] or None


def triage(change, result, used):
    lp, rp = set(change.get('left_pages') or []), set(change.get('right_pages') or [])
    diffs, unresolved = result['differences'], result['unresolved']
    identity = record_identity(change) if change['kind'] == 'Replaced' else None
    states, categories = [], []
    for old, new in fragments(change):
        oc = [d for d in diffs if old and old in norm(d['oldText']) and (not lp or pages(d['left']) & lp)]
        nc = [d for d in diffs if new and new in norm(d['newText']) and (not rp or pages(d['right']) & rp)]
        used.update(d['id'] for d in oc + nc)
        in_unresolved = any((old and old in norm(l['text'])) for u in unresolved for l in u['left']) or \
            any((new and new in norm(l['text'])) for u in unresolved for l in u['right'])
        if old and new:
            both = [d for d in oc if d in nc]
            right_row = [d for d in both if not identity or all(
                i in norm(d['oldText']) and i in norm(d['newText']) for i in identity)]
            if right_row:
                states.append('same_card'); hit = right_row
            elif both:
                states.append('same_card_without_record_cells'); hit = both
            elif (oc or in_unresolved) and (nc or in_unresolved):
                states.append('separate_cards'); hit = oc + nc
            elif oc or nc or in_unresolved:
                states.append('one_side_found'); hit = oc + nc
            else:
                states.append('not_found'); hit = []
        else:
            hit = oc or nc
            states.append('found' if hit else ('unresolved_only' if in_unresolved else 'not_found'))
        categories += [d['category'] for d in hit]
    best = min(categories, key=RANK.get) if categories else None
    if not states:
        outcome = 'excluded'
    elif all(s in ('same_card', 'found') for s in states):
        outcome = 'complete'
    elif all(s == 'not_found' for s in states):
        outcome = 'not_found'
    elif any(s in ('same_card', 'found') for s in states):
        outcome = 'partly_complete'
    else:
        outcome = 'incomplete'
    return {'id': str(change['id']), 'kind': change['kind'], 'authorCategory': change['category'],
            'outcome': outcome, 'atoms': states, 'bestProductCategory': best,
            'note': (change.get('notes') or [''])[0]}


def main(changes_path, result_path, events_out=None):
    changes = json.load(open(changes_path, encoding='utf-8'))['changes']
    result = json.load(open(result_path, encoding='utf-8'))
    used = set()
    rows = [triage(c, result, used) for c in changes if c['kind'] != 'Header']
    scored = [r for r in rows if r['outcome'] != 'excluded']
    material = [r for r in scored if r['authorCategory'] == 'Material']
    unexplained = [d for d in result['differences'] if d['id'] not in used]
    summary = {
        'bodyEvents': len(rows),
        'excluded': [{'id': r['id'], 'reason': 'only whitespace or quote-style edits; no comparable fragment',
                      'note': r['note']} for r in rows if r['outcome'] == 'excluded'],
        'scored': len(scored),
        'outcomes': dict(collections.Counter(r['outcome'] for r in scored)),
        'sameCardWithoutRecordCells': [r['id'] for r in scored if 'same_card_without_record_cells' in r['atoms']],
        'authorMaterial': len(material),
        'authorMaterialShownOnlyAsCosmetic': [r['id'] for r in material if r['bestProductCategory'] == 'Cosmetic'],
        'cards': len(result['differences']),
        'cardsOver600Chars': sum(1 for d in result['differences']
                                 if max(len(d['oldText']), len(d['newText'])) > 600),
        'unexplainedCards': len(unexplained),
        'unexplainedMaterialCards': sum(d['category'] == 'Material' for d in unexplained),
        'unresolvedGroups': len(result['unresolved']),
        'status': result['status'],
        'coreVersion': result.get('coreVersion'),
        'extractor': result['extractors'][0]['version'],
    }
    if events_out:
        json.dump(rows, open(events_out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
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
