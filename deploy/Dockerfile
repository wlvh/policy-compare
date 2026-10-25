FROM node:24.22.1-alpine AS build
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml tsconfig.json vite.config.ts ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY profiles ./profiles
RUN pnpm build

FROM node:24.22.1-alpine
WORKDIR /app
COPY --from=build /build/dist ./dist
COPY deploy/server.mjs ./server.mjs
RUN chmod -R a=rX /app
ENV PORT=8080 STATIC_ROOT=/app/dist NODE_ENV=production
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
