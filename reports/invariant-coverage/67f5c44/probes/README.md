# Probes at `67f5c44` (merge of #2's `8bf16df`: product `+row-identity.33`, triage `/34`)

"Before" is #2's previous head `8f0e71b` (product and triage of `081f370`).

| Probe | What it checks | Logs |
|---|---|---|
| `../../8906d05/probes/product-probes-review-6517899051.ts` | the user's items 1 and 2 as filed in §0.57 | `product-probes-review-6517899051-67f5c44.log` (before: `../../8906d05/probes/product-probes-081f370.log`) |
| `product-probes-33bda44.ts` | item 1 with more label forms (`MSN No.:`, `MSN: —`, `MSN/`, `MSN :`, `(MSN)`, `MSN: TBA`); item 2 with a changed value, four rows, and a two-column table; a four-column record wrapping three cells onto a second line, in cell order and in line order, with a two-cell control | `product-probes-33bda44-67f5c44.log`, `product-probes-33bda44-8f0e71b.log` (the same file run in a worktree of `8f0e71b`) |
| every triage probe listed in `../../081f370/probes/all-probes-triage-32.log`, plus `../../f6d0ea0/probes/split-fullrow-triage-probe.py` | regressions of earlier findings; item 3 and Codex [6517133695](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517133695) | `all-probes-triage-34.log`, `diff-32-34.txt` |
| `added-row-linkage-triage-probe.py` | Codex [6518043799](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6518043799): an Added (Removed) author row accepted from a unit where another, undeclared record stands between the identity and the amount; three controls | `added-row-linkage-triage-34.log`, `added-row-linkage-triage-32.log` (identical) |

Run the TypeScript probes from the repository root with `pnpm exec tsx <probe>`, the Python probes as `python3 -I <probe> <dir holding tests/test_renewal_triage.py and scripts/renewal-triage.py>`.
