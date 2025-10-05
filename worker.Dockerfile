FROM node:20-alpine AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED 1
RUN apk add --no-cache libc6-compat curl wget bash openssl

# Install pnpm
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm i --frozen-lockfile

# Generate Prisma client
RUN pnpm prisma generate

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 workeruser

# Copy dependencies and generated Prisma client
COPY --from=deps --chown=workeruser:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=workeruser:nodejs /app/src/generated ./src/generated

# Copy application files
COPY --chown=workeruser:nodejs package.json pnpm-lock.yaml ./
COPY --chown=workeruser:nodejs prisma ./prisma
COPY --chown=workeruser:nodejs worker.ts ./
COPY --chown=workeruser:nodejs src ./src
COPY --chown=workeruser:nodejs tsconfig.json ./

USER workeruser

CMD ["pnpm", "run", "worker"]