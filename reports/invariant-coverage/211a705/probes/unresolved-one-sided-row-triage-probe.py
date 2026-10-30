"""Codex PR #11 comment 6513806516: an Added (Removed) row accepted as correct from a card whose own
attribution is unresolved. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    ch = t.change(68, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **{side: '1315 | Hull | USD 100'})
    for name, conf in (('comment 6513806516: confidence unresolved', 'unresolved'), ('control: confidence candidate', 'candidate')):
        c = t.card('n', kind, **{side: [(1, 'a', '1315 Hull USD 100')]}, confidence=conf)
        summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
        e = ev['68']
        print(f'{kind} {name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
ch = t.change(69, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
for name, conf in (('Replaced, confidence unresolved', 'unresolved'), ('Replaced, confidence candidate', 'candidate')):
    c = t.card('r', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')], confidence=conf)
    summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
    e = ev['69']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
