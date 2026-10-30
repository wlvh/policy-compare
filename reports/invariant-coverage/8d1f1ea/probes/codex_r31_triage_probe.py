"""Codex r4417511075 (a source range listed twice), r4417560178 (signed Replaced values),
r4417631502 (paragraph attribution on the single-card path), r4417631513 (allocation time).
Usage: probe.py <dir with tests/ and scripts/>"""
import copy, importlib.util, sys, time
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
def show(name, e, summary):
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} fullRowRecovered={(e.get("row") or {}).get("fullRowRecovered")} unexplained={summary["unexplainedCards"]}')
# r4417511075: Added row 1315 | USD 100 | USD 100; the card shows 1315 USD 100 and lists the USD 100 range twice.
ch = t.change(63, 'ac_1315', 'Added', right='1315 | USD 100 | USD 100', pages=(0, 1))
c = t.card('n', 'Added', right=[(1, 'u', '1315'), (1, 'u', 'USD 100')])
dup = copy.deepcopy(c)
dup['right'].append(copy.deepcopy(dup['right'][-1]))
for name, x in (('r4417511075: USD 100 range listed twice', dup), ('control: listed once', c)):
    summary, ev = t.run([ch], t.result([x]), [t.table('aircraft', [0], ch)])
    show(name, ev['63'], summary)
# r4417560178: Replaced row 1315 | Hull | 100 -> 200, edit 100 -> 200; the card shows -100 -> -200.
row = t.change(41, 'ac_1315', 'Replaced', '1315 | Hull | 100', '1315 | Hull | 200', [('100', '200')], pages=(1, 1))
for name, old, new in (('r4417560178: card -100 -> -200', '1315 Hull -100', '1315 Hull -200'), ('control: card 100 -> 200', '1315 Hull 100', '1315 Hull 200'), ('control: hyphen after a letter, Hull-100 -> Hull-200', '1315 Hull-100', '1315 Hull-200')):
    x = t.card('r', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([row], t.result([x]), [t.table('aircraft', [0], row)])
    show(name, ev['41'], summary)
# r4417631502: paragraph event Hull ... USD 100 -> USD 200; the card changes the Liability paragraph on the same page.
para = t.change(7, 'clause_hull', 'Replaced', 'Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.', [('USD 100', 'USD 200')], pages=(1, 1))
for name, old, new in (('r4417631502: card on the Liability paragraph', 'Liability cover is USD 100 per passenger.', 'Liability cover is USD 200 per passenger.'), ('control: card on the Hull paragraph', 'Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.')):
    x = t.card('p', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([para], t.result([x]))
    show(name, ev['7'], summary)
# r4417631513: allocate(['0'] * n, ' '.join(['0'] * (n - 1))) time.
spec = importlib.util.spec_from_file_location('triage', sys.argv[1] + '/scripts/renewal-triage.py')
tri = importlib.util.module_from_spec(spec); spec.loader.exec_module(tri)
for n in (6, 8, 9, 10):
    t0 = time.time(); r = tri.allocate(['0'] * n, ' '.join(['0'] * (n - 1))); dt = time.time() - t0
    print(f'r4417631513: allocate {n} cells "0" over {n - 1} occurrences: {dt:.2f}s, result {"found" if r else "none"}')
    if dt > 4: break
