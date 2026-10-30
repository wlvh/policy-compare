# Probes on `259d797`

| Probe | Finding | Versions | Log |
|---|---|---|---|
| `column-major-probe.mts` | [PR #9 comment 6510906577](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6510906577): a repeated table heading `MSN \| Operator \| Value` on 2 pages before and 3 after, extracted column by column; control: the same pages extracted row by row | product of this tree; scorers of `cedf563` and `259d797` | `column-major-probe.log` |
| `moved-and-split-row-triage-probe.py` | [PR #11 comment 6511895761](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511895761): an edit-free same-page move met by a Replaced card that edits only the next sentence; full-row recovery of a split pair whose cards also hold another record's unit | triage and its test helpers from `91aa884` (`/20`) and `cedf563` (`/21`, unchanged in `259d797`) | `moved-and-split-row-triage-probe.log` |

The column probe takes the scorer's path as its first argument. The older scorer is `git show cedf563:tests/evaluation/scorer.ts`, with its import pointed at this tree's `packages/contracts/index`. A triage probe takes a directory holding `scripts/renewal-triage.py` and `tests/test_renewal_triage.py` of the stated commit.
