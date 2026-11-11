# compare.huaweidata.com: pilot task guide

The public entry is `https://compare.huaweidata.com/`, hosted in the independent Pages project `huaweidata-compare`. The startup revision recorded on 2026-11-08 is `r21-startup-a1`. See the [startup revision record](../reports/public-pilot/startup-followup/README.md) and [initial publication record](../reports/public-pilot/r20-a3-mupdf/README.md). Check the release shown on the actual page before each trial. This English guide does not establish that a new application candidate has been deployed.

The main `huaweidata` site's content, database and deployment are separate. The [original Chinese guide](public-pilot-r20.zh-CN.md) remains available as a historical record.

## Record the candidate

Keep the release ID, source commit, fixed image ID, original manifest hash and actual Rust WASM hash with the trial results. Each new release needs its own identity and relevant checks. For reference, the original candidate was:

| Item | Original candidate identity |
|---|---|
| Release | `r20-a3-mupdf` |
| Application source | `a3ad1646f4ea3eb95ec94ae493e0d5d1a593013d` |
| Image | `sha256:fee53485a33b436a3f48ca17084f2a46e128e7c3bf64655ffd758adbbd5ed998` |
| Original manifest SHA-256 | `766c5704bbeb17a8e6e7ff6e151056219c8316b96b51ce5f3d7e3a3b6c382416` |
| Rust WASM SHA-256 | `30d737bc7bcf0e7d555811aeae19834e6311c6117fc9b355d572da8f44002898` |
| Application path | `/releases/r20-a3-mupdf/` |

The original 89 application resources remain unchanged. Hosting entry pages, license access and source downloads sit outside that immutable release path. Use the startup revision record or a later candidate's actual manifest for subsequent trials; do not reuse the original identity for new code.

## Before publication

Retain the applicable project authorization, corresponding source, modification notices, original licenses and warranty disclaimer. A public GitHub repository or a third-party license file does not by itself establish the project's distribution grant. Record engineering checks of the materials separately from the copyright holder's authorization.

The independent pilot does not connect to the main site's D1 database, comments, Zaraz or analytics. Hosting still receives connection information needed to serve web resources. “PDFs are not uploaded” does not mean the host receives no information. Do not put source text or comparison results in logs or feedback forms. Check actual browser responses for injected analytics instead of assuming that the uploaded directory is the whole response.

After uploading static files, verify the temporary Pages URL before connecting the custom domain. Add the domain through Pages and follow its returned DNS settings rather than adding only a CNAME manually. Record project, deployment ID, domain status and package SHA-256. Retain earlier deployments and version paths for comparison and rollback.

Use the current deployment checks for a newly built English candidate. The release ID below is illustrative: replace it in both the URL and `POLICY_RELEASE_ID` with the actual published English release. Set `POLICY_MANIFEST_SHA256` in your shell to that candidate's verified manifest hash, and choose a fresh report directory for every run. Do not reuse a historical candidate's hash.

```sh
POLICY_BASE_URL=https://compare.huaweidata.com/releases/r-english-example/ \
POLICY_RELEASE_ID=r-english-example \
POLICY_ENGINE=mupdf \
POLICY_MANIFEST_SHA256="${POLICY_MANIFEST_SHA256:?Set the verified English candidate manifest SHA-256}" \
POLICY_REPORT_DIR=reports/public-pilot/r-english-example/external-01 \
pnpm verify:deployment tests/browser/deployment.spec.ts
```

The current browser tests expect English controls. To recheck a historical Chinese candidate such as `r20-a3-mupdf` or `r21-startup-a1`, use the source and test revision that matches that candidate. The historical records above preserve its identity and original commands; they are not targets for the current English browser assertions.

Also download each manifest resource from the actual public site and verify its SHA-256. Check WASM content type, version paths, isolation headers, caching and 404 responses. A visible homepage does not establish that the engine is ready. Record first-load download and initialization with a cold cache separately. One observation on one machine does not establish success rates or P95 timings for other networks or office computers.

## Participant tasks

Invite 5–10 people whose circumstances resemble intended use, including ordinary Windows computers with Chrome and Edge. Use anonymous participant IDs U01–U10. Keep names, contact details, real PDFs and feedback containing source text out of the repository.

The owner may share the public URL and collect feedback. A completed invitation list is not a deployment prerequisite. The initial record had zero completed participants and zero real business samples; count only actual completed, failed or abandoned attempts when updating it.

Observers should not reveal expected answers beforehand. Ask each participant to:

1. Open the site for the first time and independently compare the built-in amount-change sample.
2. Explain the amount change they found, show the original text as evidence, then try search and export.
3. Run the scanned-image sample and explain in their own words which content has not been compared.
4. Use a permitted longer or table-heavy sample. Record whether they understand what is happening while waiting, and whether review or scrolling becomes sluggish.
5. Cancel while processing, then start another comparison. Close the task and select the samples again. Do not count a click after processing finished as a successful cancellation.

Record three periods separately: opening the application until the engine is ready; starting comparison until results are reviewable; and navigation, search, scrolling and review. Record network conditions, operating system, CPU, memory, browser version and whether this was a first or repeat visit. Retain attempts that never started, failed or were abandoned. Ask every invited participant about the outcome.

Feedback needs only “what I did; what I expected; what happened” and the diagnostics download. For comparison errors, add the sample ID and both page numbers. Diagnostics contain only version, engine, browser, processing stage and error codes. Exported comparison JSON contains source text and needs the relevant sharing permission.

## Business-document samples

Use the [existing trial method](real-document-trial.zh-CN.md) and [single-pair record template](trial-record-template.zh-CN.md) for 3–5 representative pairs that are public or appropriately redacted and permitted for processing. Bind each trial to the actual Rust candidate being tested, rather than copying a historical template's product commit. These detailed templates currently remain in Chinese.

Have a reviewer record expected changes from the full original documents before looking at the application's result. Check discovery, record ownership, source locations, coverage messages and presentation comprehension separately. Distinguish “the application did not show it” from “the application showed it but the reviewer did not notice.” Newly discovered changes may be added after independent confirmation; retain the original expectation and reason for revision. Do not derive expected truth from product categories or row keys.

Fictional samples and agent-operated checks do not count as real participants, ordinary-device trials or real business-document completion.

## Finish this round

After the selected checks pass on the actual public URL, 5–10 participants have a completion, failure or abandonment record, and 3–5 document pairs have independent review, summarize issues in five areas: loading, comparison results, source location, interaction comprehension and device performance. Fix concrete problems that prevent further trials before deciding to expand participation. Bind every new product version to its own candidate and repeat affected checks.

Issue #19 retains the separate status of full-memory requirements, strict comparison rules and other recorded gaps. Company HTTPS, OpenShift, organizational permissions and endpoint policies connect to Issue #17. An observation on an authorized office computer can be recorded early, but one trial does not automatically satisfy the full environment requirements.
