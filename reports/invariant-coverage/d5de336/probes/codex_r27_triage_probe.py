"""Codex r4416771397 (split-card path) and r4416771405 (single-character cells) on renewal-triage/13.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
# r4416771397: two Replaced cards, each changing only a currency code beside an unchanged amount.
row = t.change(41, 'ac_1315', 'Replaced', 'ATR | 1315 | Hull USD 100', 'ATR | 1315 | Hull USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
hull = t.card('h', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull EUR 100')])
liab = t.card('l', 'Replaced', [(1, 'c', '1315 Liability EUR 200')], [(1, 'd', '1315 Liability USD 200')])
own = t.card('y', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')])
for name, cards in (('two currency-only cards (split path)', [hull, liab]), ('control: the Hull amount changed on one card', [own])):
    summary, ev = t.run([row], t.result(cards), [t.table('aircraft', [1], row)])
    e = ev['41']
    print(f'{name}: {e["verdict"]} accepted={e["acceptedCards"]} unexplained={summary["unexplainedCards"]}')
# r4416771405: an Added row with a one-character cell, the card missing that cell.
added = t.change(63, 'ac_1315', 'Added', right='1315 | A | USD 100', pages=(0, 1))
for name, text in (('card without the "A" cell', '1315 USD 100'), ('control: card with every cell', '1315 A USD 100')):
    c = t.card('n', 'Added', right=[(1, 'u', text)])
    summary, ev = t.run([added], t.result([c]), [t.table('aircraft', [0], added)])
    e = ev['63']
    print(f'{name}: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} atoms={e.get("atoms")}')
