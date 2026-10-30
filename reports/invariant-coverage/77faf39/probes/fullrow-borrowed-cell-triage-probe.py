"""Codex PR #11 comment 6519018610: a replaced row's full-row check takes a cell ("Alpha") from
another record (1760) in the same identity-confirmed unit.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    atoms = [a.get('verdict') for a in e.get('atomEvidence') or []]
    print(f'{name}: verdict={e["verdict"]} outcome={e.get("outcome")} atoms={atoms} '
          f'fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} '
          f'unexplained={summary["unexplainedCards"]}')
row = t.change(41, 'ac_1315', 'Replaced', '1315 | Alpha | USD 100', '1315 | Alpha | USD 200', [('USD 100', 'USD 200')])
for name, old, new in (
        ('Codex: "Alpha" only in record 1760', '1315 USD 100; 1760 Alpha USD 999', '1315 USD 200; 1760 Alpha USD 999'),
        ('control: "Alpha" in record 1315', '1315 Alpha USD 100; 1760 Beta USD 999', '1315 Alpha USD 200; 1760 Beta USD 999'),
        ('control: no "Alpha" at all', '1315 USD 100', '1315 USD 200')):
    c = t.card('r', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([row], t.result([c]), [t.table('aircraft', [0], row)])
    show(name, ev['41'], summary)
