"""Codex PR #11 comment 6513304357: an Added (Removed) row accepted although the card claims another
record's rowKey. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    ch = t.change(66, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **{side: '1315 | Hull | USD 100'})
    for name, key in (('comment 6513304357: card claims rowKey 1760', '1760'), ('control: card claims rowKey 1315', '1315'), ('control: no rowKey', None)):
        c = t.card('n', kind, **{side: [(1, 'a', '1315 Hull USD 100')]}, row_key=key)
        summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
        e = ev['66']
        print(f'{kind} {name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
# The Replaced path, for comparison: judge_identity() checks the claimed rowKey.
ch = t.change(67, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')], pages=(1, 1))
for name, key in (('Replaced, card claims rowKey 1760', '1760'), ('Replaced, card claims rowKey 1315', '1315')):
    c = t.card('r', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')], row_key=key)
    summary, ev = t.run([ch], t.result([c]), [t.table('aircraft', [0], ch)])
    e = ev['67']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
