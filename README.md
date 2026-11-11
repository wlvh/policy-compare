# Policy Compare: user guide

Compare a baseline PDF with a revised PDF, inspect text, amount and clause changes, and follow each change back to its source. PDFs are processed in your browser and are not uploaded. The tool does not recognize text in scanned images. **This is an evaluation tool that requires human review; its output is not a complete policy-review conclusion.**

The formal comparison path supports English documents and uses one generic Rust core, with no document profile or aviation field dictionary. Detected non-English or unconfirmed language ranges retain their original text and receive explicit coverage warnings; those results are partial. This is a lightweight scope check, not general language identification. See the [Issue #24 implementation and acceptance report](reports/issue-24/README.md). Historical reports and some developer documentation remain in Chinese.

## Get and run the current version

To copy a built application to another computer, use a [current runtime package](docs/runtime-packages.md). Each package includes the web application, a local server and sample PDFs. The receiving computer does not need the source-build tools.

To build the latest code, use **the `main` source**. The historical downloads linked below identify commit `1ce93d4` and do not include subsequent changes. Merging source does not automatically update downloadable packages or the public website.

The source-build commands below are for **macOS/Linux**. Native Windows source builds have not been verified; the current scripts use macOS/Linux command syntax. Use a supported browser such as Chrome.

1. Install **Node.js 24**, **pnpm 10.12.1** and **Rust 1.93.0** with the `wasm32-unknown-unknown` target. Select **24.x** from the [Node.js downloads](https://nodejs.org/en/download), then reopen your terminal. Check the versions; if the specified pnpm version is missing, install it using npm:

   ```sh
   node --version
   npm install --global pnpm@10.12.1
   pnpm --version
   ```

   The first command should print `v24.x.x`, and the last should print `10.12.1`. If you already have those versions, you do not need to reinstall them. See the [pnpm installation instructions](https://pnpm.io/installation) if needed. With [rustup](https://rustup.rs/) installed, prepare the toolchain pinned in [rust-toolchain.toml](rust-toolchain.toml):

   ```sh
   rustup toolchain install 1.93.0 --profile minimal --target wasm32-unknown-unknown
   ```

2. Download and extract the [main source ZIP](https://github.com/wlvh/policy-compare/archive/refs/heads/main.zip). Use this link to select `main` explicitly. The public repository does not require a GitHub login to download its source.
3. Open a terminal in the extracted **`policy-compare-main` directory**, which contains `package.json`. For example, after extracting to Downloads on macOS, run `cd "$HOME/Downloads/policy-compare-main"`. Adjust the path to your location. If you obtained the source with Git, use the repository root.
4. Install dependencies, build and start the PDF.js version in order. Resolve any error before continuing:

   ```sh
   pnpm install --frozen-lockfile
   pnpm install:pdfjs
   pnpm build:pdfjs
   pnpm preview:pdfjs --port 8080 --strictPort
   ```

5. Once the terminal prints the local address, open **http://127.0.0.1:8080/**. The page header should identify `pdfjs`. Keep the terminal open while using the tool. Press **Ctrl+C** in that terminal to stop the server; closing the browser does not stop it. Do not open `index.html` directly.

The first setup downloads dependencies. On later visits, run only the final preview command from the same directory. After updating source, stop the old server, repeat installation and build, restart it, and load both PDFs again.

### Compare with the MuPDF version

Both versions use the same interface and comparison core; they read PDFs with different engines. After installing root dependencies, open another terminal in the same source directory and run:

```sh
pnpm install:mupdf
pnpm build:mupdf
pnpm preview:mupdf --port 8082 --strictPort
```

Open **http://127.0.0.1:8082/** and check that the header identifies `mupdf`. Use the same pair of files to compare results. Results from either engine still need source review.

## Local trial and deployment

After installing the selected engine, developers can run `pnpm start:local mupdf 8080` or `pnpm start:local pdfjs 8082`. The launcher checks tools and the port, then opens the browser. The first screen provides fictional P02 amount-change, P01 identical-file and E03 scanned-image samples, instructions, version information, loading recovery and an explicit diagnostics download.

The public pilot is documented at [compare.huaweidata.com](https://compare.huaweidata.com/). Check the release shown on the page: the deployed candidate may differ from `main`. See the [pilot task guide](docs/public-pilot.md) and [Cloudflare deployment guide](deploy/cloudflare/README.md).

For Issue #17 version paths, browser checks against actual candidate containers, OpenShift templates, publication and rollback, see the [deployment guide](docs/deployment.md). Public hosting does not establish that the application has passed company-network, OpenShift or designated-user acceptance.

The [release-image trial procedure](docs/release-image-testing.md) reuses a checked image. After the automated container checks pass, run `pnpm preview:release <path-to-container.json> 8088` to try that exact image locally with Docker and record observations. A Red Hat account is not required. Manual review and actual OpenShift verification are recorded separately.

## Complete a comparison

1. Select the older PDF under **01 Baseline** and the newer PDF under **02 Revised**. Enter each password in its corresponding field if needed. Each file may contain up to **100 pages** and be up to **30 MiB**.
2. Click **Compare**. Changes appear on the left, with both source documents on the right.
3. Read the processing status first. If **Areas to review** appears in yellow, open its entries to inspect content that was not compared or whose correspondence is unresolved. One entry can cover several locations; review additional pages when needed.
4. Select a change and inspect both highlights. Red marks baseline text that was deleted or replaced; green marks revised text that was inserted or replaced. Check which record and column an amount belongs to. Toggle **Synchronized scrolling** to inspect each side independently. **(none)** means that side has no direct source for the change. With synchronization enabled, **Reference position** follows an available text match; pagination can differ between versions. The reference side has no change highlight. If no text match exists, the tool explicitly identifies a page-number reference. With synchronization disabled, that side stays on its current page.
5. Use **Search source text** to find original wording and the filter to select change types. Return to **All changes** before finishing so that filtered cards are not overlooked.
6. Click **Export JSON** to save the result, and keep both original PDFs. Click **Close task** when done. After replacing files, click **Compare** again.

### Three samples for your first trial

These fictional PDFs are included in the source. Place **`before.pdf` on the baseline side and `after.pdf` on the revised side**. Start with P02 to try navigation, search and export, then examine the other two outcomes.

| Sample directory | What to check |
|---|---|
| [P02: amount change](validation/synthetic-review-20261030/cases/P02) | The `USD 100 → USD 2000` change for 1315 is visible and locatable. The `USD 1000` amount for 1760 is unchanged. Inspect the highlighted row, search for `1315`, then export JSON. |
| [P01: identical files](validation/synthetic-review-20261030/cases/P01) | The files are byte-identical, so there should be no content-change cards. |
| [E03: scanned images](validation/synthetic-review-20261030/cases/E03) | An amount change is visible in the images, but there is no text layer. The tool must state that the page's body text has not been compared. Zero text-change cards does not mean the documents are unchanged. |

These samples introduce the controls and coverage messages; they do not establish full acceptance. See the [17-pair sample description](validation/synthetic-review-20261030/README.md) and [first-run results](reports/synthetic-review-20261030-run1/README.md) for their recorded scope.

Two more complex fictional renewal pairs are in the [renewal test-file directory](https://github.com/jiehuan/falcon-mini/tree/0eef67dd6cbe477ab625885220686c674640fb88/testdata/renewal). Download `left.pdf` (baseline) and `right.pdf` (revised) from the same subdirectory; `changes.md` records the author's expected changes. These cases have split cards and unevaluated areas. They require manual review and do not replace a trial with real business documents.

## Interpret results and limitations

| Status | Meaning |
|---|---|
| Processing complete | No coverage gaps or unresolved matches were recorded. Review the changes for correctness; unknown omissions may still exist. |
| Processing complete · Gaps or unresolved matches recorded | Some content was not fully read or reliable correspondence was not established. Inspect **Areas to review** as well as the change list. |
| Processing failed | Processing did not finish normally. Read the error and check the files. |

**Card count does not indicate business importance. No cards does not always mean no changes. A green processing status does not establish that every highlight or record association is correct.** The tool makes no business or legal conclusions.

The review recorded on 2026-10-30 identified the following limitations. The linked evidence retains its original version and scope:

- **Some tables split records across cards.** For example, P10 separates an amount from its record number. Automatic ownership evidence is insufficient; inspect the original rows and columns.
- **Incorrect highlights were confirmed.** In P11, the unchanged `USD` prefix in row 789's `USD 3000` was marked as deleted with both engines, while the actual change remained visible. See the [source details and screenshots](reports/synthetic-review-20261030-run1/README.md).
- **Page-number fact labels can be incorrect.** For example, `Policy wording - Page # → Policy wording - Page 4` must not be dismissed solely because a label suggests a page-number-only change.
- **Cross-page content, whole-row reordering and complex renewal correspondence have unevaluated areas. Scanned-image text is not compared.** A single yellow entry may require inspecting more than its first linked location.

Completed engineering work and [acceptance evidence](reports/issue-2-amount-binding/README.md) retain their recorded scope. They do not establish that every strict requirement passed, and do not replace business acceptance or performance checks on designated devices.

## Troubleshoot startup

| Symptom | Action |
|---|---|
| `node` or `pnpm` is missing or has the wrong version | Install the versions above, reopen the terminal, then check `node --version` and `pnpm --version`. |
| Rust or the WASM target is missing | Install the pinned Rust toolchain and target using the `rustup` command above, then rebuild. |
| `package.json` cannot be found | Open the terminal in the extracted source root before running commands. |
| The browser cannot open the local address | Check that the server is still running and that the address and port match the terminal output. |
| Port 8080 is in use | Use the existing instance if it is this application, or run `pnpm preview:pdfjs --port 8083 --strictPort` and open http://127.0.0.1:8083/. |
| The build directory is missing | Complete root dependency installation, selected-engine installation and `pnpm build:pdfjs` or `pnpm build:mupdf`. |
| A source or runtime download returns 404 or access denied | Check the source or historical download link above. If it still fails, ask the maintainer to confirm the link and repository access. |

## Share the tool and give feedback

The local setup runs **on each user's own computer**. `127.0.0.1` refers to the visitor's computer; sending someone your local URL does not give them access to your server. To use a shared address, open the public pilot or have a maintainer configure and verify a separate HTTPS deployment with the required response headers. Comparison still runs in each visitor's browser.

Submit feedback through [GitHub Issues](https://github.com/wlvh/policy-compare/issues/new), or give it to the maintainer who supplied the tool. Include:

- The engine (`pdfjs` or `mupdf` in the header), source or runtime download location and date. For a Git checkout, include `git rev-parse HEAD`.
- File names or sample ID, page numbers on both sides, the relevant record and column, the expected change and what the application showed.
- Screenshots and exported JSON that you are permitted to share. JSON contains source text and core/extraction-engine versions. Apply the same document-sharing permissions to the original PDFs.

## Historical runtime packages

The [review-20261026-fixes release](https://github.com/wlvh/policy-compare/releases/tag/review-20261026-fixes) provides [PDF.js](https://github.com/wlvh/policy-compare/releases/download/review-20261026-fixes/policy-compare-pdfjs.tar.gz) and [MuPDF](https://github.com/wlvh/policy-compare/releases/download/review-20261026-fixes/policy-compare-mupdf.tar.gz) packages for `1ce93d4`. Versions and hashes are in the [delivery manifest](DELIVERY_MANIFEST.json). These are retained for historical review and do not represent current `main`.

They require Node.js 24 but not pnpm or source dependencies. Extract a package, run `node server.mjs` from the directory containing that file, and open http://127.0.0.1:8080/. Use its `samples/before.pdf` and `samples/after.pdf` to try the historical version.

Production comparison and source-text search run in the Rust WASM core. See [Rust core build and verification](docs/rust-core.md) and [Issue #19 evidence](reports/issue-19/README.md).
