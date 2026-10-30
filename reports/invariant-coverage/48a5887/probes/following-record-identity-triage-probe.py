"""Codex PR #11 comment 6515923611: within one unit, the edited amount of record 1760 is followed
by record 1315's identifier across punctuation only, and 1315's identity is borrowed for it.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
ch = t.change(84, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
for name, l, r in (
        ('Codex: 1760 first, its amount changes; 1315 follows unchanged', '1760 Liability USD 100; 1315 Hull USD 100', '1760 Liability USD 200; 1315 Hull USD 100'),
        ('control: 1315 first and changes', '1315 Hull USD 100; 1760 Liability USD 100', '1315 Hull USD 200; 1760 Liability USD 100'),
        ('control: 1760 first, 1315 (second) changes', '1760 Liability USD 100; 1315 Hull USD 100', '1760 Liability USD 100; 1315 Hull USD 200')):
    d = t.card('x', 'Replaced', [(1, 'a', l)], [(1, 'b', r)])
    summary, ev = t.run([ch], t.result([d]), [t.table('aircraft', [0], ch)])
    e = ev['84']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
