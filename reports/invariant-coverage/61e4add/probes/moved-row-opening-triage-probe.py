"""Codex PR #11 comment 6515146325: a Moved table row counted as fully recovered from a card holding
only its 40-character opening and the identity cell. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
row = 'Long aircraft model description for the insured aircraft | 1315 | USD 100'
ch = t.change(82, 'ac_1315', 'Moved', row, row, pages=(11, 12))
for name, text in (('Codex: one unit, the first 40 characters plus 1315', 'Long aircraft model description for the 1315'),
                   ('control: one unit, the whole row', 'Long aircraft model description for the insured aircraft 1315 USD 100')):
    d = t.card('m', 'Moved', [(11, 'a', text)], [(12, 'b', text)])
    summary, ev = t.run([ch], t.result([d]), [t.table('aircraft', [1], ch)])
    e = ev['82']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
