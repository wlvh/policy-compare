First MuPDF browser run of the regression script on this commit: 14/15. The failing test was
`tests/browser/lifecycle.spec.ts` "twenty cancellation cycles leave no workers and allow a complete
subsequent result": after one of the cancels, `page.workers().length` was still 2 when the 5 s poll
ran out (`error-context.md`). The test failed before writing `reports/cancellation-mupdf.json`, so no
cancellation timing file belongs to this run. Nothing under `apps/`, `engines/` or
`packages/contracts/` changed since 72f0cd1 (this commit only changes `category()` and the triage
script). The suite was run once more on the same build: 15/15, cancellation max 304 ms with no
remaining workers (`../browser-tests-mupdf.log`, `../cancellation-mupdf.json`). Both runs are kept;
the first failure is reported as an intermittent worker-cleanup failure, not counted as a pass.
