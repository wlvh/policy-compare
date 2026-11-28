# Baseline observations (2026-11-27)

**Historical baseline:** these are the original eight PDF inputs and the original
minimum diagnostic checks. The [2026-11-28 follow-up](acceptance-review-20261128.md)
adds self-comparison, stronger bad-result checks and a header-digit control.
Original JSON observations below remain unchanged.

These are diagnostic observations of existing code, not a repair completion or
UI acceptance report. Inputs and expectations were authored separately from
product output. No customer PDF or screenshot was used as an uploaded fixture.

## Source and build provenance

| Build | Source commit | Rust core WASM SHA-256 |
| --- | --- | --- |
| PR30 base | `6e95976c2ed990a6d0867756b7b02c5f8d72cd52` | `e78d1952b68eeb74329e2f5f5d6892ffc333854004ba1235bf17ab696b8ed946` |
| PR30 final head | `ec467fb959e25786a0649c220b4c03922dc9ae15` | `4f7df73f9a22c8b7ad6b5d6a3e5a705b4e70b8dc16f10bd7b11f11b273f97b75` |

Rust sources, manifests and lockfile were retrieved at these commits and their
Git blob hashes verified before building. Both used Rust 1.93.0 and
`cargo build --offline --locked --release --target wasm32-unknown-unknown`.
No algorithm or budget modifications were made to these builds.

The repository main observed when preparing this pack was
`7b207bbef821ab8474ebc5b0288388d7c60739f0`. Its core source files and MuPDF
adapter are identical to PR30 final head. MuPDF extraction uses adapter blob
`14671fda05e6f274a384f654c57bcf6b31d2d37d`, MuPDF 1.28.1 and the repository's
recorded `preserve-whitespace` text options. The reports contain the actual
extractor metadata, PDF hashes, core version, budgets and WASM hash.

Node was v24.22.3. Defaults were candidates=20,000, tokenProducts=100,000,000,
diffProducts=4,000,000. Candidate accounting changed in PR30, so those candidate
numbers are not equal units of CPU work across versions. This Node replay does
not run the browser watchdog, PDF rendering, or review UI. Its millisecond
fields are observations, not a performance benchmark or an office-PC claim.

## Seven synthetic core inputs

[core-base.json](core-base.json) and [core-head.json](core-head.json) contain
the authored inputs, compact actual results and minimum-condition checks.

| Case | Observation in both builds | Assessment boundary |
| --- | --- | --- |
| `blank_cross_page` | Whitespace produces a Replaced record and a P1-to-P13 alignment. | Minimum core conditions not met. |
| `blank_cross_page_moved` | Whitespace produces a Moved record. | Minimum core conditions not met. |
| `blank_absorbs_heading` | A heading's reflow sources include an unrelated page-13 blank. | Minimum core conditions not met. |
| `heading_trailing_space` | A raw spacing difference is retained. | This is allowed evidence; the primary UI label/group still needs review. |
| `repeated_company_changed_context` | Technical Added/Removed records coexist with ambiguous_match; both occurrences on both sides remain available. | Conservative non-pairing is allowed; misleading presentation must be checked in the UI. |
| `real_year_change` | 2026-to-2027 change and source references remain. | Negative control preserved. |
| `token_boundary_change` | `12 34` versus `1234` remains a non-whitespace-only text difference. | Negative control preserved. |

Compact differences, alignment, unresolved groups and coverage are equal for
these seven inputs across the two builds. Core versions and some work counters
differ. Diagnostic mode exits 0 to mean evidence collection succeeded.
`--assert-fixed` was also run on head and exited 1 for the three whitespace
core defects. Neither exit 0 in diagnostic mode nor preservation of the two
controls means the repair has passed.

## Four actual PDF pairs through MuPDF

[pdf-base.json](pdf-base.json) and [pdf-head.json](pdf-head.json) record the
actual PDF extraction and comparisons. Source summaries use one-based physical
PDF page numbers; alignment keeps the product's zero-based page indexes.

| PDF case | Base differences / unresolved / coverage | Head differences / unresolved / coverage | Comparison |
| --- | ---: | ---: | --- |
| A: whitespace | 39 / 1 / 0 | 42 / 2 / 0 | Different completion under the same configured budget; see below. |
| B: duplicate contexts | 8 / 4 / 0 | 8 / 4 / 0 | Identical differences, unresolved groups, coverage, alignment and status. |
| C: address reflow | 10 / 0 / 0 | 10 / 0 / 0 | Identical comparison semantics; free-form address fragments appear as unmatched removed text and new labelled rows as unmatched added text. |
| D: mixed review | 14 / 2 / 22 | 14 / 2 / 22 | Identical comparison semantics; actual content edits coexist with spacing and review notices. |

Counts are output records, not independently scored business changes or errors.
The PDF corpus does not duplicate the exact geometry and segmentation of the
synthetic core cases: for example, A has extracted blank lines but does not
produce the same standalone blank-cross-page record as the minimal core input.
Keep the two test layers distinct.

### Why A differs

- Both runs use identical PDF bytes, extraction snapshots and config digest.
- Base reaches candidates=20,000 with tokenProducts=0. Its one unresolved
  group is `budget`, containing four unfinished units on each side.
- Head uses candidates=10 and tokenProducts=188. It has no budget stop;
  both unresolved groups are `ambiguous_match`.
- Thirty-eight common difference objects are exactly equal. Base has one
  additional occurrence-count-only record for an insured line (13 to 12).
  Head instead has a source-backed spacing correspondence for that line plus
  three unmatched records involving the title and an unchanged service-period
  line. Thus the net count increases by three.

The base matcher spends candidate budget while enumerating reflow attempts;
PR30 indexes those candidates and can continue farther within the configured
budget. This observation supports keeping its performance work while repairing
the underlying matching/presentation problems. It does not establish that all
PDF outputs are identical or, by itself, prove a new matching-quality regression.

### What was and was not verified

- Every exported source reference in differences, text operations, occurrences
  and unresolved groups was checked against the extracted document characters:
  A base/head 252/231 references; B 28/28; C 48/48; D 93/93. This proves that
  the references resolve, not that their correspondence is correct.
- Eight PDFs contain 46 pages. Fixed generation was repeated and produced
  identical PDF bytes and manifests. Nine representative pages were rendered
  and visually inspected; embedded fonts avoid environment-dependent fallback.
- The authored PDF truths remain independent acceptance expectations. No
  end-to-end accuracy score is asserted from record counts or self-reported facts.
- Browser layout/workflow, PDF.js behavior, office-device performance and the
  user's original business documents are **NOT_EVALUATED** in this pack.
  Perform the [workflow acceptance](../acceptance.md) during the implementation.
- The new fixtures are supporting material on an isolated branch; integration
  into the repository's ordinary core/PDF/browser verification is part of the
  repair issue, not something this upload claims to have completed.
