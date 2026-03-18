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

WORKDIR /app

RUN addgroup --system --gid 1001 botgroup && \
    adduser --system --uid 1001 botuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Copy locale files (resolved from dist)
COPY src/locales/*.json ./dist/locales/

USER botuser

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
