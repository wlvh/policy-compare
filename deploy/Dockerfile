FROM node:24.22.1-alpine AS build
ARG ENGINE=pdfjs
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
RUN pnpm build:${ENGINE}

FROM node:24.22.1-alpine
ARG ENGINE=pdfjs
WORKDIR /app
COPY --from=build /build/dist/${ENGINE} ./dist
COPY deploy/server.mjs ./server.mjs
RUN chmod -R a=rX /app
ENV HOST=0.0.0.0 PORT=8080 STATIC_ROOT=/app/dist NODE_ENV=production
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
