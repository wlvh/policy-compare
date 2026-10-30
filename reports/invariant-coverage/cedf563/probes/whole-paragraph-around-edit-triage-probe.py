"""Codex PR #11 comment 6510958743: the author paragraph coexists in the edited unit, around another occurrence.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
para = t.change(7, 'clause_hull', 'Replaced', 'Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.', [('USD 100', 'USD 200')], pages=(1, 1))
def show(name, cards):
    summary, ev = t.run([para], t.result(cards))
    e = ev['7']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
one = t.card('one', 'Replaced', [(1, 'a', 'Hull cover is USD 100 for the aircraft. Liability USD 100')], [(1, 'a', 'Hull cover is USD 100 for the aircraft. Liability USD 999')])
two = t.card('two', 'Replaced', [(1, 'c', 'Hull cover is USD 200 for the aircraft. Liability USD 999')], [(1, 'c', 'Hull cover is USD 200 for the aircraft. Liability USD 200')])
show('comment 6510958743: each card one unit, the Liability amount edited', [one, two])
show('control: Hull paragraph changed on its own card', [t.card('own', 'Replaced', [(1, 'a', 'Hull cover is USD 100 for the aircraft.')], [(1, 'a', 'Hull cover is USD 200 for the aircraft.')])])
