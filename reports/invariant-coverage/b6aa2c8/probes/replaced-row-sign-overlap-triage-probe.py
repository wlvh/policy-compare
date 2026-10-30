"""Codex r4417329496 (Replaced-row multiplicity), r4417384098 (sign before a bare number cell),
r4417384107 (overlapping candidates in cell allocation). Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    print(f'{name}: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
# r4417329496: a Replaced row with two equal amount cells, the card showing one of them.
row = t.change(41, 'ac_1315', 'Replaced', '1315 | USD 100 | USD 100 | Alpha', '1315 | USD 200 | USD 200 | Alpha',
               [('USD 100', 'USD 200'), ('USD 100', 'USD 200')], pages=(1, 1))
for name, old, new in (('r4417329496: one of two equal amount cells shown', '1315 USD 100 Alpha', '1315 USD 200 Alpha'),
                       ('control: both shown', '1315 USD 100 USD 100 Alpha', '1315 USD 200 USD 200 Alpha')):
    c = t.card('r', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([row], t.result([c]), [t.table('aircraft', [0], row)])
    show(name, ev['41'], summary)
# r4417384098: an Added row with a bare number cell 100, the card showing -100.
for kind in ('Added', 'Removed'):
    side = {'right': '1315 | Hull | 100'} if kind == 'Added' else {'left': '1315 | Hull | 100'}
    ch = t.change(63, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **side)
    for name, shown in (('r4417384098: card shows -100', '1315 Hull -100'), ('control: card shows 100', '1315 Hull 100')):
        c = t.card('n', kind, **({'right': [(1, 'u', shown)]} if kind == 'Added' else {'left': [(1, 'u', shown)]}))
        summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
        show(f'{kind} {name}', ev['63'], summary)
# r4417384107: cells A, A B, B B over an exact card 1315 A A B B B.
for kind in ('Added', 'Removed'):
    side = {'right': '1315 | A | A B | B B'} if kind == 'Added' else {'left': '1315 | A | A B | B B'}
    ch = t.change(63, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **side)
    shown = '1315 A A B B B'
    c = t.card('n', kind, **({'right': [(1, 'u', shown)]} if kind == 'Added' else {'left': [(1, 'u', shown)]}))
    summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
    show(f'{kind} r4417384107: exact card 1315 A A B B B', ev['63'], summary)
