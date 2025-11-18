FROM oven/bun:alpine AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat curl wget bash openssl

FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Generate Prisma client
RUN bunx prisma generate

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV QUEUE_NAME=all

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workeruser

# Copy dependencies and generated Prisma client
COPY --from=deps --chown=workeruser:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=workeruser:nodejs package.json bun.lock ./
COPY --chown=workeruser:nodejs prisma ./prisma
COPY --chown=workeruser:nodejs src ./src
COPY --chown=workeruser:nodejs tsconfig.json ./
COPY --chown=workeruser:nodejs worker.ts ./

USER workeruser

CMD ["bun", "run", "worker"]
