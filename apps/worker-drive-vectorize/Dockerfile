FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker-drive-vectorize/package.json ./apps/worker-drive-vectorize/
COPY packages/db/package.json ./packages/db/
COPY packages/qdrant/package.json ./packages/qdrant/
COPY packages/redis/package.json ./packages/redis/
COPY packages/typescript-config/ ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

COPY apps/worker-drive-vectorize ./apps/worker-drive-vectorize
COPY packages/db ./packages/db
COPY packages/qdrant ./packages/qdrant
COPY packages/redis ./packages/redis

RUN pnpm --filter @repo/db build && \
  pnpm --filter @repo/qdrant build && \
  pnpm --filter @repo/redis build && \
  pnpm --filter worker-drive-vectorize build

FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker-drive-vectorize/package.json ./apps/worker-drive-vectorize/
COPY packages/db/package.json ./packages/db/
COPY packages/qdrant/package.json ./packages/qdrant/
COPY packages/redis/package.json ./packages/redis/
COPY packages/typescript-config/ ./packages/typescript-config/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/worker-drive-vectorize/dist ./apps/worker-drive-vectorize/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/qdrant/dist ./packages/qdrant/dist
COPY --from=builder /app/packages/redis/dist ./packages/redis/dist

ENV NODE_ENV=production

CMD ["node", "apps/worker-drive-vectorize/dist/index.js"]
