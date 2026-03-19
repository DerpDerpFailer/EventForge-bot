# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

# OpenSSL est requis par Prisma
RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 botgroup && \
    adduser --system --uid 1001 botuser

WORKDIR /app

# Copie directement avec le bon propriétaire (évite un chown -R lent)
COPY --from=builder --chown=botuser:botgroup /app/dist ./dist
COPY --from=builder --chown=botuser:botgroup /app/node_modules ./node_modules
COPY --from=builder --chown=botuser:botgroup /app/prisma ./prisma
COPY --from=builder --chown=botuser:botgroup /app/package.json ./package.json
COPY --chown=botuser:botgroup src/locales/*.json ./dist/locales/

USER botuser

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
