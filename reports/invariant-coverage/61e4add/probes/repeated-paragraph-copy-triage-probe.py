"""Codex PR #9 comment 6515226035: an Added (Removed) paragraph repeating existing text is rejected
because another copy exists on the other side. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
P = 'The clause applies to every aircraft.'
for name, kind, l, r in (
        ('Added copy: Replaced card one line -> two copies', 'Added', P, P + ' ' + P),
        ('Removed copy: Replaced card two copies -> one line', 'Removed', P + ' ' + P, P),
        ('control: Added card holding the new copy only', 'AddedCard', P, P + ' ' + P)):
    side_text = P
    ch = t.change(83, 'cl', 'Added' if kind != 'Removed' else 'Removed', P if kind == 'Removed' else '', P if kind != 'Removed' else '', pages=(0, 1) if kind != 'Removed' else (1, 0))
    if kind == 'AddedCard':
        d = t.card('x', 'Added', [], [(1, 'b2', P)])
    else:
        d = t.card('x', 'Replaced', [(1, 'a', l)], [(1, 'b', r)])
    summary, ev = t.run([ch], t.result([d]))
    e = ev['83']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} outcome={e.get("outcome")} unexplained={summary["unexplainedCards"]}')
