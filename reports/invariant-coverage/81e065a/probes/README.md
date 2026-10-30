# Probes at `81e065a`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `moved-split-triage-probe.py` | [PR #11 comment 6516504352](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516504352), second finding (Codex, triage, #2's; [reproduction 6516540351](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516540351)): a Moved event without text edits is `split_attributable` from two Replaced cards that keep the paragraph on its own page on both sides and change only a following sentence; controls (Removed + Added on the two pages, one Moved card) | triage and test helpers of `5888e7d` (`/29`) | `triage-probes.log` |

Run as `python3 <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
