FROM cdtank-assets:1.0.0-20261008-ui2 AS assets

FROM node:24.16.0-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY apps/ apps/
COPY scripts/build-server.mjs scripts/package-release.mjs scripts/account-snapshot.mjs scripts/
COPY deployment/ deployment/
COPY --from=assets /recovery/output/ recovery/output/
RUN npm exec -- vite build --config apps/web/vite.config.ts \
    && npm run build:server \
    && node scripts/package-release.mjs /release

FROM node:24.16.0-bookworm-slim AS dependencies
WORKDIR /dependencies
COPY --from=build /release/server/package.json /release/server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24.16.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    ACCOUNT_DB_PATH=/app/state/accounts.sqlite
COPY --from=build --chown=node:node /release/ ./
COPY --from=dependencies --chown=node:node /dependencies/node_modules/ server/node_modules/
RUN mkdir -p state && chown node:node state
USER node
EXPOSE 3001
CMD ["node", "start.mjs"]
