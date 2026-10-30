"""Codex PR #11 comment 6508818754: full-row recovery borrows a cell from another record's unit on the same card.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
row = t.change(41, 'ac_1315', 'Replaced', '1315 | Alpha | USD 100', '1315 | Alpha | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
def show(name, card):
    summary, ev = t.run([row], t.result([card]), [t.table('aircraft', [0], row)])
    e = ev['41']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
show('comment 6508818754: unit a 1315 Hull, unit b 1760 Alpha on one card',
     t.card('two', 'Replaced', [(1, 'a', '1315 Hull USD 100'), (1, 'b', '1760 Alpha USD 100')], [(1, 'a', '1315 Hull USD 200'), (1, 'b', '1760 Alpha USD 200')]))
show('control: unit a alone (no Alpha)', t.card('a', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'a', '1315 Hull USD 200')]))
show('control: 1315 Alpha on its own unit', t.card('ok', 'Replaced', [(1, 'a', '1315 Alpha USD 100')], [(1, 'a', '1315 Alpha USD 200')]))
