"""Codex r4417192877 (overlapping author-row cells USD 100 and 100 found in one "USD 100").
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def row(kind, text):
    side = {'right': text} if kind == 'Added' else {'left': text}
    return t.change(63, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **side)
for kind in ('Added', 'Removed'):
    for shown, name in (('1315 USD 100', 'r4417192877: one USD 100 for the cells USD 100 and 100'), ('1315 USD 100 100', 'control: both shown')):
        ch = row(kind, '1315 | USD 100 | 100')
        c = t.card('n', kind, **({'right': [(1, 'u', shown)]} if kind == 'Added' else {'left': [(1, 'u', shown)]}))
        summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
        e = ev['63']
        print(f'{kind} {name}: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
