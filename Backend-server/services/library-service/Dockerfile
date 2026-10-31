# syntax=docker/dockerfile:1.7

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

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

COPY services/library-service/package.json services/library-service/package-lock.json ./services/library-service/

WORKDIR /app/services/library-service
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund --prefer-offline \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 --fetch-timeout=300000
COPY services/library-service/ ./

EXPOSE 5007
USER node
CMD ["node", "src/index.js"]
