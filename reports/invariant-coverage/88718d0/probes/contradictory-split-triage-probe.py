"""Codex PR #11 comment 6519547955: a paragraph edit USD 100 -> USD 200 accepted as a split from two
Replaced cards that report 100 -> 300 and 400 -> 200 in the same paragraph.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    print(f'{name}: verdict={e["verdict"]} outcome={e.get("outcome")} accepted={sorted(e.get("acceptedCards") or [])} unexplained={summary["unexplainedCards"]}')
old, new = 'Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.'
ch = t.change(7, 'para', 'Replaced', old, new, [('USD 100', 'USD 200')])
for name, cards in (
        ('Codex: 100 -> 300 and 400 -> 200', [t.card('a', 'Replaced', [(1, 'p', old)], [(1, 'q', 'Hull cover is USD 300 for the aircraft.')]),
                                            t.card('b', 'Replaced', [(1, 'r', 'Hull cover is USD 400 for the aircraft.')], [(1, 's', new)])]),
        ('control: Removed old + Added new', [t.card('a', 'Removed', [(1, 'p', old)]), t.card('b', 'Added', right=[(1, 's', new)])]),
        ('control: one Replaced card 100 -> 200', [t.card('a', 'Replaced', [(1, 'p', old)], [(1, 's', new)])])):
    summary, ev = t.run([ch], t.result(cards))
    show(name, ev['7'], summary)
