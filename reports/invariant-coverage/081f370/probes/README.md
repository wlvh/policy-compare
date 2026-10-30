# Probes at `081f370`

| Probe or log | Finding | Versions | Log |
|---|---|---|---|
| every probe filed under `reports/invariant-coverage/*/probes/` (44), plus `repeated-atoms-triage-probe.py` | re-check of #2's `/32` (`9e5ec24`) against `/29` (`5888e7d`) | triage and test helpers of `5888e7d` and of `081f370` | `all-probes-triage-29.log`, `all-probes-triage-32.log`, `diff-29-32.txt` |
| `repeated-atoms-triage-probe.py` | [PR #11 comment 6516690587](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516690587) (Codex, triage, #2's; [reproduction 6516705909](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516705909)): two identical replacement edits (`USD 100` → `USD 200` twice) are both met by one edited occurrence; controls (both copies edited; only the second edited) | the same | the same logs |

Run each as `python3 -I <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
