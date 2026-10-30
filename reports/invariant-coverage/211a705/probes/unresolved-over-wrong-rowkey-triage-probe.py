"""PR #11 comment 6514251883 (B): an unresolved attribution hides an explicit wrong rowKey on a row card.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    ch = t.change(70, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **{side: '1315 | Hull | USD 100'})
    for name, key, conf in (('rowKey 9999, candidate', '9999', 'candidate'), ('rowKey 9999, unresolved', '9999', 'unresolved'),
                            ('control: no rowKey, unresolved', None, 'unresolved'), ('control: rowKey 1315, candidate', '1315', 'candidate')):
        c = t.card('n', kind, **{side: [(1, 'a', '1315 Hull USD 100')]}, row_key=key, confidence=conf)
        summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
        e = ev['70']
        print(f'{kind} {name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
ch = t.change(71, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
for name, key, conf in (('Replaced, rowKey 9999, candidate', '9999', 'candidate'), ('Replaced, rowKey 9999, unresolved', '9999', 'unresolved')):
    c = t.card('r', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')], row_key=key, confidence=conf)
    summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
    e = ev['71']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
