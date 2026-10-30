# Probes at `8906d05` (product and triage code of `081f370`)

Independent reproductions of the three items in the user's [PR #9 review 6517899051](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6517899051), all in #2's files.

| Probe | Item | Log |
|---|---|---|
| `product-probes-review-6517899051.ts` | 1, [r4420795051](https://github.com/wlvh/policy-compare/pull/9#discussion_r4420795051): with no heading row, a cell holding an identifier's name and punctuation only (`MSN:`, `MSN -`) still pairs two records by row identity; `MSN`, `MSN#` and `MSN No.` do not; controls `MSN 123`, `MSN: 123` | `product-probes-081f370.log` |
| the same | 2, [r4421114827](https://github.com/wlvh/policy-compare/pull/9#discussion_r4421114827): the same three rows (`MSN \| Operator \| Value` and two records; baselines 180/193/206, columns x 40/190/340) extracted row by row on one side and column by column on the other give 3 Removed + 1 Added with no unresolved item; each order against itself gives no difference | the same |
| `../../081f370/probes/repeated-atoms-triage-probe.py` | 3, Codex [6516690587](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516690587): two identical replacement edits of one event, only the first copy edited: `correct`, `complete`, both atoms `correct` | `repeated-atoms-081f370.log` |

Run the TypeScript probe from the repository root with `pnpm exec tsx reports/invariant-coverage/8906d05/probes/product-probes-review-6517899051.ts`, the Python probe as `python3 -I <probe> <repository root>`.
