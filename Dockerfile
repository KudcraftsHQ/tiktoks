FROM node:20-alpine AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED 1
RUN apk add --no-cache libc6-compat curl wget bash openssl

# Install pnpm
RUN npm install -g pnpm
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm i --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

# Public env
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
ARG NEXT_PUBLIC_MIDTRANS_BASE_URL
ARG NEXT_PUBLIC_MIDTRANS_API_BASE_URL

ENV NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
ENV NEXT_PUBLIC_MIDTRANS_BASE_URL=${NEXT_PUBLIC_MIDTRANS_BASE_URL}
ENV NEXT_PUBLIC_MIDTRANS_API_BASE_URL=${NEXT_PUBLIC_MIDTRANS_API_BASE_URL}

RUN pnpm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["/bin/bash", "/app/scripts/start.sh"]
