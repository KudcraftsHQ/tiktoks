FROM node:20-alpine AS base

# Disabling Telemetry
ENV NEXT_TELEMETRY_DISABLED 1
RUN apk add --no-cache libc6-compat curl wget bash

# Install pnpm
RUN npm install -g pnpm
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public env
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

USER nextjs

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Set default command if not provided
ENV COMMAND_TO_RUN=run-background-pipeline-worker

CMD pnpm run ${COMMAND_TO_RUN}