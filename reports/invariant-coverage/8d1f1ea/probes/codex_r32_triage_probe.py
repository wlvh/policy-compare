"""Codex PR #11 comment 6507993515: paragraph context taken from an unchanged unit for another unit's edit
(split-card path). Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
para = t.change(7, 'clause_hull', 'Replaced', 'Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.', [('USD 100', 'USD 200')], pages=(1, 1))
def show(name, cards):
    summary, ev = t.run([para], t.result(cards))
    e = ev['7']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
# Card 1 keeps the Hull USD-100 paragraph with a trailing USD unchanged and changes 100 Liability -> 999 Liability;
# card 2 keeps the Hull USD-200 paragraph with a trailing USD unchanged and changes 999 Liability -> 200 Liability.
one = t.card('one', 'Replaced', [(1, 'a', 'Hull cover is USD 100 for the aircraft. USD'), (1, 'b', '100 Liability')],
             [(1, 'a', 'Hull cover is USD 100 for the aircraft. USD'), (1, 'b', '999 Liability')])
two = t.card('two', 'Replaced', [(1, 'c', 'Hull cover is USD 200 for the aircraft. USD'), (1, 'd', '999 Liability')],
             [(1, 'c', 'Hull cover is USD 200 for the aircraft. USD'), (1, 'd', '200 Liability')])
show('comment 6507993515: two cards editing only the Liability units', [one, two])
own = t.card('own', 'Replaced', [(1, 'a', 'Hull cover is USD 100 for the aircraft.')], [(1, 'a', 'Hull cover is USD 200 for the aircraft.')])
show('control: the Hull paragraph changed on its own card', [own])
