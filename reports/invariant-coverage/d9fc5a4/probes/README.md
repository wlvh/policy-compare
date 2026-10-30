# Probes at `d9fc5a4` (product and triage of `67f5c44`: `+row-identity.33`, triage `/34`)

| Probe | Finding | Logs |
|---|---|---|
| `overlapping-atoms-triage-probe.py` | Codex [6518372639](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6518372639) (triage, #2's): a row's two differently worded edits `USD 100 → USD 200` and `100 → 200`, from a card editing only `USD 100`, are both `correct` and the event `complete`; `/34` groups only identical edits. A variant editing only the bare `100`, and a control editing both | `overlapping-atoms-triage-34.log`, `overlapping-atoms-triage-32.log` (identical) |

Run as `python3 -I <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
