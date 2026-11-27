# Review readability regression inputs

These eight English PDFs are fictional. They contain no customer documents,
customer names, screenshots, internal URLs, or uploaded insurance material.
They isolate source handling and review problems that can occur in ordinary
PDFs. Printed document content does not include the test answers.

| Case | Pages per document | Intended situation |
| --- | ---: | --- |
| `a-whitespace` | 13 | Boundary spaces, one rewrapped sentence, and isolated spaces on different pages; no non-whitespace wording changes. |
| `b-duplicate-context` | 2 | Two identical company-name occurrences with changed context and no individual record identifiers. |
| `c-address-reflow` | 2 | Free-form addresses become labelled/reordered rows; two distinct companies share a city. |
| `d-review-mixed` | 6 | Repeated raster logos and header items, date/amount/negation changes, sentence addition/removal, a count change, table-row value swaps, and formatting controls. |

Every directory contains `baseline.pdf`, `revised.pdf`, and an independently
authored `truth.json`. The truth describes source edits and acceptable evidence,
not a golden copy of current product output. The generator never reads it.
Source page numbers are one-based; coordinates use PDF points from the top-left.

## Quick review

Download [pdf-pairs.zip](pdf-pairs.zip) for the eight PDF inputs, authored
expectations and PDF hash manifest. Individual PDFs remain available in the
four case directories. In the application, load each `baseline.pdf` on the
Baseline side and its paired `revised.pdf` on the Revised side.

Follow [acceptance.md](acceptance.md) to check the complete review workflow.
The inputs intentionally expose existing defects; uploading them does not mean
the repair is implemented. [Observed base/head results](observations/README.md)
state exactly what was reproduced and what remains unevaluated.

## Rebuild

```sh
python -m pip install -r tests/fixtures/review-readability/requirements-generate.txt
python tests/fixtures/review-readability/generate.py
```

`--out /path/to/directory` writes only the generated PDFs and `manifest.json`
to another directory. Copy authored truths separately if constructing a complete
fixture pack there. ReportLab invariant mode and fixed metadata make repeated
generation byte-identical under the pinned dependencies. The manifest records
the PDF SHA-256 values, sizes and page counts.
The PDFs embed the Vera/Vera Bold fonts included with ReportLab, so reading
does not depend on a viewer's substitution for standard PDF fonts.

## Reproduce with the repository core

Use the repository's documented Node 24/Rust toolchain and install its locked
root dependencies and MuPDF engine. From the repository root:

```sh
pnpm build:core
node tests/fixtures/review-readability/core/reproduce.mjs --wasm packages/rust-core/generated/core.wasm --out /tmp/review-core.json
node --import tsx tests/fixtures/review-readability/replay-pdfs.ts --wasm packages/rust-core/generated/core.wasm --out /tmp/review-pdfs.json
```

The first command after the build uses seven synthetic extracted-text inputs;
it does not exercise PDF parsing. The PDF replay uses the actual repository
MuPDF adapter and the same unfiltered WASM ABI. It does not read `truth.json`.
It checks source-reference integrity, records actual output, and labels repair
acceptance `NOT_EVALUATED`. To retain the full product JSON as well, append
`--full-results /tmp/review-full` to the PDF replay.

For a proposed fix, the core diagnostic also supports `--assert-fixed`; an
unmet minimum core condition then exits 1. Default diagnostic exit 0 means
observations were collected, not that the product passed acceptance. See
[core/README.md](core/README.md) for scope and exit codes. The browser workflow
and the authored PDF events still need independent checking.

To compare historical builds, retain this fixture pack while building WASM
from each commit recorded in [observations](observations/README.md), and pass
each resulting WASM path with `--wasm`. `--repo` selects the repository whose
MuPDF adapter is used; `--fixtures` selects a different input directory. Keep
PDF bytes, adapter, configuration and budgets fixed. A matching `coreVersion`
string alone is not proof of the source commit; compare the actual WASM hash.

These diagnostics have not been wired into normal CI. The repair issue requires
integration into existing core, PDF and browser checks. PDF.js, the office
browser workflow, original customer documents and target-machine performance
are explicitly not covered by this baseline replay.

## Evidence boundaries

Creating and rendering these files does not establish that a particular product
version reproduces a bug. Actual MuPDF extraction, before/after comparison and
browser review results must be recorded separately with the source commit and
extractor versions. If a PDF does not trigger an intended behavior, report that
result rather than changing its answer to fit the implementation.

The expectations deliberately preserve meaningful text edits, distinct source
occurrences, count differences and genuine uncertainty. They do not authorize
deleting raw source characters, forcing repeated-name pairs, cancelling table
row changes because the amount set is unchanged, or hiding unresolved coverage.

The tiny repeated logo in `d-review-mixed` is an original abstract raster mark
generated from fixed pixels. It is a coverage/review input, not evidence that
OCR has been performed or that a logo has business importance.
