"""Codex PR #11 comment 6512133284: whether two meeting source ranges are one word is decided from the
whole card's text, so a spaced spelling elsewhere on the card splits a number. Usage: probe.py <dir>"""
import copy, sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
TEXT = '1315 Hull USD 100,000; Note 100 ,000'
CUTS = [0, 14, 17, 21, 36]
for kind in ('Added', 'Removed'):
    side = 'right' if kind == 'Added' else 'left'
    ch = t.change(64, 'ac_1315', kind, pages=(0, 1) if kind == 'Added' else (1, 0), **{side: '1315 | Hull | USD 100'})
    whole = t.card('n', kind, **{side: [(1, 'u', TEXT)]})
    split = copy.deepcopy(whole)
    split[side] = [t.loc(side, 1, 'u', TEXT[a:b], a) for a, b in zip(CUTS, CUTS[1:])]
    plain = copy.deepcopy(whole)
    plain[side] = [t.loc(side, 1, 'u', TEXT[a:b], a) for a, b in zip(CUTS, CUTS[1:])]
    for name, x in (('comment 6512133284: split at [0, 14, 17, 21, 36]', split),
                    ('control: the same text as one location', whole)):
        summary, ev = t.run([ch], t.result([x]), [t.table('aircraft', [0], ch)])
        e = ev['64']
        print(f'{kind} {name}: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
    # The same split without the spaced note: comment 6508515495's shape, fixed in /19.
    T2 = '1315 Hull USD 100,000'
    c2 = copy.deepcopy(whole)
    c2[side] = [t.loc(side, 1, 'u', T2[a:b], a) for a, b in ((0, 14), (14, 17), (17, 21))]
    c2['oldText' if side == 'left' else 'newText'] = T2
    summary, ev = t.run([ch], t.result([c2]), [t.table('aircraft', [0], ch)])
    e = ev['64']
    print(f'{kind} control: split at [0, 14, 17, 21] without the note: {e["verdict"]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
