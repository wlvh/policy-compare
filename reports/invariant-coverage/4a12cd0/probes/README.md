# Probes on `4a12cd0`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `date-token-probe.mts` | [PR #11 comment 6513158877](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513158877): `dates_rolled_forward_one_year` with a partial year (`20240`), day (`121`) or a decimal tail (`2024.5`); control: two whole dates | product of `509b088`; scorers of `1344e17` and `4a12cd0` | `date-token-probes.log` |
| `date-token-triage-probe.py` | the same texts through the triage's `fact_check()` | triage `/23` | `date-token-probes.log` |

The date probe takes the scorer's path as its first argument; the older scorer is `git show 1344e17:tests/evaluation/scorer.ts` with its import pointed at this tree's `packages/contracts/index`. The triage probe takes a directory holding `scripts/renewal-triage.py`.
