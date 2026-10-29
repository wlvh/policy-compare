First MuPDF browser run of the regression script on this commit: 14/15. The failing test was
`tests/browser/lifecycle.spec.ts` "twenty cancellation cycles leave no workers and allow a complete
subsequent result": after one of the cancels, `page.workers().length` was still 2 when the 5 s poll
ran out (`error-context.md`). The test failed before writing `reports/cancellation-mupdf.json`, so no
cancellation timing file belongs to this run. Nothing under `apps/`, `engines/` or
`packages/contracts/` changed since 72f0cd1 (this commit only changes `category()` and the triage
script). The suite was run once more on the same build: 15/15, cancellation max 304 ms with no
remaining workers (`../browser-tests-mupdf.log`, `../cancellation-mupdf.json`). Both runs are kept;
the first failure is reported as an intermittent worker-cleanup failure, not counted as a pass.

Root cause, found afterwards (commit f324d8b): not a worker leak. The page snapshot in
`error-context.md` shows the comparison finished ("比较完成", result card, Cancel disabled), so
the cancel never ran: the first cycle uses the pre-warmed PDF worker and finishes about 450 ms
after the start click, and when it finishes between Playwright's check that Cancel is enabled and
the click, the click lands on the disabled button. A finished task keeps its two workers for
rendering and search. The test now records such attempts (`finishedBeforeCancel`) instead of
counting them, and still requires twenty real cancellations.
