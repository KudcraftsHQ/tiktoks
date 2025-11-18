FROM oven/bun:alpine AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat curl wget bash openssl

FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma

# Create src directory for Prisma generation
RUN mkdir -p src/generated

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Generate Prisma client (outputs to src/generated/prisma)
RUN bunx prisma generate

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV QUEUE_NAME=all

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workeruser

# Copy dependencies from deps stage
COPY --from=deps --chown=workeruser:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=workeruser:nodejs package.json bun.lock ./
COPY --chown=workeruser:nodejs prisma ./prisma
COPY --chown=workeruser:nodejs src ./src
COPY --chown=workeruser:nodejs tsconfig.json ./
COPY --chown=workeruser:nodejs worker.ts ./

# Copy generated Prisma client from deps stage (after src copy to avoid overwrite)
COPY --from=deps --chown=workeruser:nodejs /app/src/generated ./src/generated

USER workeruser

CMD ["bun", "run", "worker"]
