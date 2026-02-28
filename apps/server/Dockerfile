FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/qdrant/package.json ./packages/qdrant/
COPY packages/redis/package.json ./packages/redis/
COPY packages/zod-schemas/package.json ./packages/zod-schemas/
COPY packages/typescript-config/ ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

COPY apps/server ./apps/server
COPY packages/db ./packages/db
COPY packages/qdrant ./packages/qdrant
COPY packages/redis ./packages/redis
COPY packages/zod-schemas ./packages/zod-schemas

RUN pnpm --filter @repo/zod-schemas build && \
    pnpm --filter @repo/db build && \
    pnpm --filter @repo/qdrant build && \
    pnpm --filter @repo/redis build && \
    pnpm --filter server build

FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/qdrant/package.json ./packages/qdrant/
COPY packages/redis/package.json ./packages/redis/
COPY packages/zod-schemas/package.json ./packages/zod-schemas/
COPY packages/typescript-config/ ./packages/typescript-config/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/qdrant/dist ./packages/qdrant/dist
COPY --from=builder /app/packages/redis/dist ./packages/redis/dist
COPY --from=builder /app/packages/zod-schemas/dist ./packages/zod-schemas/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
