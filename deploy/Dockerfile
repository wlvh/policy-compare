ARG NODE_IMAGE=node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
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
COPY profiles ./profiles
COPY scripts/release-config.ts ./scripts/release-config.ts
RUN test -n "$ENGINE" && test -n "$RELEASE_ID" && test -n "$REVISION"
RUN POLICY_RELEASE_ID=${RELEASE_ID} POLICY_REVISION=${REVISION} POLICY_CONTACT="${CONTACT}" pnpm build:${ENGINE}

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
