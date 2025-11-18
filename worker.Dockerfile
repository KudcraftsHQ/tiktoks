FROM imbios/bun-node:1-22-debian AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y libc6 curl wget bash openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

# Copy Node.js for Prisma compatibility
COPY --from=node:22 /usr/local/bin/node /usr/local/bin/node

COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bun prisma generate

FROM oven/bun:1-debian AS runner
WORKDIR /app

# Copy Node.js for Prisma compatibility
COPY --from=node:22 /usr/local/bin/node /usr/local/bin/node

ENV NODE_ENV=production
ENV QUEUE_NAME=all

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 workeruser

# Copy dependencies and generated Prisma client
COPY --from=deps --chown=workeruser:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=workeruser:nodejs /app/src/generated ./src/generated

# Copy application files
COPY --chown=workeruser:nodejs package.json bun.lock ./
COPY --chown=workeruser:nodejs prisma ./prisma
COPY --chown=workeruser:nodejs worker.ts ./
COPY --chown=workeruser:nodejs src ./src
COPY --chown=workeruser:nodejs scripts ./scripts
COPY --chown=workeruser:nodejs tsconfig.json ./

USER workeruser

CMD ["bun", "run", "worker"]
