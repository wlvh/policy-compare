"""Codex PR #11 comment 6519610839: an Added (Removed) row 1315 | Hull | USD 100 | USD 100 is full from
one unit `1315 Hull USD 100; 1760 Liability USD 100`, the second USD 100 being 1760's.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    atoms = [a.get('verdict') for a in e.get('atomEvidence') or []]
    print(f'{name}: {e["verdict"]} atoms={atoms} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    pages = (0, 1) if kind == 'Added' else (1, 0)
    row = t.change(63, 'ac_1315', kind, pages=pages, **{side: '1315 | Hull | USD 100 | USD 100'})
    for name, shown in (('Codex: unit "1315 Hull USD 100; 1760 Liability USD 100"', '1315 Hull USD 100; 1760 Liability USD 100'),
                        ('control: unit "1315 Hull USD 100 USD 100"', '1315 Hull USD 100 USD 100'),
                        ('control: unit "1315 Hull USD 100"', '1315 Hull USD 100')):
        c = t.card('n', kind, **{side: [(1, 'u', shown)]})
        summary, ev = t.run([row], t.result([c]), [t.table('aircraft', [0], row)])
        show(f'{kind} {name}', ev['63'], summary)
# The user's variant (PR #9 comment 6519680071): a Replaced row with two Alpha cells, the second taken
# from record 1760 in the same unit; control: both Alpha in 1315's part.
row = t.change(41, 'ac_1315', 'Replaced', '1315 | Alpha | Alpha | USD 100', '1315 | Alpha | Alpha | USD 200', [('USD 100', 'USD 200')])
for name, old, new in (('Replaced, two Alpha, the second in 1760', '1315 Alpha USD 100; 1760 Alpha USD 999', '1315 Alpha USD 200; 1760 Alpha USD 999'),
                       ('Replaced control: both Alpha in 1315', '1315 Alpha Alpha USD 100; 1760 Beta USD 999', '1315 Alpha Alpha USD 200; 1760 Beta USD 999')):
    c = t.card('r', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([row], t.result([c]), [t.table('aircraft', [0], row)])
    show(name, ev['41'], summary)
