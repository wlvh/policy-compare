"""Codex r4416699649 on renewal-triage/12: an occurrence of USD 100 -> USD 200 across two units, the
declared identity 1315 only in the unit the card leaves unchanged. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
row = t.change(42, 'ac_1315', 'Replaced', 'ATR | 1315 | Hull USD 100', 'ATR | 1315 | Hull USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
def two_units(a, b_old, b_new):
    return t.raw_card('x', [(1, 'a', a), (1, 'b', b_old)], [(1, 'c', a), (1, 'd', b_new)], [
        ('equal', a + ' ', [(1, 'a', a, 0)], [(1, 'c', a, 0)]),
        ('delete', '1', [(1, 'b', '1', 0)], []),
        ('insert', '2', [], [(1, 'd', '2', 0)]),
        ('equal', b_old[1:], [(1, 'b', b_old[1:], 1)], [(1, 'd', b_new[1:], 1)])])
for name, card in (('identity only in the unchanged unit ("1315 USD" + "100 1760" -> "200 1760")', two_units('1315 USD', '100 1760', '200 1760')),
                   ('control: identity in the edited unit ("Hull USD" + "100 1760 1315" -> "200 1760 1315")', two_units('Hull USD', '100 1760 1315', '200 1760 1315'))):
    _, ev = t.run([row], t.result([card]), [t.table('aircraft', [1], row)])
    print(f'{name}: {ev["42"]["verdict"]} accepted={ev["42"]["acceptedCards"]}')
