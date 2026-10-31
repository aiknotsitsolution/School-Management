# syntax=docker/dockerfile:1.7

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Install the root package dependencies required by the local file:../.. package.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund --prefer-offline \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 --fetch-timeout=300000

COPY shared/package.json shared/package-lock.json ./shared/
WORKDIR /app/shared
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund --prefer-offline \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 --fetch-timeout=300000

WORKDIR /app
COPY shared/ ./shared/

# Copy api-gateway source
COPY api-gateway/package.json api-gateway/package-lock.json ./api-gateway/

WORKDIR /app/api-gateway
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund --prefer-offline \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 --fetch-timeout=300000
COPY api-gateway/ ./

EXPOSE 5000
USER node
CMD ["node", "src/index.js"]
