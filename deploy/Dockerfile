ARG NODE_IMAGE=node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
FROM rust:1.93.0-slim-bookworm@sha256:776861219cd851131c1cec3bbd7cbeb16b99a794048097eb69ad9682a8ed0d57 AS rust-core
WORKDIR /core
RUN rustup target add wasm32-unknown-unknown
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --locked --release --target wasm32-unknown-unknown && mkdir /rust-licenses && \
    for dir in /usr/local/cargo/registry/src/*/*; do \
      name=$(basename "$dir"); mkdir -p "/rust-licenses/$name"; \
      find "$dir" -maxdepth 1 -type f \( -iname 'license*' -o -iname 'notice*' -o -iname 'copying*' \) -exec cp {} "/rust-licenses/$name/" \;; \
    done
RUN cargo metadata --format-version 1 --locked > /rust-licenses/cargo-metadata.json

FROM ${NODE_IMAGE} AS build
ARG ENGINE
ARG RELEASE_ID
ARG REVISION
ARG CONTACT
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.pdfjs.json tsconfig.mupdf.json vite.config.ts ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY engines/${ENGINE} ./engines/${ENGINE}
RUN pnpm --dir engines/${ENGINE} install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY scripts/release-config.ts ./scripts/release-config.ts
COPY scripts/core-artifact.ts ./scripts/core-artifact.ts
COPY --from=rust-core /core/target/wasm32-unknown-unknown/release/policy_compare_core.wasm ./packages/rust-core/generated/core.wasm
COPY --from=rust-core /rust-licenses ./packages/rust-core/generated/licenses
RUN pnpm exec tsx scripts/core-artifact.ts
RUN test -n "$ENGINE" && test -n "$RELEASE_ID" && test -n "$REVISION"
RUN POLICY_RELEASE_ID=${RELEASE_ID} POLICY_REVISION=${REVISION} POLICY_CONTACT="${CONTACT}" pnpm exec tsc -p tsconfig.${ENGINE}.json --noEmit && POLICY_ENGINE=${ENGINE} POLICY_RELEASE_ID=${RELEASE_ID} POLICY_REVISION=${REVISION} POLICY_CONTACT="${CONTACT}" pnpm exec vite build

FROM ${NODE_IMAGE}
ARG ENGINE
ARG RELEASE_ID
ARG REVISION
LABEL org.opencontainers.image.revision=${REVISION} org.opencontainers.image.version=${RELEASE_ID} org.policy.engine=${ENGINE}
WORKDIR /app
COPY --from=build /build/dist/${ENGINE} ./dist
COPY deploy/server.mjs ./server.mjs
RUN chmod -R a=rX /app
ENV HOST=0.0.0.0 PORT=8080 STATIC_ROOT=/app/dist NODE_ENV=production
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
