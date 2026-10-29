"""Codex P2 r4415969212 on renewal-triage/8: primaryIdentityOnRecord searched in 80-character previews."""
import sys
sys.path.insert(0, '/home/user/policy-compare/tests')
import test_renewal_triage as t

for name, op in (('long operator name before the MSN', 'Northern Atlantic Regional Aviation Leasing and Operating Company International Limited'),
                 ('control: short operator name', 'Cobalt')):
    old, new = f'{op} | 1315 | USD 100', f'{op} | 1315 | USD 200'
    row = t.change(41, 'ac_1315', 'Replaced', old, new, [('USD 100', 'USD 200')])
    card = t.card('c', 'Replaced', [(1, 'a', old)], [(1, 'b', new)])
    summary, ev = t.run([row], t.result([card]), [t.table('aircraft', [1], row)])
    e = ev['41']
    print(f'{name} (MSN at character {old.index("1315")}): verdict={e["verdict"]} fullRowRecovered={e["row"]["fullRowRecovered"]} '
          f'primaryIdentityOnRecord={e["row"]["primaryIdentityOnRecord"]} acceptedWithoutPrimaryIdentity={summary.get("tableRowEvents", {}).get("acceptedWithoutPrimaryIdentity", summary.get("acceptedWithoutPrimaryIdentity"))}')
