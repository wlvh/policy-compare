# Probes at `f6d0ea0`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `split-fullrow-triage-probe.py` | [PR #11 comment 6517133695](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517133695) (Codex, triage, #2's; [reproduction 6517148134](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517148134)): a Replaced row whose two edits are on two accepted cards that together cite every author cell of one source unit gets `fullRowRecovered` false; a variant without the identity on the second card; controls (one card with the whole row; the second card on another unit) | triage and test helpers of `081f370` (`/32`) | `triage-probes.log` |

Run as `python3 -I <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
