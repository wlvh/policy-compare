New round-6 tests run on the code before each fix (logs as printed; absolute paths shortened):

| log | code under test | new tests | result before the fix |
|---|---|---|---|
| `product-before-fix.log` | product `72f0cd1` (core `+row-identity.6`), the first 19 tests of `tests/cosmetic-evidence.test.ts` from `7d909f1` | one-sided repeated line (wording, draft, amount, `Page n`, `- n -`, both directions), label alone, profile table header, INSURED: -> REINSURED:, R11 alias, unchanged header, page-top check mark | 11 failed (wording, draft, label, header, INSURED/REINSURED, check mark), 8 controls passed; the 2 kept-exit controls were added after the fix and pass on both |
| `triage-before-fix.log` | `scripts/renewal-triage.py` at `7d909f1` (= `60bf50c`), tests from `80af5b1` | Added/Removed/Replaced text only on another page; stated page, no stated page, paragraph across stated pages | Added and Removed accepted on the wrong page and the page-1 paragraph accepted for page 2 (3 failures); the Replaced variant was already rejected by T3; the positive cases and the 28 earlier tests passed |
