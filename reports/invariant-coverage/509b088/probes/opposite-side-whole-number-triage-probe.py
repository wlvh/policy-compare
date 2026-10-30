"""Codex PR #9 comment 6512254699: an Added (Removed) paragraph counted as kept on the other side by a
plain substring search. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
for kind in ('Added', 'Removed'):
    side, other = ('right', 'left') if kind == 'Added' else ('left', 'right')
    ch = t.change(65, 'limit', kind, **{side: 'Limit USD 100'})
    def show(name, kept, shown):
        cells = {other: [(1, 'a', kept)], side: [(1, 'b', shown)]}
        summary, ev = t.run([ch], t.result([t.card('r', 'Replaced', cells['left'], cells['right'])]))
        e = ev['65']
        print(f'{kind} {name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
    show('comment 6512254699: keeps "Limit USD 1000", shows it plus "Limit USD 100"', 'Limit USD 1000', 'Limit USD 1000 Limit USD 100')
    show('control: the paragraph itself kept on the other side', 'Limit USD 100', 'Limit USD 100 Limit USD 100')
