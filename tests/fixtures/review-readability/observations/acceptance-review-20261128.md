# Acceptance review follow-up (2026-11-28)

This update strengthens the tests and closure criteria for Issue #34. It does
not implement or certify a product repair. The original A-D PDFs remain
byte-identical to fixture commit `868c9064f976de156400ae73ecf0232a41ecf7ad`;
their original diagnostic observations remain unchanged. E adds two one-page
inputs, so manifest version 2 contains ten PDFs and 48 pages.

The Rust core was independently rebuilt again from the same PR30 base and
final-head commits, with Git source blob verification and Rust 1.93.0. Its WASM
SHA-256 values match the [original build provenance](README.md#source-and-build-provenance).
The actual repository MuPDF adapter and locked MuPDF 1.28.1 were used. Product
inputs did not include authored truth files or altered result objects; deliberate
bad-result injections below are separate checker tests.

## 1. Same-file comparison: a deterministic defect

Each A PDF was opened and extracted independently on each side, then compared
using the unmodified PR30 final-head core and default budgets.

| Input on both sides | Exported differences | Other facts | Core acceptance |
| --- | --- | --- | --- |
| A baseline | 3 Replaced + 3 Removed | File hashes and extraction snapshot hashes equal; zero unresolved/coverage. | FAIL: differences must be zero. |
| A revised | 6 Moved | File hashes and extraction snapshot hashes equal; zero unresolved/coverage. | FAIL: differences must be zero. |

Evidence: [baseline self-comparison](self-baseline-head-20261128.json),
[revised self-comparison](self-revised-head-20261128.json). These files include
hashes, exact text operations and source locations. The baseline pairs an
unchanged sentence with that sentence plus a blank and separately removes the
blank. The revised input reports moves between pages 1/2/3 and 11/12/13 even
though both inputs are the same file.

`--assert-self` exited 1 for each input. Zero exported differences is checked
regardless of visibility flags. The current examples happened not to use a
whitespace-only alignment point; that passing subcheck cannot cancel the false
differences. Browser review-item counts and raw-source usability still require
the actual workflow check.

From the repository root, after building the core:

```sh
node --import tsx tests/fixtures/review-readability/replay-pdfs.ts --wasm packages/rust-core/generated/core.wasm --case a-whitespace --self baseline --assert-self --out /tmp/a-baseline-self.json
node --import tsx tests/fixtures/review-readability/replay-pdfs.ts --wasm packages/rust-core/generated/core.wasm --case a-whitespace --self revised --assert-self --out /tmp/a-revised-self.json
```

A future repair must also preserve the existing real-year and token-boundary
negative controls. Same-file zero alone is not complete matching acceptance.

## 2. Verify that deliberately wrong results are rejected

The [old/new checker evidence](checker-regression-evidence-20261128.json)
records the two reported mutations on actual head output, with source/code
hashes and all old/new verdicts. Two weaknesses in the original minimum diagnostic were confirmed: its blank
check used `defaultVisible`, and its company-source check only checked source
conservation if an unresolved company group existed. Thus hiding a bad blank
record or removing the groups entirely could satisfy the old checks.

The strengthened checks are independent exports in
[checks.mjs](../core/checks.mjs). They inspect exported blank records regardless
of visibility, inspect nested source links, and count the independently expected
company occurrences against the original input. Two references to the same
occurrence cannot stand in for two distinct occurrences.

| Deliberate result condition | Required result |
| --- | --- |
| Erase company differences and unresolved sources | FAIL: required [2,2] occurrences are no longer evidenced. |
| Hide a blank Moved record and remove alignment | FAIL: the wrong exported blank record remains. |
| Hide an all-whitespace Replaced record | FAIL. |
| Put an unrelated distant blank in a heading's nested text operations | FAIL. |
| Lose one company occurrence and duplicate the other's references | FAIL. |
| Preserve sources, but claim pairing without independent applicable evidence | NOT_EVALUATED; assertion mode must not pass. |
| Preserve both sides in explicit conservative uncertainty | PASS for the source/uncertainty condition; UI still separate. |
| Correct local pairs supported by independently authored, source-verified anchors | PASS; unresolved records are not mandatory. |
| Reverse those independently established pairs | FAIL. |

The [checker self-test](../core/checks-self-test.mjs) exercises ten scenarios,
including the two reported false positives and positive controls. All ten gave
their expected verdicts: [recorded checker output](checker-self-test-20261128.json).
This PASS certifies those checker assertions, **not** the product fix or a
general guarantee that every possible incorrect result is detected.

```sh
node tests/fixtures/review-readability/core/checks-self-test.mjs
node tests/fixtures/review-readability/core/reproduce.mjs --wasm packages/rust-core/generated/core.wasm --assert-fixed --out /tmp/strengthened-core.json
```

The real PR30 head still fails the three known blank core cases under the
strengthened checks; its conservative company uncertainty and both real-edit
controls remain accepted. See [the current core report](core-head-strengthened-20261128.json).
FAIL and NOT_EVALUATED do not yield a successful `--assert-fixed` exit code.
No exact difference-card count is required for ordinary content changes.

## 3. Header control: change one digit, preserve the distant 812

[E](../e-header-digit/truth.json) uses D's header coordinates and embedded font.
Only `DOC-0042` changes to `DOC-0043`; all other text, including the distant
`812`, remains unchanged. Ten PDFs were generated twice with identical bytes;
A-D still match the original manifest. Both E pages were rendered and visually
inspected. The source text comparison confirms the sole character edit.

The unmodified head produces one Replaced record. Its operations delete `2`,
insert `3`, and retain `812` in an equal operation:
[E core observation](e-head-20261128.json). The record contains both header
fragments, but that fact alone does not prove incorrect highlighting or an
identity claim. E is a regression control, not a claim that this specific input
currently reproduces every photographed cross-column problem.

Acceptance requires the changed identifier to be locatable; unchanged `812`
may be neutral context but may not be deleted, inserted, struck through or
colored as changed. The browser highlighting and identity-evidence review are
NOT_EVALUATED here.

## 4. Keep the browser workflow test stable after matching improves

The [revised workflow requirements](../acceptance.md#62-固定界面输入在两个视口执行同一次组合审阅)
separate real-PDF algorithm checks from a controlled UI state. Reuse the existing
`tests/browser/review-flow.spec.ts` and its independently authored amount/source
fixture. Add a separate fixed candidate group, coverage and repeat summary;
do not depend on D's incorrect amount pairing to generate unresolved groups.

At 1366x768 and 1280x720, begin with the same amount edit, a non-default filter
and a nonzero scroll position. Visit candidate, coverage and repeat sources in
one workflow, then return to the same card id, filter and scroll position (1 CSS
pixel rounding tolerance), with both amount sources readable. UI-only injected
states remain in browser test code, and do not run in real-PDF matching checks.

B's unresolved-entry check is conditional on an actual unresolved group. When
independent evidence supports a valid local pairing and no group is needed,
that entry-only check is N/A; source and correspondence checks still apply.

This update specifies the stable combined workflow and the existing code to
extend. It does not claim that the controlled browser fixture/test has already
been implemented or run. That remains a requirement for the repair PR.

## Additional attribution check: the old candidate budget

For A baseline versus revised, only the old core's candidate limit was raised
from 20,000 to 40,000. Other configured budgets and PDF/extraction inputs stayed
fixed. It used **30,020 candidates** and produced 42 differences and two
ambiguous matches. Its differences, unresolved groups, coverage, alignment and
status have the same semantic SHA-256 as the prior PR30-head default run:
[expanded-budget observation](a-base-expanded-20261128.json).

This independently confirms the reviewer's budget experiment. It explains the
39-versus-42 count for this input without establishing that all 42 records are
correct. Candidate accounting differs across versions; 30,020 versus 10 is
not a directly comparable CPU-work metric. No production budget was changed.
