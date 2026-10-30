# Probes on the joint tree `cedf563`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `whole-paragraph-around-edit-triage-probe.py` | [PR #11 comment 6510958743](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6510958743): the author paragraph shares the edited unit with another amount | triage and its test helpers from `91aa884` (`/20`) and `cedf563` (`/21`) | `triage-probes.log` |
| `split-row-full-triage-probe.py` | [PR #11 comment 6511266424](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511266424): full-row recovery on a complete Removed + Added pair | the same | `triage-probes.log` |
| `declared-counter-probe.mts` | PR #9 [r4418530241](https://github.com/wlvh/policy-compare/pull/9#discussion_r4418530241): a profile-declared header whose last page counter changes, graded with this tree's scorer | product and scorer of `cedf563` | `declared-counter-probe.log` |

A triage probe takes a directory holding `scripts/renewal-triage.py` and `tests/test_renewal_triage.py` of the stated commit (`git show <sha>:<path>`).
