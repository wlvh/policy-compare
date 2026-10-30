# Probes on the joint tree `74707bd`

| Probe | Finding | Scorer / triage | Log |
|---|---|---|---|
| `fixed-counter-probe.mts` | #2's [r4417303223](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417303223) (fixed `Page 1` against counting `Page 1`..`4`, both directions) and [r4417386694](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417386694) (spaces beside a changed page number); the product's own output of this tree | scorer `74707bd` (the `a2dbe21` scorer's result is in `../a2dbe21/probes/`) | `fixed-counter-probe.log` |
| `replaced-row-sign-overlap-triage-probe.py` | [r4417329496](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417329496), [r4417384098](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417384098), [r4417384107](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417384107); the earlier `/15` probes (`../9ed97f2/probes/`) re-run on `/16` | triage and its test helpers from `5989361` (`/15`) and `8f63087` (`/16`) | `triage-probes.log` |
