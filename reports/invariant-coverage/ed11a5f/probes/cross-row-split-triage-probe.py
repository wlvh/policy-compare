"""Scorer finding Codex PR #11 6514810449, triage counterpart: Removed + Added cards from two source
rows sharing one claimed rowKey. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
ch = t.change(80, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
for name, added_row, key in (('Added card from row 1760, both claim 1315', '1760 Hull USD 200', '1315'),
                              ('Added card from row 1760, no row keys', '1760 Hull USD 200', None),
                              ('control: Added card from row 1315, both claim 1315', '1315 Hull USD 200', '1315')):
    out = t.card('o', 'Removed', [(1, 'a', '1315 Hull USD 100')], [], row_key=key)
    inn = t.card('i', 'Added', [], [(1, 'b', added_row)], row_key=key)
    summary, ev = t.run([ch], t.result([out, inn]), [t.table('aircraft', [0], ch)])
    e = ev['80']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
