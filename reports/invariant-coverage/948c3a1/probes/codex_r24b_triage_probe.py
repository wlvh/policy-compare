"""#2's r4415913728 input (identity declared, raw ranges): currency codes swapped beside unchanged
amounts, on renewal-triage/9 (367020b) and /10 (948c3a1). Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
row = t.change(41, 'ac_1315', 'Replaced', 'ATR | 1315 | Hull USD 100', 'ATR | 1315 | Hull USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
L, R = '1315 Hull USD 100; Liability EUR 200.', '1315 Hull EUR 100; Liability USD 200.'
swap = t.raw_card('x', [(1, 'a', L)], [(1, 'b', R)], [
    ('equal', '1315 Hull ', [(1, 'a', '1315 Hull ', 0)], [(1, 'b', '1315 Hull ', 0)]),
    ('delete', 'USD', [(1, 'a', 'USD', 10)], []),
    ('insert', 'EUR', [], [(1, 'b', 'EUR', 10)]),
    ('equal', ' 100; Liability ', [(1, 'a', ' 100; Liability ', 13)], [(1, 'b', ' 100; Liability ', 13)]),
    ('delete', 'EUR', [(1, 'a', 'EUR', 29)], []),
    ('insert', 'USD', [], [(1, 'b', 'USD', 29)]),
    ('equal', ' 200.', [(1, 'a', ' 200.', 32)], [(1, 'b', ' 200.', 32)])])
own = t.card('y', 'Replaced', [(1, 'a', L)], [(1, 'b', '1315 Hull USD 200; Liability EUR 200.')])
for name, cards in (('currency codes swapped (#2 input)', [swap]), ('control: Hull amount changed', [own])):
    _, ev = t.run([row], t.result(cards), [t.table('aircraft', [1], row)])
    print(f'{name}: {ev["41"]["verdict"]} accepted={ev["41"]["acceptedCards"]}')
# My earlier input: the same card without a declared table.
_, ev = t.run([row], t.result([swap]))
print(f'same card, no declared table: {ev["41"]["verdict"]} accepted={ev["41"]["acceptedCards"]}')
