# Probes on the joint tree `9e9104f`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `row-key-one-sided-triage-probe.py` | [PR #11 comment 6513304357](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513304357): an Added (Removed) row card claiming another record's `rowKey`; the Replaced path for comparison | triage and test helpers of `509b088` (`/23`) and `9e9104f` (`/24`) | `triage-and-product-probes.log` |
| `date-token-triage-probe.py` | [PR #11 comment 6513158877](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513158877), triage side: `fact_check()` on partial date numbers | the same | `triage-and-product-probes.log` |
| `date-token-probe.mts` | the same finding, product side: the product's card and its stated fact, graded by the scorer | product of `9e9104f`, scorer of `4a12cd0` (unchanged) | `triage-and-product-probes.log` |
| earlier triage probes | every earlier triage finding | `/23` against `/24` | `earlier-probes-on-24.log` |
