"""Codex PR #11 comment 6516504352 (second finding, triage, #2's): a Moved event without text edits
accepted as split_attributable from two Replaced cards that keep the paragraph on its own page on
both sides and change only a following sentence. Controls: a Removed card on the old page plus an
Added card on the new page; the single Moved card.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
PARA = 'Hull cover applies to all aircraft listed in the schedule.'
moved = t.change(90, 'hull', 'Moved', PARA, PARA, pages=(11, 12))
cases = {
    'Codex: two Replaced cards, the paragraph kept on each page, only "Liability excluded." -> "included." changes': [
        t.card('p11', 'Replaced', [(11, 'a', PARA + ' Liability excluded.')], [(11, 'b', PARA + ' Liability included.')]),
        t.card('p12', 'Replaced', [(12, 'c', PARA + ' Liability excluded.')], [(12, 'd', PARA + ' Liability included.')]),
    ],
    'control: Removed on page 11, Added on page 12': [
        t.card('o', 'Removed', [(11, 'a', PARA)]),
        t.card('n', 'Added', right=[(12, 'b', PARA)]),
    ],
    'control: one Moved card from page 11 to 12': [t.card('m', 'Moved', [(11, 'a', PARA)], [(12, 'b', PARA)])],
}
for name, cards in cases.items():
    summary, ev = t.run([moved], t.result(cards))
    e = ev['90']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
