# Cloudflare Pages deployment

The independent project is `huaweidata-compare`, with the public entry at `https://compare.huaweidata.com/`. This directory contains hosting templates. `scripts/package-cloudflare.ts` generates a deployable directory from a checked image. The recorded startup-revision candidate is `r21-startup-a1`, built from application source `14a2467d97937c7cca979390d4665d07af65d61c`. English templates in the repository do not change an existing deployment until a new package is published.

The original `r20-a3-mupdf` resources and failure records are retained. The first deployment and subsequent CLI hosting revision were `292f37c2-9253-46f6-96e1-24dcd1b4dd75` and `3350dadc-9f46-4b85-b0e0-7fd8e33309b2`. See the [original publication record](../../reports/public-pilot/r20-a3-mupdf/README.md) and [startup revision record](../../reports/public-pilot/startup-followup/README.md).

## Generate the deployment directory

Use Node.js 24 LTS, pnpm 10.12.1 and a running Docker service. The candidate image and its `container.json` must identify the same frozen source and pass the existing container checks. The commands below use the illustrative new English release ID `r-english-example`; choose an unused release ID and fresh output/report directories for the actual candidate.

```sh
POLICY_RELEASE_ID=r-english-example \
POLICY_REPORT_DIR=reports/public-pilot/r-english-example/candidate \
POLICY_BROWSER_CHANNEL=bundled \
pnpm test:container mupdf
```

Build the new candidate from the actual checked-out English source commit and verify its resource manifest. Preserve existing candidate image IDs instead of replacing their identity with a reused tag. Historical Chinese candidates require the matching source and test revision when rerunning their browser checks; current tests expect English controls.

The packaging script takes the previously verified site as input and retains its source materials and original version path. The output directory must not already exist.

```sh
pnpm exec tsx scripts/package-cloudflare.ts \
  reports/public-pilot/r-english-example/candidate/container.json \
  delivery/public-pilot-r20-a3-mupdf/site \
  delivery/public-pilot-r-english-example/site
```

The script checks all 117 files in the previous directory, extracts the new resources from the fixed candidate image, then verifies each resource against the candidate manifest. It adds hosting templates, the current entry page, corresponding project source, Rust dependency source with the same Cargo.lock, notices and build instructions. Complete upstream MuPDF and JavaScript dependency sources are reused from the verified materials. The `package.json` beside the output records every site file's hash.

The source-download page is generated in English from the archive manifest. This changes the page and its current site hash; it does not rewrite source archives or the original release resources.

If the previous directory is unavailable locally, use its retained fixed deployment URL as the second argument. The script downloads and checks files against the committed manifest.

```sh
NODE_USE_ENV_PROXY=1 pnpm exec tsx scripts/package-cloudflare.ts \
  reports/public-pilot/r-english-example/candidate/container.json \
  https://3350dadc.huaweidata-compare.pages.dev/ \
  delivery/public-pilot-r-english-example/site
```

The fixed deployment includes large source archive parts. The script allows up to 300 seconds per file and writes the site manifest only after packaging completes. This recovery timeout is separate from the application's engine-startup deadline.

## Check and publish

```sh
WRANGLER_SEND_METRICS=false pnpm dlx wrangler@4.158.0 pages dev \
  delivery/public-pilot-r-english-example/site --port 8093 --ip 127.0.0.1
```

Run `pnpm verify:deployment tests/browser/deployment.spec.ts` against the local preview. Set `POLICY_BASE_URL` to the new version path under `http://127.0.0.1:8093/`, use the actual release ID and verified manifest SHA-256, and choose a fresh report directory. The [pilot task guide](../../docs/public-pilot.md#before-publication) shows the equivalent public check with explicit candidate binding.

The recorded publication used Wrangler's official device login for the required Pages permissions. Authenticate for the current environment as needed, then publish the generated directory to the independent project's production branch.

```sh
WRANGLER_SEND_METRICS=false \
CLOUDFLARE_ACCOUNT_ID=7bd4a486d159295357a217bd714c1462 \
pnpm dlx wrangler@4.158.0 pages deploy \
  delivery/public-pilot-r-english-example/site \
  --project-name huaweidata-compare --branch main
```

Record the deployment ID and check both the fixed deployment URL and the custom domain. Run the four deployment checks from the matching English source revision and record first load and first comparison. Check build manifests, actual file hashes and isolation headers for both the new and retained versions. The main `huaweidata` site's deployment is maintained separately.

## Restore a previous deployment

The old `/releases/r20-a3-mupdf/` path is retained for direct comparison. To restore the entire recorded site, choose deployment `3350dadc-9f46-4b85-b0e0-7fd8e33309b2` in the Pages project's Deployments list and use Rollback. Recheck the custom domain and the original candidate manifest afterward.

Alternatively, restore the previous directory from its fixed deployment URL and committed manifest, then upload that directory with Wrangler. The original `_headers` content is retained as `open-source/hosting-headers.txt`; `_redirects` uses the original health-check mapping.

## Response headers and source materials

`_headers` configures CSP, COOP, COEP, nosniff, Referrer-Policy and version-resource caching. HTML uses `no-transform` to prevent Cloudflare from rewriting it to inject analytics. WASM retains its configured transfer compression. The actual hosting headers are served as `open-source/hosting-headers.txt`.

The recorded public releases use the authorized AGPL version 3 or later distribution terms. `LICENSE`, `NOTICE` and `DISTRIBUTION-NOTICE.txt` identify the license, modifications and grant scope. Each candidate's manifest and source archive identify its exact commit. Retain the full upstream MuPDF archive parts. The original candidate's evidence records the byte comparison of the native WASM against the official npm package.

See the [pilot task guide](../../docs/public-pilot.md). Actual participants, business samples, ordinary-device performance, complete memory requirements and organizational environments are recorded separately. Issue #19 remains open unless its acceptance requirements are explicitly resolved.
