# Probes at `48a5887`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `currency-sign-triage-probe.py` | [PR #11 comment 6516032862](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516032862) (triage, #2's): `signed()` and `whole()` read a sign right after a currency code as no sign, so the author's unsigned `100` is found in `USD−100`; the same inputs as the triage tests r4417384098 and r4417560178, with the sign written after `USD`; controls `USD 100`, `-100` and `Hull-100` | triage and test helpers of `5888e7d` (`/29`) | `triage-probes.log` |
| `following-record-identity-triage-probe.py` | [PR #11 comment 6515923611](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515923611) (Codex, triage, #2's; [reproduction 6515988454](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515988454)): within one unit, the edited amount of record 1760 borrows the identifier of record 1315, which follows it across punctuation only; two controls | the same | `triage-probes.log` |
| `declared-fragment-*.log` | the scorer's neighbouring case, checked while fixing [PR #11 comment 6516045905](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516045905): the case declares the agreed value's change, and a card cites only the changed character (`1` → `2`, `-` → `+`), as one Replaced card or a delete + add pair; whole-cell controls | the scorer of `9ff5ea1` and `48a5887` (a temporary test, not committed) | `declared-fragment-9ff5ea1.log`, `declared-fragment-48a5887.log` |

Run each Python probe as `python3 <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
