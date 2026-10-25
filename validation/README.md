# Rule-generated policy PDF validation fixtures

These documents are fictional and visibly marked SYNTHETIC TEST. This package
contains controlled PDF pairs and expectations derived from explicit source
mutations. It does not contain the actual comparison product.

## Run

Requires Python 3.10+ and ReportLab, pypdf and Pillow.

    python -m pip install -r requirements.txt
    python generator.py
    python fixture_checks.py

Generate a different value variant:

    python generator.py --seed 20261027 --output dataset-seed-20261027
    python fixture_checks.py --dataset dataset-seed-20261027

Run these commands from this directory. The generator also resolves bundled
assets relative to its own file, so it does not require Linux-only font paths.
The bundled DejaVuSans.ttf is accompanied by its font license in assets/.

For byte-for-byte PDF reproduction, use the same seed, source, font and
dependency versions. The exact dependency versions used for the supplied PDFs
are recorded in requirements.txt and dataset/manifest.json. The generator
uses ReportLab invariant mode to avoid creation timestamps in its own PDF
output. Different dependencies may yield different bytes without changing
the logical case.

## Files in each case

- before.pdf and after.pdf: the two product inputs.
- source.json: fictional logical source data and the named mutation rule.
- expected.json: business events and requirements, produced directly from the
  explicit mutation; never learned from a comparison engine's output.
- layout.json: generated text runs, scalar-level logical character cells,
  origins, directions and image-only regions. Coordinates are top-left
  page coordinates in PDF points.

The layout coordinates are generator provenance, not a promise that a PDF
extractor uses identical character boxes. Logical advance cells are not exact
glyph ink outlines. Position checks should compare the correct word, page,
orientation and reasonable geometric overlap, not assert byte equality
between unrelated geometry conventions.

dataset/CASE_CATALOG.zh-CN.md lists all 32 rules.
dataset/fixture_check_report.json records the construction checks.

## Expected result policy

Every text-change event has may_fold=false. Even ordinary renewal and label
changes must remain visible under this high-sensitivity policy.

Events are distinct from UI difference-card counts: a single event may be
presented across multiple cards, and one card may contain multiple events.
The important requirements are correct entity/field, old/new evidence,
visibility and completeness. A field change must not be credited merely
because some unrelated paragraph was highlighted.

Coverage-only image cases do not require an OCR-free engine to read image
text. They require partial status and a visible page/region warning; the
engine must not say that it completed a comparison or found no changes.
The duplicate-key table case allows the entity/row identity to remain
unresolved, but the text delta itself is mandatory: the old and new amounts
must remain visibly presented, either as a group-level change or unmatched
text differences, with links to the concrete text on both sides. A warning
that keys are duplicated, without showing the amount change, is a failure.
The expected event contains require_visible_text_delta, concrete required
old/new amounts and non-empty page/run evidence references. It also prohibits
falsely claiming a unique row identity or no changes.

An output adapter must branch on detection_requirement. It must not treat
must_detect=false as an unconditional skip: R25 has must_detect_text_delta=true
and mandatory visible amounts/evidence even though entity attribution may
remain unresolved; raster cases have mandatory coverage-warning requirements.

To grade the future product, write a small output adapter that maps its
differences/locations/coverage to these logical events. This package does
not include a pretend universal grader for a product schema that is not
implemented yet.

## What these checks prove

fixture_checks.py independently checks that the actual PDFs contain the
generated native text, page counts and image-only boundaries; the supplied
expected events agree with the explicit source model; geometry stays on
the page; and file/source hashes agree.

Passing these checks does not mean the PDF comparison engine passes the
cases. No comparison engine has been executed.

## Limits

This is a functional rule set, not a benchmark for long policies or browser
performance. It uses one controlled template family and does not reproduce
every PDF producer's extraction noise. New random seeds vary values and IDs
within the same rules; they do not create an independent real-world holdout.
Keep separate unseen real documents for final acceptance.

The text checkbox case uses Unicode glyphs, not AcroForms or vector-only
checkboxes. The raster cases deliberately omit OCR text. Broad image and
graphics comparison, signatures, encryption and corrupted-PDF security
tests are outside this package.
