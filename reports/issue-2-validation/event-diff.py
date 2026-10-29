"""Per-event effect of a product change on the renewal samples, the triage held fixed.

usage: python3 reports/issue-2-validation/event-diff.py INPUTS OLD_DIR NEW_DIR OUT_DIR
  INPUTS   renewal inputs (testdata/renewal/<case>/changes.json)
  OLD_DIR  results before the change (<case>-<engine>.json or .json.gz)
  NEW_DIR  results after the change
Both result sets are triaged by the current scripts/renewal-triage.py with
scripts/renewal-identity.json, so every difference listed comes from the
product. Per event: verdict, the accepted cards' kinds and correspondence
methods, and whether the event's text sits in an unresolved group. Each event
is put in one bucket by what changed: a confirmed pairing lost (a paired card
holding the event's text, accepted or not, gone), split or unresolved gained,
or other. Writes
OUT_DIR/event-diff.json and event-diff.md. The cards themselves are compared
in OUT_DIR/card-summary.json (counts by kind, method, facts, repeat).
"""
import collections
import gzip
import json
import os
import subprocess
import sys
import tempfile

CASES = ['aviation_2024_vs_2025', 'bizav_2024_vs_2025']
ENGINES = ['mupdf', 'pdfjs']
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TRIAGE = os.path.join(ROOT, 'scripts', 'renewal-triage.py')
IDENTITY = os.path.join(ROOT, 'scripts', 'renewal-identity.json')
PAIRED = ('Replaced', 'Moved')


def load(directory, name):
    for path, opener in ((os.path.join(directory, name + '.json'), open),
                         (os.path.join(directory, name + '.json.gz'), gzip.open)):
        if os.path.exists(path):
            with opener(path, 'rt', encoding='utf-8') as f:
                return json.load(f)
    raise FileNotFoundError(os.path.join(directory, name))


def triage(changes, result, tmp):
    path, events = os.path.join(tmp, 'result.json'), os.path.join(tmp, 'events.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(result, f)
    out = subprocess.run([sys.executable, TRIAGE, changes, path, '--events', events, '--identity', IDENTITY],
                         capture_output=True, text=True, check=True).stdout
    with open(events, encoding='utf-8') as f:
        return json.loads(out), {e['id']: e for e in json.load(f)}


def view(event, result):
    cards = {d['id']: d for d in result['differences']}
    acc = [cards[c] for c in event.get('acceptedCards', [])]
    # Cards holding the event's text, accepted or not: the pairing the product made, judged or not.
    held = {c['card'] for a in event.get('atomEvidence', []) for c in a.get('candidates', [])}
    held |= {h['card'] for a in event.get('atomEvidence', []) for h in a.get('cellHits', [])}
    paired = lambda ds: any(d['kind'] in PAIRED and d['left'] and d['right']
                            and (d.get('structurePath') or {}).get('confidence') != 'unresolved' for d in ds)
    unresolved = any(a.get('unresolved') for a in event.get('atomEvidence', []))
    return {'verdict': event['verdict'],
            'accepted': sorted(f"{d['kind']}/{d['matchEvidence']['method']}" for d in acc),
            'held': sorted(f"{cards[c]['kind']}/{cards[c]['matchEvidence']['method']}" for c in held),
            'paired': paired(acc) or paired(cards[c] for c in held),
            'inUnresolvedGroup': unresolved or any((cards[c].get('structurePath') or {}).get('confidence') == 'unresolved'
                                                   for c in held | {d['id'] for d in acc})}


def bucket(a, b):
    if a == b:
        return None
    if a['paired'] and not b['paired']:
        return 'confirmed_pairing_lost'
    if b['verdict'] == 'split_attributable' and a['verdict'] != 'split_attributable' or \
            b['inUnresolvedGroup'] and not a['inUnresolvedGroup']:
        return 'split_or_unresolved_gained'
    return 'other'


def cards(result):
    ds = result['differences']
    return {'cards': len(ds), 'unresolvedGroups': len(result['unresolved']), 'status': result['status'],
            'kinds': dict(collections.Counter(d['kind'] for d in ds)),
            'methods': dict(collections.Counter(d['matchEvidence']['method'] for d in ds)),
            'facts': dict(collections.Counter(f for d in ds for f in d.get('facts') or [])),
            'occurrenceCountCards': sum(1 for d in ds if d.get('repeat') and d['oldText'] == d['newText']),
            'categories': dict(collections.Counter(d['category'] for d in ds if 'category' in d))}


def main(inputs, old_dir, new_dir, out):
    os.makedirs(out, exist_ok=True)
    report, summary = {'old': old_dir, 'new': new_dir, 'runs': []}, {}
    with tempfile.TemporaryDirectory() as tmp:
        for case in CASES:
            changes = os.path.join(inputs, 'testdata', 'renewal', case, 'changes.json')
            for engine in ENGINES:
                old, new = load(old_dir, f'{case}-{engine}'), load(new_dir, f'{case}-{engine}')
                (so, eo), (sn, en) = triage(changes, old, tmp), triage(changes, new, tmp)
                rows = []
                for k in eo:
                    a, b = view(eo[k], old), view(en[k], new)
                    kind = bucket(a, b)
                    if kind:
                        rows.append({'id': k, 'block': eo[k]['block'], 'kind': eo[k]['kind'], 'bucket': kind,
                                     'old': a, 'new': b})
                report['runs'].append({'case': case, 'engine': engine,
                                       'verdicts': [so['verdicts'], sn['verdicts']],
                                       'buckets': dict(collections.Counter(r['bucket'] for r in rows)),
                                       'events': rows})
                summary[f'{case}-{engine}'] = {'old': cards(old), 'new': cards(new)}
    with open(os.path.join(out, 'event-diff.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out, 'card-summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    lines = [f'# Per-event effect: {old_dir} -> {new_dir} (triage {TRIAGE.rsplit(os.sep, 1)[1]} with declarations on both)', '',
             '| run | verdicts (old → new) | confirmed pairing lost | split/unresolved gained | other |', '|---|---|---|---|---|']
    for r in report['runs']:
        b = r['buckets']
        lines.append(f"| {r['case'].split('_')[0]} {r['engine']} | {r['verdicts'][0]} → {r['verdicts'][1]} | "
                     f"{b.get('confirmed_pairing_lost', 0)} | {b.get('split_or_unresolved_gained', 0)} | {b.get('other', 0)} |")
    for r in report['runs']:
        lines += ['', f"## {r['case']} {r['engine']}"]
        for e in r['events']:
            o, n = e['old'], e['new']
            lines.append(f"- #{e['id']} {e['block']} ({e['kind']}) [{e['bucket']}]: {o['verdict']} → {n['verdict']}; "
                         f"accepted {o['accepted']} → {n['accepted']}; cards holding the text {o['held']} → {n['held']}"
                         + ('; now in an unresolved group' if n['inUnresolvedGroup'] and not o['inUnresolvedGroup'] else ''))
    with open(os.path.join(out, 'event-diff.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
