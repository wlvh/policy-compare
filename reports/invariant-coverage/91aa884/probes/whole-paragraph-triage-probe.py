"""Codex PR #11 comment 6509794672: a whole-paragraph edit; exact Removed/Added cards rejected by the context check.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
para = t.change(7, 'clause_pay', 'Replaced', 'Pay now.', 'Pay later.', [('Pay now.', 'Pay later.')], pages=(1, 1))
def show(name, cards):
    summary, ev = t.run([para], t.result(cards))
    e = ev['7']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
show('comment 6509794672: exact Removed + Added cards', [t.card('g', 'Removed', [(1, 'a', 'Pay now.')], []), t.card('c', 'Added', [], [(1, 'b', 'Pay later.')])])
show('control: one Replaced card', [t.card('r', 'Replaced', [(1, 'a', 'Pay now.')], [(1, 'a', 'Pay later.')])])
longer = t.change(8, 'clause_pay2', 'Replaced', 'Premium: Pay now.', 'Premium: Pay later.', [('Pay now.', 'Pay later.')], pages=(1, 1))
summary, ev = t.run([longer], t.result([t.card('g', 'Removed', [(1, 'a', 'Premium: Pay now.')], []), t.card('c', 'Added', [], [(1, 'b', 'Premium: Pay later.')])]))
print(f'control: the edit inside a longer paragraph, Removed + Added: {ev["8"]["verdict"]} accepted={ev["8"].get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
