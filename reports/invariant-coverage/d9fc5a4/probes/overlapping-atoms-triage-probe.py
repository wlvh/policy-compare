"""Codex PR #11 comment 6518372639: two differently worded edits of one row that overlap in text
(`USD 100 -> USD 200` and `100 -> 200`) are both met by one edited occurrence.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    atoms = [a.get('verdict') for a in e.get('atomEvidence') or []]
    print(f'{name}: verdict={e["verdict"]} outcome={e.get("outcome")} atoms={atoms} '
          f'fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
row = t.change(41, 'ac_1315', 'Replaced', '1315 | Hull | USD 100 | 100', '1315 | Hull | USD 200 | 200',
               [('USD 100', 'USD 200'), ('100', '200')])
for name, old, new in (
        ('Codex: only "USD 100" edited', '1315 Hull USD 100 100', '1315 Hull USD 200 100'),
        ('variant: only the bare "100" edited', '1315 Hull USD 100 100', '1315 Hull USD 100 200'),
        ('control: both edited', '1315 Hull USD 100 100', '1315 Hull USD 200 200')):
    c = t.card('r', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([row], t.result([c]), [t.table('aircraft', [0], row)])
    show(name, ev['41'], summary)
