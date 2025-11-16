# syntax=docker/dockerfile:1

FROM imbios/bun-node:1-22-debian AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y libc6 curl wget bash openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

# Copy package files and prisma schema
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install dependencies with cache mount
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

# Build arguments
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT

ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}

ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
ARG NEXT_PUBLIC_MIDTRANS_BASE_URL
ARG NEXT_PUBLIC_MIDTRANS_API_BASE_URL

ENV NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
ENV NEXT_PUBLIC_MIDTRANS_BASE_URL=${NEXT_PUBLIC_MIDTRANS_BASE_URL}
ENV NEXT_PUBLIC_MIDTRANS_API_BASE_URL=${NEXT_PUBLIC_MIDTRANS_API_BASE_URL}

# Build with Next.js cache mount
RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    --mount=type=cache,id=next-build-cache,target=/app/.next/cache \
    bun run build

FROM oven/bun:1-debian AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD sh -c "bunx prisma migrate deploy && node server.js"
