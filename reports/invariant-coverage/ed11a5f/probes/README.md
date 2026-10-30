# Probes at `ed11a5f`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `replaced-card-other-edit-triage-probe.py` | [PR #11 comment 6514669354](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514669354) (Codex, triage, #2's): a Replaced card that replaces another word (`Pay earlier now.` → `Pay later now.`) certifies the author's pure insertion `Pay now.` → `Pay later now.`; the deletion mirror and a longer paragraph; controls (the exact Replaced card, an Added card) | triage and test helpers of `9b57000` (`/26`, the triage in `3527ab2` and `565480c`) | `triage-probes.log` |
| `cross-row-split-triage-probe.py` | the triage counterpart of [PR #11 comment 6514810449](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514810449) (Codex, scorer): Removed + Added cards from two source rows sharing one claimed `rowKey`; control from one row | the same | `triage-probes.log` |

Run each as `python3 <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
