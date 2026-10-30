# Probes on the joint tree `211a705`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `unresolved-over-wrong-rowkey-triage-probe.py` | [PR #11 comment 6514251883](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514251883) B: an Added, Removed or Replaced row card naming `rowKey 9999` for row 1315 and marked `unresolved`; controls with `candidate`, with no row key, and with `rowKey 1315` | triage and test helpers of `9e9104f` (`/24`), `cb27454` (`/25`) and `9b57000` (`/26`) | `triage-probes.log` |
| `unresolved-one-sided-row-triage-probe.py` | [PR #11 comment 6513806516](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513806516): an Added (Removed) row card with no row key, marked `unresolved`; the Replaced path for comparison | the same | `triage-probes.log` |
| `page-number-single-line-probe.mts` | [PR #9 comment 6514411176](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6514411176) (Codex), and A of PR #11 comment 6514251883: the product's `page_number_only` cards for single-page `Page 1` → `Page 2` and `Schedule Page 3 of 10` → `of 11`; control `Draft Page 1` → `Final Page 2` | product of `211a705`; scorer of `cb27454` (`git show cb27454:tests/evaluation/scorer.ts`, relative imports made absolute) and of `211a705` | `page-number-probe.log` |

Run a triage probe as `python3 <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`, and the page probe as `npx tsx <probe> <path of scorer.ts>`.
