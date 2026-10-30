# Probes on the joint tree `509b088`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `moved-and-split-row-triage-probe.py` | [PR #11 comment 6511895761](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511895761): an edit-free move met by a Replaced card; a split row's full row borrowing another record | triage and its test helpers from `cedf563` (`/21`), `cc99133` (`/22`) and `509b088` (`/23`) | `triage-probes.log` |
| `adjacency-from-whole-card-triage-probe.py` | [PR #11 comment 6512133284](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6512133284): two meeting source ranges joined or split by text elsewhere on the card | the same | `triage-probes.log` |
| `opposite-side-whole-number-triage-probe.py` | [PR #9 comment 6512254699](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6512254699): an added (removed) paragraph counted as kept inside a longer number on the other side | the same | `triage-probes.log` |
| earlier probes (`codex_r27` … `codex_r41`, filed in earlier folders) | the earlier triage findings | `/21` against `/23` | `earlier-probes-on-23.log` |

A triage probe takes a directory holding `scripts/renewal-triage.py` and `tests/test_renewal_triage.py` of the stated commit (`git show <sha>:<path>`).
