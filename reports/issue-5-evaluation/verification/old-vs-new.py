"""Run the synthetic counterexamples through the triage at 85dae98 and at the working tree.

Usage (repository root): python3 reports/issue-5-evaluation/verification/old-vs-new.py
Shows the legacy fields (outcome, atoms) of the old script next to the new verdict.
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tests'))
import test_renewal_triage as T  # noqa: E402


def both(name, changes, res, old):
    with tempfile.TemporaryDirectory() as d:
        cp, rp = os.path.join(d, 'c.json'), os.path.join(d, 'r.json')
        json.dump({'changes': changes}, open(cp, 'w'))
        json.dump(res, open(rp, 'w'))
        row = {}
        for tag, script in (('old', old), ('new', T.SCRIPT)):
            ep = os.path.join(d, tag + '.json')
            subprocess.run([sys.executable, script, cp, rp, '--events', ep], check=True, capture_output=True)
            row[tag] = [(e['id'], e['outcome'], e.get('verdict', '-'), e['atoms'])
                        for e in json.load(open(ep)) if e.get('scope', 'body') == 'body']
    print(f'{name}\n  old (85dae98): {row["old"]}\n  new:           {row["new"]}')


with tempfile.TemporaryDirectory() as d:
    old = os.path.join(d, 'old_triage.py')
    with open(old, 'w') as f:
        f.write(subprocess.check_output(['git', 'show', '85dae98:scripts/renewal-triage.py'], cwd=ROOT, text=True))
    ev52 = T.change(52, 'ac_1315', 'Replaced', *T.ROW_1315, T.VALUE, pages=(11, 11))
    both('correct value on the wrong record (rowKey 1760)', [ev52],
         T.result([T.row_card('k', '1760', 'ZK-ENV', row_key='1760')]), old)
    both('one correct card plus one misattributed card', [ev52],
         T.result([T.row_card('g', '1315', 'CS-BTE', row_key='1315'),
                   T.row_card('x', '1760', 'ZK-ENV', row_key='1760')]), old)
    both('added row cells scattered over two records', [T.AddedRemovedRows.ADDED],
         T.result([T.card('i', 'Added', right=[(11, 'u1', '55228'), (11, 'u1', 'VH-JXP')]),
                   T.card('o', 'Added', right=[(11, 'u2', 'Airbus A220'), (11, 'u2', '39,000,000')])]), old)
    g = T.group(left=[(3, 'g1', 'Repossession Expenses: USD 5,000,000 any one Aircraft.')])
    g['right'] = [T.loc('right', 9, 'g2', 'USD 7,500,000')]
    both('unresolved group holds only the left side on the event page', [T.SidesAndSplits.PARA],
         T.result([], [g]), old)
    c = T.change(1, 'wl_x', 'Replaced', '15.0% | 03/10/2024 | MKV 1426 | 24AV0381',
                 '15.0% | 03/10/2024 | MKV 1426 | 25AV0412', [('24AV0381', '25AV0412')], pages=(8, 8))
    both('unchanged percentage and date cells taken as identity; card is another writer row', [c],
         T.result([T.card('w', 'Replaced', [(8, 'a', '15.0% 03/10/2024 HPX 0624 24AV0381')],
                          [(8, 'b', '15.0% 03/10/2024 HPX 0624 25AV0412')])]), old)
