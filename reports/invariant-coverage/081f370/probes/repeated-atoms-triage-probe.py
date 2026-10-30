"""Codex PR #11 comment 6516690587 (triage, #2's): an author event with two identical replacement
edits (USD 100 -> USD 200 twice) counts one edited occurrence for both. Controls: both copies edited;
neither edited.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
ch = t.change(84, 'ac_1315', 'Replaced', '1315 | Hull | USD 100 | USD 100', '1315 | Hull | USD 200 | USD 200',
              [('USD 100', 'USD 200'), ('USD 100', 'USD 200')], pages=(1, 1))
for name, l, r in (
        ('Codex: only the first copy edited', '1315 Hull USD 100 USD 100', '1315 Hull USD 200 USD 100'),
        ('control: both copies edited', '1315 Hull USD 100 USD 100', '1315 Hull USD 200 USD 200'),
        ('control: only the second copy edited', '1315 Hull USD 100 USD 100', '1315 Hull USD 100 USD 200')):
    d = t.card('x', 'Replaced', [(1, 'a', l)], [(1, 'b', r)])
    summary, ev = t.run([ch], t.result([d]), [t.table('aircraft', [0], ch)])
    e = ev['84']
    atoms = [a['verdict'] for a in e.get('atomEvidence', [])]
    print(f'{name}: verdict={e["verdict"]} outcome={e.get("outcome")} atoms={atoms} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
