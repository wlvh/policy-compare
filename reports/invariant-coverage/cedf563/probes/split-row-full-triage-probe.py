"""Codex PR #11 comment 6511266424: full-row recovery on a correct Removed + Added pair. Usage: probe.py <dir>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
row = t.change(41, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
def show(name, cards):
    summary, ev = t.run([row], t.result(cards), [t.table('aircraft', [0], row)])
    e = ev['41']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
show('comment 6511266424: complete Removed + Added cards', [t.card('g', 'Removed', [(1, 'a', '1315 Hull USD 100')], []), t.card('c', 'Added', [], [(1, 'b', '1315 Hull USD 200')])])
show('control: one complete Replaced card', [t.card('r', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'a', '1315 Hull USD 200')])])
show('control: Removed + Added, the Added card missing Hull', [t.card('g', 'Removed', [(1, 'a', '1315 Hull USD 100')], []), t.card('c', 'Added', [], [(1, 'b', '1315 USD 200')])])
