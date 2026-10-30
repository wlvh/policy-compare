# CI on 842b0ff (final joint code tree)

Runs: [40909238969](https://github.com/wlvh/policy-compare/actions/runs/40909238969) (push) and [40909256663](https://github.com/wlvh/policy-compare/actions/runs/40909256663) (pull_request). 12/12 jobs succeeded.

| job | steps (both runs) |
|---|---|
| functional (mupdf) | install, `install:mupdf`, `verify:core`, build, `pdf-check.ts`, rules (`pnpm test:rules:mupdf \|\| test $? -eq 2`), `review-check.ts`, browser install, `test:browser:mupdf`, report upload: all success |
| functional (pdfjs) | same steps for pdfjs: all success |
| linux-container (mupdf), linux-container (pdfjs) | install, build and start the selected Linux image, upload: all success |
| renewal-triage-tests | `python -m unittest discover -s tests -p 'test_renewal_triage.py' -v`: success |
| fixture-construction | `validation/fixture_checks.py`: success |

Read from the logs of run 40909256663 (jobs 123572415467 mupdf, 123572415297 pdfjs):

- rules, both engines: `strict NOT_EVALUATED 28/32; events PASS 32/32; not evaluated: R16_repagination, R18_ligature, R23_table_reorder, R24_table_cross_page`, then `Command failed with exit code 2`. The step passes through `test $? -eq 2`: only registered coverage gaps; an exit code 1 would fail it.
- `review-check.ts`, both engines: status PASS, 10 checks PASS (the revision printed is GitHub's merge ref for the pull_request run).
- browser, both engines: `16 passed`, including `rules.spec.ts` "all 32 pairs: no failure with browser fine location, only registered coverage gaps left unevaluated".
