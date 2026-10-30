"""Codex PR #11 comment 6514669354: a Replaced card reporting another edit certifies a pure insertion
(deletion), since only the atom's non-empty side is checked. Usage: probe.py <dir with tests/ and scripts/>"""
import sys
sys.path.insert(0, sys.argv[1] + '/tests')
import test_renewal_triage as t
cases = [
    ('insert, Codex: card "Pay earlier now." -> "Pay later now."', ('', 'later'), 'Pay now.', 'Pay later now.', 'Replaced', 'Pay earlier now.', 'Pay later now.'),
    ('insert, control: card "Pay now." -> "Pay later now."', ('', 'later'), 'Pay now.', 'Pay later now.', 'Replaced', 'Pay now.', 'Pay later now.'),
    ('insert, control: Added card "Pay later now." only', ('', 'later'), 'Pay now.', 'Pay later now.', 'Added', None, 'Pay later now.'),
    ('delete, mirror: card "Pay later now." -> "Pay earlier now."', ('later', ''), 'Pay later now.', 'Pay now.', 'Replaced', 'Pay later now.', 'Pay earlier now.'),
    ('delete, control: card "Pay later now." -> "Pay now."', ('later', ''), 'Pay later now.', 'Pay now.', 'Replaced', 'Pay later now.', 'Pay now.'),
    ('insert, long paragraph: card replaces "all" by "approved"', ('', 'approved'), 'The insurer pays losses.', 'The insurer pays approved losses.', 'Replaced', 'The insurer pays all losses.', 'The insurer pays approved losses.'),
]
for name, edit, l, r, kind, cl, cr in cases:
    c = t.change(24, 'pay', 'Replaced', l, r, [edit])
    d = t.card('x', kind, [(1, 'a', cl)] if cl is not None else [], [(1, 'b', cr)] if cr is not None else [])
    summary, ev = t.run([c], t.result([d]))
    e = ev['24']
    print(f'{name}: {e["verdict"]} accepted={e.get("acceptedCards")} unexplained={summary["unexplainedCards"]}')
