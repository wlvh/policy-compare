"""Codex r4416863588 (row cell matched inside a longer amount) and r4416863597 (repeated author-row
cells satisfied by one occurrence) on renewal-triage/13. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def row(kind, text):
    side = {'right': text} if kind == 'Added' else {'left': text}
    return t.change(63, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **side)
cases = [
    ('Added', '1315 | Hull | USD 100', '1315 Hull USD 100,000', 'r4416863588: amount cell inside a longer amount'),
    ('Removed', '1315 | Hull | USD 100', '1315 Hull USD 100,000', 'r4416863588: the same, Removed'),
    ('Added', '1315 | Hull | USD 100', '1315 Hull USD 100', 'control: the whole row'),
    ('Added', '1315 | USD 100 | USD 100', '1315 USD 100', 'r4416863597: two equal amount cells, one shown'),
    ('Added', '1315 | USD 100 | USD 100', '1315 USD 100 USD 100', 'control: both shown'),
]
for kind, author, shown, name in cases:
    ch = row(kind, author)
    c = t.card('n', kind, **({'right': [(1, 'u', shown)]} if kind == 'Added' else {'left': [(1, 'u', shown)]}))
    summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
    e = ev['63']
    print(f'{name}: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
