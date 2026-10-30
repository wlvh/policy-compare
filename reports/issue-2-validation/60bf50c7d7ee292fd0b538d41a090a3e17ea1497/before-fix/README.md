New round-5 tests run on the code before each fix (logs as printed; absolute paths shortened):

| log | code under test | new tests | result before the fix |
|---|---|---|---|
| `product-before-fix.log` | product `b479715` (core `+row-identity.5`), new tests from `f3148df` | MSN 1/2 conflict; SECTION 10.1/10.2, CHAPTER 3/4, SECTION A/B | 2 failed (MSN 1/2, SECTION 10.1), 2 controls passed |
| `scorer-before-fix.log` | `tests/evaluation/scorer.ts` at `f3148df`, dataset and tests from `4bf54eb` | 9 R16 tests + N/A count 12 | 3 failed (N/A count, exact title rejected, body-text case NOT_EVALUATED for lack of the N/A entry); the negative controls already failed as required |
| `triage-before-fix.log` | `scripts/renewal-triage.py` at `4bf54eb` (= `ee0f0a5`), tests from `60bf50c` | 5 counterexamples + 5 positive controls | the 5 counterexamples were accepted (5 subtest failures); controls and the 26 earlier tests passed |
