# Probes at `786aefc`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `shared-unit-identity-triage-probe.py` | [PR #11 comment 6514897964](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514897964), first finding (Codex, triage, #2's): one source unit holding records 1315 and 1760; only 1760 changes, and the declared identity 1315 is taken from the unchanged record; controls where 1315 changes | triage and test helpers of `9b57000` (`/26`) and `c5a5330` (`/27`) | `triage-probes.log` |

Run as `python3 <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
