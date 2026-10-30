"""Codex PR #11 comment 6511895761 (two findings on renewal-triage/21). Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t

# 1. A same-page author move with no text edit, met by a Replaced card that keeps the paragraph where it
#    was and changes only the following sentence.
P = 'Hull cover is USD 100 for the aircraft.'
moved = t.change(50, 'hull', 'Moved', P, P, pages=(1, 1))
def show_move(name, cards):
    summary, ev = t.run([moved], t.result(cards))
    e = ev['50']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
show_move('move, Replaced card changing only "Liability excluded/included"',
          [t.card('r', 'Replaced', [(1, 'a', P + ' Liability excluded.')], [(1, 'a', P + ' Liability included.')])])
show_move('control: a Moved card for the paragraph', [t.card('m', 'Moved', [(1, 'a', P)], [(1, 'b', P)])])
show_move('control: no card', [])

# 2. Split full-row recovery: identity 1315; the Removed and Added cards each hold unit a (record 1315,
#    Hull) and unit b (record 1760, Alpha); the author row is 1315 | Alpha.
row = t.change(51, 'ac_1315', 'Replaced', '1315 | Alpha | USD 100', '1315 | Alpha | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
def show_row(name, cards):
    summary, ev = t.run([row], t.result(cards), [t.table('aircraft', [0], row)])
    e = ev['51']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
show_row('split, each card with units 1315 Hull and 1760 Alpha',
         [t.card('g', 'Removed', [(1, 'a', '1315 Hull USD 100'), (1, 'b', '1760 Alpha USD 100')], []),
          t.card('c', 'Added', [], [(1, 'a', '1315 Hull USD 200'), (1, 'b', '1760 Alpha USD 200')])])
show_row('control: the same units on one Replaced card (comment 6508818754)',
         [t.card('r', 'Replaced', [(1, 'a', '1315 Hull USD 100'), (1, 'b', '1760 Alpha USD 100')],
                 [(1, 'a', '1315 Hull USD 200'), (1, 'b', '1760 Alpha USD 200')])])
show_row('control: split, 1315 Alpha in its own unit',
         [t.card('g', 'Removed', [(1, 'a', '1315 Alpha USD 100')], []), t.card('c', 'Added', [], [(1, 'a', '1315 Alpha USD 200')])])
