"""Codex PR #11 comment 6514897964 (triage part): one source unit holding two records lets the
unchanged record supply the identity of the other's edit. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
ch = t.change(81, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
for name, l, r in (
        ('Codex: 1760 changes in the unit, 1315 unchanged', '1315 Hull USD 100; 1760 Liability USD 100', '1315 Hull USD 100; 1760 Liability USD 200'),
        ('control: 1315 changes in the shared unit', '1315 Hull USD 100; 1760 Liability USD 100', '1315 Hull USD 200; 1760 Liability USD 100'),
        ('control: 1315 alone in its unit', '1315 Hull USD 100', '1315 Hull USD 200')):
    d = t.card('x', 'Replaced', [(1, 'a', l)], [(1, 'b', r)])
    summary, ev = t.run([ch], t.result([d]), [t.table('aircraft', [0], ch)])
    e = ev['81']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
