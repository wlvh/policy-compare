# Core reproduction: correspondence and review readability

This package contains seven small, authored DocInput examples. They do not use
customer PDFs, PDF extraction, browser rendering, or any third-party Node package.
The company name "Harbor Example Insurance Ltd" is fictional.

The expected behavior in expectations.json was written from the input and the
review requirement. It is independent of the core's current output. Running this
diagnostic must not overwrite the expectations with the observed results.

## Run

Use the repository's documented Node version. Build or obtain the WASM for the
specific commit being investigated, then run:

~~~sh
node reproduce.mjs --wasm /absolute/path/policy_compare_core.wasm --out observations.json
~~~

Normal diagnostic mode exits 0 when the run completes, including when defects
are found. The report labels unmet requirements "expected-not-fixed"; its overall
outcome is "observations-recorded-not-a-pass-verdict". This is successful
collection of evidence, not a claim that product tests passed.

After a proposed repair, run the minimum core checks:

~~~sh
node reproduce.mjs --wasm /absolute/path/fixed-core.wasm --out fixed-observations.json --assert-fixed
~~~

Exit codes:

- 0: observations written; or all selected minimum core conditions met in assertion mode.
- 1: one or more selected minimum conditions failed in assertion mode.
- 2: invalid invocation, unreadable files, ABI error, or core execution failure.

Even an assertion-mode exit 0 does not establish that UI grouping, labels,
highlighting, or default visibility in the application is correct. Those need a
browser replay. The test does not require future UI fields or a particular
internal matching implementation.

Each report records the SHA-256 of the supplied WASM bytes. A coreVersion string
alone does not identify a build: different commits can share it. Record the
verified source commit and the build command alongside the report. Do not assume
that a file named "baseline.wasm" or "indexed.wasm" came from the desired commit.

Reports omit timings, timestamps, absolute paths and generated artifact IDs so
the same inputs and WASM produce stable, reviewable JSON. Pages in this package's
input and compact output are 1-based; the WASM DocInput and result ABI use 0-based
pageIndex values internally. Raw strings are retained, with code points added
for all-whitespace difference text.

## Cases and the scope of the authored expectations

| Case | Purpose | Minimum core check | Additional browser check |
| --- | --- | --- | --- |
| blank_cross_page | Two whitespace lines on pages 1/2 versus one on page 13 | No default-visible blank card and no blank-derived alignment | No empty item in the main review list |
| blank_cross_page_moved | Empty lines conflict in order with a real unchanged clause | Same checks, and no meaningful clause text change | No empty moved-text item; normal source navigation |
| heading_trailing_space | A real heading gains a trailing space | No meaningful text change; a raw spacing record may remain | Classify/display it as spacing or layout, not a substantive change |
| blank_absorbs_heading | A heading is unchanged, but the other document has an unrelated blank on page 13 | Do not attach the remote blank as part of the heading correspondence | No misleading source badge or jump |
| repeated_company_changed_context | Same company appears twice on both sides, but preceding blocks differ | When uncertainty is emitted, retain both sides and all 2+2 source occurrences | Present uncertainty neutrally; do not assert disappearance or force pairing by list order |
| real_year_change | Negative control: 2026 becomes 2027 | Retain source-backed delete/insert operations on the changed final digits | A normal visible year change |
| token_boundary_change | Negative control: "12 34" becomes "1234" | Retain a meaningful difference, not whitespace_only | A normal visible token-boundary change |

The two negative controls stop a blanket "ignore every space" or "hide all
differences" change from passing this small suite. In the repeated-company case,
the core's choice not to force a pairing can be correct. Technical Added/Removed
records accompanied by retained uncertainty are an allowed conservative form;
their kind alone is not an assertion-mode failure. Misleading review wording is
a separate UI issue. The guarded source-conservation check does not prove that
every occurrence is paired to the correct business block, or validate a future
representation that emits no uncertainty record. Those need browser review and
the real-PDF source checks.

These are newly authored fixtures for the seven named mechanisms. They are not
claimed to be a byte-for-byte replay of earlier scratch inputs or of the user's
original documents. Build/version attribution comes from verified source and
WASM provenance, not from reproducing a similar screenshot.

The layout-only heading case deliberately does not demand deletion of raw
whitespace evidence from the export. Its product problem cannot be proved fixed
by a core-only script.

## Reuse the WASM bridge

bridge.mjs has no CLI side effects and only imports Node built-ins. It exports:

- DEFAULT_BUDGET
- loadWasm(path), returning a compiled module and its byte SHA-256
- compareDocs(moduleOrWasmPath, leftDoc, rightDoc, budget, hooks), returning the
  complete unfiltered core result

Example for a separately extracted PDF pair:

~~~js
import { loadWasm, compareDocs } from "./bridge.mjs";

const { module, sha256 } = await loadWasm("/path/to/core.wasm");
const result = await compareDocs(module, baselineDocInput, revisedDocInput);
~~~

The bridge follows the existing policy-core-session/1 JSON protocol:
reset, meta/page/done for each side, compare, and dispose. It supplies host.phase
and host.check imports. Optional hooks.phase and hooks.check callbacks let the
caller collect phases or throw at a checkpoint. Default callbacks do nothing;
this isolated core runner does not reproduce the browser's 120-second deadline.

The bridge does not validate PDF extraction, infer build provenance, parse an
answer key, or alter the result to make an assertion pass.

