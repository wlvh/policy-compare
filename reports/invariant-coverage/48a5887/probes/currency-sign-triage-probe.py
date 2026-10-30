"""The triage counterpart of Codex PR #11 comment 6515830550 (scorer, fixed in ea444a0): a sign right
after a currency code. The test r4417560178 (100 -> 200 is not -100 -> -200) and r4417384098
(100 is not found in -100), with the sign written right after a currency code.
Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
c = t.change(72, 'ac_1315', 'Replaced', '1315 | Hull | 100', '1315 | Hull | 200', [('100', '200')], pages=(11, 11))
for name, old, new in (
        ('r4417560178 as written: -100 -> -200', '1315 Hull -100', '1315 Hull -200'),
        ('after a currency code: USD-100 -> USD-200', '1315 Hull USD-100', '1315 Hull USD-200'),
        ('after a currency code: USD−100 -> USD−200', '1315 Hull USD−100', '1315 Hull USD−200'),
        ('control: USD 100 -> USD 200', '1315 Hull USD 100', '1315 Hull USD 200'),
        ('control: Hull-100 -> Hull-200 (no sign)', '1315 Hull-100', '1315 Hull-200')):
    d = t.card('s', 'Replaced', [(11, 'a', old)], [(11, 'b', new)])
    _, ev = t.run([c], t.result([d]), [t.table('aircraft', [0], c)])
    print(f'Replaced, author 100 -> 200; card {name}: {ev["72"]["verdict"]}')
a = t.change(68, 'ac_1315', 'Added', right='1315 | Hull | 100', pages=(0, 11))
for name, text in (('r4417384098 as written: -100', '1315 Hull -100'), ('after a currency code: USD−100', '1315 Hull USD−100'),
                   ('control: USD 100', '1315 Hull USD 100')):
    _, ev = t.run([a], t.result([t.card('x', 'Added', right=[(11, 'u1', text)])]), [t.table('aircraft', [0], a)])
    print(f'Added, author 100; card {name}: {ev["68"]["verdict"]} fullRowRecovered={ev["68"]["row"]["fullRowRecovered"]}')
r = t.change(69, 'ac_1315', 'Removed', left='1315 | Hull | 100', pages=(11, 0))
for name, text in (('r4417384098 shape, Removed: -100', '1315 Hull -100'), ('after a currency code: USD−100', '1315 Hull USD−100'),
                   ('control: USD 100', '1315 Hull USD 100')):
    _, ev = t.run([r], t.result([t.card('x', 'Removed', left=[(11, 'u1', text)])]), [t.table('aircraft', [0], r)])
    print(f'Removed, author 100; card {name}: {ev["69"]["verdict"]} fullRowRecovered={ev["69"]["row"]["fullRowRecovered"]}')
u = t.change(73, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('100', '200')], pages=(11, 11))
for name, old, new in (('USD-100 -> USD-200', '1315 Hull USD-100', '1315 Hull USD-200'), ('USD−100 -> USD−200', '1315 Hull USD−100', '1315 Hull USD−200'),
                       ('control: USD 100 -> USD 200', '1315 Hull USD 100', '1315 Hull USD 200'), ('control: -100 -> -200', '1315 Hull -100', '1315 Hull -200')):
    d = t.card('s', 'Replaced', [(11, 'a', old)], [(11, 'b', new)])
    _, ev = t.run([u], t.result([d]), [t.table('aircraft', [0], u)])
    print(f'Replaced, author USD 100 -> USD 200; card {name}: {ev["73"]["verdict"]} fullRowRecovered={(ev["73"].get("row") or {}).get("fullRowRecovered")}')
