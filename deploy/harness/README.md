# Harness/OpenShift packaging based on current policy-compare main

## What is different from Owner's successful falconet pipeline?

The reusable method is **prebuild the Rust/WASM + MuPDF/React browser bundle outside the restricted OpenShift build environment**, then use approved AXA Buildah to package it with an internal Node 24 runtime image.

Do NOT copy the old fork's prebuilt/mupdf/ binaries. Its build-info.json reports revision b7610f2..., while wlvh/policy-compare/main now includes newer product commits. Do NOT copy Owner's serviceRef, environment, branch deploy-jh, connector credentials or exact image tag.

## Prepare a prebuilt release from the CURRENT application source

Use an authorized networked development/CI host with Node.js 24, pnpm 10.12.1 and Rust 1.93.0 (target wasm32-unknown-unknown). Start from a clean checkout of the intended commit after product changes have merged:

```sh
pnpm install --frozen-lockfile
pnpm install:mupdf
export POLICY_REVISION="$(git rev-parse HEAD)"
export POLICY_RELEASE_ID="r-axa-$(git rev-parse --short=10 HEAD)"
export POLICY_CONTACT="Contact the maintainer who provided this tool"
pnpm build:mupdf
rm -rf prebuilt/mupdf
mkdir -p prebuilt
cp -R dist/mupdf prebuilt/mupdf
node deploy/harness/verify-prebuilt.mjs --check-source
git add prebuilt/mupdf
```

Commit the resulting binary tree on a **dedicated deployment branch derived from the latest main** (e.g. deploy/axa-current). The SHA in build-info.json is the source revision *before* the prebuilt-artifact commit. This is normal; the verifier allows packaging-only commits but rejects changes to product sources relative to that SHA.

The verifier checks file hashes/sizes, extra files, release paths and any product-source changes. Git attributes prevent CRLF normalization of the prebuilt binary files. Run verification after each product-source update; it will reject stale payloads.

## Adapt our EXISTING AXA entities, do not recreate Owner's pipeline

Our code source remains falconet (mirror of wlvh/policy-compare), our existing CI pipeline is policy-compare-ci and our Service is policy-compare-svc (ID policycomparesvc). The owner example uses a *different* pipeline/service and deploy-jh branch.

| Setting | Use for the first deployment validation |
| --- | --- |
| Codebase | falconet, new deployment branch with fresh prebuilt/mupdf/ |
| CI step | approved xlc-panda-buildah Plugin, not the Kaniko step rejected by OpenShift SCC |
| Dockerfile | deploy/Dockerfile.prebuilt |
| Context | . (repository root) |
| Output registry | existing authorized policy-compare Artifactory path |
| Image tag | unique immutable tag; CD must reference exactly the pushed tag |
| Build arguments | none required; only the Node 24 image is pulled by the prebuilt Dockerfile |
| Service manifest | K8sManifest from deploy/harness/templates/ and deploy/harness/values.yaml on SAME deployment branch |
| ServiceRef | our existing policycomparesvc (not Owner's falconetppd) |
| Environment/Infrastructure | only the AXA environment authorized for this application |

NOTE: The existing policy-compare-ci has only a Build stage. Deployment still requires a CD stage with the same artifact tag and our Service, or a separate authorized CD pipeline. Do not copy another application's ppd environment blindly.

The Route is OFF by default in values.yaml; enabling it requires an approved internal hostname, TLS certificate and verified internal-only ingress controller selection. This prevents accidentally exposing the demo at an unreviewed default public apps domain. Internal HTTPS access is a separate acceptance step.

## Accept/stop criteria

1. Source verifier passes on the intended deployment-branch commit (no newer application source changes than build-info.json.revision).
2. Buildah packages and pushes the same tested bytes to Artifactory. There is no live Rust/npm download in the OpenShift build.
3. CD deploys the exact pushed image digest/tag, and Pod startup succeeds (the server rechecks the resource digests).
4. Authorized internal HTTPS Route returns /healthz and redirects / to /releases/<build-info.releaseId>/.
5. Browser P02 sample comparison shows USD 100 -> USD 2000.

Two different version strings exist: the Docker *image tag* identifies the CI packaging execution; build-info.json.releaseId identifies the web application compiled from a particular source. A new Docker tag alone does not refresh the web app.

Never overwrite the existing manual docs/deployment.md rolling/route resources in the same namespace unless the platform owner has approved a migration.
