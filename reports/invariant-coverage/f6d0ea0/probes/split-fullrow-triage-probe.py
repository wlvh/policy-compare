"""Codex PR #11 comment 6517133695 (triage, #2's): a Replaced row whose two edits are reported on two
Replaced cards that together cite every author cell of the same source unit gets fullRowRecovered
false. Controls: one card with the whole row; two cards on different units.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
ch = t.change(85, 'ac_1315', 'Replaced', '1315 | Hull | USD 100 | EUR 300', '1315 | Hull | USD 200 | EUR 400',
              [('USD 100', 'USD 200'), ('EUR 300', 'EUR 400')], pages=(1, 1))
def shift(d, by, start=0):
    """Move the card's ranges that start at or after `start` by `by` raw characters inside their unit."""
    def move(l):
        if l['rawRange'][0] >= start:
            l['rawRange'] = [l['rawRange'][0] + by, l['rawRange'][1] + by]
    for side in ('left', 'right'):
        for l in d[side]:
            move(l)
    for op in d['textOps']:
        for side in ('left', 'right'):
            for l in op[side]:
                move(l)
    return d
cases = {
    'Codex: two cards in one unit, "1315 Hull USD 100" -> "... USD 200" and "1315 .. EUR 300" -> "1315 .. EUR 400"': [
        t.card('p', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')]),
        shift(t.card('q', 'Replaced', [(1, 'a', '1315'), (1, 'a', 'EUR 300')], [(1, 'b', '1315'), (1, 'b', 'EUR 400')]), 13, 5)],
    'variant: the second card without the identity, "EUR 300" -> "EUR 400" at its place in the unit': [
        t.card('p', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')]),
        shift(t.card('q', 'Replaced', [(1, 'a', 'EUR 300')], [(1, 'b', 'EUR 400')]), 18)],
    'control: one card with the whole row': [
        t.card('w', 'Replaced', [(1, 'a', '1315 Hull USD 100 EUR 300')], [(1, 'b', '1315 Hull USD 200 EUR 400')])],
    'control: two cards, the second without the identity, on another unit': [
        t.card('p', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull USD 200')]),
        t.card('q', 'Replaced', [(1, 'c', 'EUR 300')], [(1, 'd', 'EUR 400')])],
}
for name, cards in cases.items():
    summary, ev = t.run([ch], t.result(cards), [t.table('aircraft', [0], ch)])
    e = ev['85']
    print(f'{name}: verdict={e["verdict"]} outcome={e.get("outcome")} accepted={e.get("acceptedCards")} atoms={[a["verdict"] for a in e.get("atomEvidence", [])]} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
