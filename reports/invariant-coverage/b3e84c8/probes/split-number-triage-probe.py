"""Codex PR #11 comment 6508515495: contiguous source ranges joined with an invented space ("100 ,000").
Usage: probe.py <dir with tests/ and scripts/>"""
import copy, sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    ch = t.change(63, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **{side: '1315 | Hull | USD 100'})
    whole = t.card('n', kind, **{side: [(1, 'u', '1315 Hull USD 100,000')]})
    split = copy.deepcopy(whole)
    # Two contiguous raw ranges of one unit, split right before the comma: [0, 17) and [17, 21).
    split[side] = [t.loc(side, 1, 'u', '1315 Hull USD 100', 0), t.loc(side, 1, 'u', ',000', 17)]
    control = t.card('n', kind, **{side: [(1, 'u', '1315 Hull USD 100')]})
    for name, x in (('comment 6508515495: USD 100,000 split before the comma', split), ('control: the same text as one location', whole), ('control: USD 100 shown', control)):
        summary, ev = t.run([ch], t.result([x]), [t.table('aircraft', [0], ch)])
        e = ev['63']
        print(f'{kind} {name}: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
