# Current runtime packages

A runtime package lets you copy a built application to another computer. That computer needs Node.js 24 LTS and a browser supported by the application. The package includes the selected PDF engine, Rust comparison core, web resources, local static server, licenses and sample PDFs.

Development reports, expected test answers, datasets, installed dependencies and build caches stay in the development repository. The P01, P02 and E03 sample buttons and the package's `samples/before.pdf` and `samples/after.pdf` remain available.

## Use a prepared package

1. Copy the selected engine's `.tar.gz` file and accompanying `manifest.json` to the receiving computer. Check the archive's SHA-256 against the manifest, then extract it.
2. Open a terminal in the extracted `policy-compare-mupdf` or `policy-compare-pdfjs` directory and run `node server.mjs`.
3. Open `http://127.0.0.1:8080/`. Use a sample button or select the package's PDFs or your own files.
4. Press Ctrl+C in the terminal when finished. The package's `RUN.md` contains startup instructions. Older packages may instead contain `RUN.zh-CN.md`.

These steps serve the application to the receiving computer itself. To access it from another device over a network, configure HTTPS and retain the required security response headers. See the [deployment guide](deployment.md).

## Build from source

Prepare the project's Node, pnpm and Rust toolchains and Python virtual environment in the repository root. Install the selected engine, then build with a new release ID before packaging.

```sh
pnpm install --frozen-lockfile
pnpm install:mupdf
POLICY_RELEASE_ID=r-local-example POLICY_REVISION="$(git rev-parse HEAD)" pnpm build:mupdf
pnpm package:runtime --engine mupdf
```

For PDF.js, use `install:pdfjs`, `build:pdfjs` and `--engine pdfjs`. After building both engines, use `--engine both` to package both.

Output defaults to `delivery/runtime-<release-id>/`. Existing directories are not overwritten; use `--out <new-directory>` to choose a different location. Archive paths in the manifest are relative to its directory, so the directory can be copied as a unit.

Before packaging, the script checks the version path, engine, source commit and each static resource's size and hash. All selected engines must identify the same source commit. This packaging entry records the current artifacts independently of historical runtime and performance evidence.

## Verify the extracted package

```sh
POLICY_BROWSER_CHANNEL=bundled \
POLICY_REPORT_DIR=reports/maintenance/runtime-example \
pnpm verify:runtime delivery/runtime-r-local-example/manifest.json
```

Use the verifier from the same source/test revision as the packaged application. Current browser assertions expect English controls; historical Chinese packages require their matching historical tests. The verifier requires development dependencies and Playwright Chromium. It extracts the package into a temporary directory, verifies file identities, starts the packaged server and runs the four existing deployment browser checks. It then selects the packaged `before.pdf` and `after.pdf` through the file inputs and checks amounts, dates and source highlights. It stops that server and removes the extracted temporary directory when finished.

The result records automated checks. Actual user trials, business samples, ordinary office computers, complete memory requirements and company-environment acceptance retain their own records.
