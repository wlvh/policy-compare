"""Codex P2 r4416398168 on renewal-triage/9: a pure insertion (deletion) in a short paragraph,
reported exactly on one card, against the 10-character context minimum of in_context()."""
import sys
sys.path.insert(0, '/home/user/policy-compare/tests')
import test_renewal_triage as t

for name, (a, b, edit) in {
    'short insertion "" -> "later" (Pay now. -> Pay later now.)': ('Pay now.', 'Pay later now.', ('', 'later')),
    'short deletion "later" -> ""': ('Pay later now.', 'Pay now.', ('later', '')),
    'control: short replacement "now" -> "later"': ('Pay now.', 'Pay later.', ('now', 'later')),
    'control: long insertion "" -> "approved"': ('The insurer pays losses.', 'The insurer pays approved losses.', ('', 'approved')),
}.items():
    ev_in = t.change(5, 'clause_5', 'Replaced', a, b, [edit])
    card = t.card('c', 'Replaced', [(1, 'a', a)], [(1, 'b', b)])
    summary, ev = t.run([ev_in], t.result([card]))
    e = ev['5']
    print(f'{name}: {e["verdict"]} accepted={e["acceptedCards"]} unexplained={summary["unexplainedCards"]}')
