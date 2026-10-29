# Probes on the joint tree `9ed97f2`

Each probe grades the product's own output (`compare()` of the joint tree, unless stated) with a given scorer. An older scorer is `git show <sha>:tests/evaluation/scorer.ts`, with its imports pointed at this tree's `packages/`; the probe takes its path as the first argument.

| Probe | Finding | Scorers | Log |
|---|---|---|---|
| `joined-words-probe.mts` | [r4416878298](https://github.com/wlvh/policy-compare/pull/9#discussion_r4416878298): four `REPEATED HEADER LIMIT: USD 1000`, the third `USD1000` | `f0173ed`, `9ed97f2` | `joined-words-probe.log` |
| `duplicate-occurrence-probe.mts` | [r4416805143](https://github.com/wlvh/policy-compare/pull/9#discussion_r4416805143): the first occurrence of a four-page header listed twice, counts 5/5 | `935b6e4`, `9ed97f2` | `duplicate-occurrence-probe.log` |
| `lone-variant-probe.mts` | #2's [r4417244277](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417244277) (one-sided `Draft` / `Draft `) and page-counter analogs; a single heading line `Schedule Page 3 -> 4` | `9ed97f2` | `lone-variant-probe.log`; the same probe with the product of #2's `b43de6a` (before #2's fix): `lone-variant-probe-b43de6a.log` |
| `split-cards-single-char-triage-probe.py`, `overlapping-cells-triage-probe.py` | [r4416771397](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416771397), [r4416771405](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416771405), [r4417192877](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417192877) | triage and its test helpers from `4d6b086` (`/14`) and `5989361` (`/15`) | `triage-probes.log` |
