"""Shows the T3 edit check is active on real results, not merely silent.

usage: python3 edit-check-probe.py RETRIAGE_DIR CHANGES_JSON RESULT_JSON_GZ > probe.json
1. Counts, over every <set>/<run>.new.events.json.gz, candidate cards by editShown
   (True: the card changes the author fragment; False: holds it unchanged; None: no edit needed)
   and whether the atom accepted them.
2. Re-triages one real result as is and with every Replaced card's text operations replaced by
   one unchanged operation; a working check must stop accepting those cards.
"""
import collections, copy, glob, gzip, json, os, subprocess, sys, tempfile
retriage, changes, result = sys.argv[1:]
script = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'scripts', 'renewal-triage.py')
counts = collections.Counter()
for f in sorted(glob.glob(os.path.join(retriage, '*', '*.new.events.json.gz'))):
    for e in json.load(gzip.open(f)):
        for a in e.get('atomEvidence', []):
            for c in a['candidates']:
                if 'editShown' in c:
                    counts[f"editShown={c['editShown']} accepted={c['card'] in a['accepted']}"] += 1
real = json.load(gzip.open(result))
stripped = copy.deepcopy(real)
for d in stripped['differences']:
    if d['kind'] == 'Replaced':
        d['textOps'] = [{'kind': 'equal', 'text': d['oldText'], 'left': d['left'], 'right': d['right']}]
runs = {}
with tempfile.TemporaryDirectory() as t:
    for name, r in (('as_saved', real), ('replaced_cards_without_edits', stripped)):
        path = os.path.join(t, name + '.json')
        json.dump(r, open(path, 'w'))
        s = json.loads(subprocess.run([sys.executable, script, changes, path], capture_output=True, text=True,
                                      check=True).stdout)
        runs[name] = {k: s[k] for k in ('verdicts', 'acceptedCards', 'unexplainedCards')}
json.dump({'candidateCards': dict(sorted(counts.items())), 'probe': {'result': os.path.basename(result), **runs}},
          sys.stdout, indent=1)
print()
