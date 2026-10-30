"""Codex PR #11 comment 6518043799: an Added (Removed) author row is accepted cell by cell from any
unit that holds the declared identity, without the occurrence-level linkage replacements get from
linked(). Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    atoms = [a.get('verdict') for a in e.get('atomEvidence') or []]
    print(f'{name}: {e["verdict"]} atoms={atoms} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    pages = (0, 1) if kind == 'Added' else (1, 0)
    row = t.change(63, 'ac_1315', kind, pages=pages, **{side: '1315 | Hull | USD 100'})
    other = t.change(64, 'ac_1760', kind, pages=pages, **{side: '1760 | Liability | USD 300'})
    cases = (
        ('Codex: one unit "1315 Hull; 1760 Liability USD 100", 1760 not a declared event', [row], '1315 Hull; 1760 Liability USD 100', [t.table('aircraft', [0], row)]),
        ('control: 1760 declared in the same table (another event)', [row, other], '1315 Hull; 1760 Liability USD 100', [t.table('aircraft', [0], row, other)]),
        ('control: unit "1315 Hull USD 100"', [row], '1315 Hull USD 100', [t.table('aircraft', [0], row)]),
        ('control: unit "1315 Hull USD 100; 1760 Liability"', [row], '1315 Hull USD 100; 1760 Liability', [t.table('aircraft', [0], row)]),
    )
    for name, changes, shown, tables in cases:
        c = t.card('n', kind, **({side: [(1, 'u', shown)]}))
        summary, ev = t.run(changes, t.result([c]), tables)
        show(f'{kind} {name}', ev['63'], summary)
