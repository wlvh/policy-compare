# Synthetic review task

These two PDFs are test inputs authored for edit presentation and navigation, not real policies or unseen validation samples. The comparison application does not read `author-input.json` or this generator.

`before.pdf` has two pages and `after.pdf` has three. The first page changes the limit from USD 1,000,000 to USD 1,500,000, the report period from 30 to 45 days, and the administration charge from USD 100 to USD 150. Complete sentences around the first two edits include their currency, negative and conditional wording. Unchanged sentences separate the two edit groups. The repeated headings and footers exercise the existing count and source panels.

Generate with Python and the pinned `reportlab==4.4.9` from `validation/requirements.txt`: `python tests/fixtures/review-flow/generate.py`. Generation uses ReportLab's invariant mode. `author-input.json` records the original texts, PDF hashes and independently calculated display-coordinate regions of the changed phrases. Browser tests use those regions to check both source panes rather than deriving expected geometry from the comparison output.

The browser tests separately inject review notices and budget-stage records to exercise presentation. Those injected records are not evidence that these PDFs trigger a layout limitation or exhaust the normal comparison budget. Actual word-diff budget exhaustion is tested against the real WASM with an explicit small test budget.
