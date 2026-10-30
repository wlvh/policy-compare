# Probes at `733abbe`

Codex [r4421658769](https://github.com/wlvh/policy-compare/pull/11#discussion_r4421658769): a percentage or amount written after "page" is taken for a page number.

| Probe | What it checks | Logs |
|---|---|---|
| `scorer-page-fact-probe.ts` | the scorer's `factHolds("page_number_only")` on the review's texts, more forms and controls (`true` holds, `false` disproved, `null` undecidable) | `scorer-page-fact-409e4e2.log` (before, the same file run in a worktree of `409e4e2`), `scorer-page-fact-733abbe.log` (after) |
| `product-page-fact-probe.ts` | the product's stated facts on a footer line (y=815, pages 600 x 850, as in `tests/margin-text.test.ts`); product of `67f5c44` (`+row-identity.33`), #2's file | `product-page-fact-733abbe.log` |

Run from the repository root with `pnpm exec tsx <probe>`.
