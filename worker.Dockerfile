FROM oven/bun:alpine AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Pin Alpine package versions for cache stability
# Note: These versions are compatible with Alpine 3.19 (base image's Alpine version)
RUN apk add --no-cache \
    libc6-compat~=1.2 \
    curl~=8.9 \
    wget~=1.24 \
    bash~=5.2 \
    openssl~=3.1

FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (outputs to src/generated/prisma)
RUN bunx prisma generate

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV QUEUE_NAME=all

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workeruser

# Copy dependencies and generated Prisma client
COPY --from=deps --chown=workeruser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=workeruser:nodejs /app/src/generated ./src/generated

# Copy application files
COPY --chown=workeruser:nodejs package.json bun.lock ./
COPY --chown=workeruser:nodejs prisma ./prisma
COPY --chown=workeruser:nodejs src ./src
COPY --chown=workeruser:nodejs scripts ./scripts
COPY --chown=workeruser:nodejs tsconfig.json ./
COPY --chown=workeruser:nodejs worker.ts ./

USER workeruser

CMD ["bun", "run", "worker"]
