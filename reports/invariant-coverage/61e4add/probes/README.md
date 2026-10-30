# Probes on the joint tree `61e4add`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| [`../../786aefc/probes/shared-unit-identity-triage-probe.py`](../../786aefc/probes/shared-unit-identity-triage-probe.py) | [PR #11 comment 6514897964](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514897964), first part (triage, #2's): one unit holding records 1315 and 1760 | triage and test helpers of `c5a5330` (`/27`) and `61e4add` (`/28`) | `triage-probes.log` |
| `moved-row-opening-triage-probe.py` | [PR #11 comment 6515146325](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515146325) (triage, #2's): a Moved row counted as fully recovered from its 40-character opening plus the identity | the same | `triage-probes.log` |
| `repeated-paragraph-copy-triage-probe.py` | [PR #9 comment 6515226035](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6515226035) (triage, #2's): an added (removed) copy of an existing paragraph on a Replaced card is not located | the same | `triage-probes.log` |
| earlier probes (`ed11a5f/probes/`, `211a705/probes/`, the one-sided unresolved row) | earlier triage findings | `/28` | `triage-probes.log` |

Run each as `python3 <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
