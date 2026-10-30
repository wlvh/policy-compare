# Probes at `77faf39` (product and triage of `67f5c44`: `+row-identity.33`, triage `/34`)

| Probe | Finding | Logs |
|---|---|---|
| `fullrow-borrowed-cell-triage-probe.py` | Codex [6519018610](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519018610) (triage, #2's): the author row `1315 \| Alpha \| USD 100` → `... USD 200`; a Replaced card on one unit `1315 USD 100; 1760 Alpha USD 999` → `1315 USD 200; 1760 Alpha USD 999` gets `fullRowRecovered` true, with `Alpha` taken from record 1760. Controls: `Alpha` in record 1315 (true), no `Alpha` (false) | `fullrow-borrowed-cell-triage-34.log`, `fullrow-borrowed-cell-triage-32.log` (identical) |

Run as `python3 -I <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
