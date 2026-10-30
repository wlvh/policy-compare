# Probes at `c9c6e0c`

| Probe | What it checks | Logs |
|---|---|---|
| `page-codes-probe.ts` | Codex [6519800754](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519800754): the scorer's `factHolds("page_number_only")` on page numbers followed by currency codes the scorer does not list (`100NZD`, `100INR`, `100AED`, `Page 3 AED 100`), with the listed `100USD` and capital-word controls (`true` holds, `false` disproved, `null` undecided) | `page-codes-b35d787.log` (before), `page-codes-c9c6e0c.log` (after) |

Run from the repository root with `pnpm exec tsx reports/invariant-coverage/c9c6e0c/probes/page-codes-probe.ts`.
