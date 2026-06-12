# syntax=docker/dockerfile:1

# ── Etapa 1: compilación (NestJS → dist/) ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Etapa 2: runtime (solo dependencias de producción) ──
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 8080

# Healthcheck con el wget de busybox (incluido en alpine).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT:-8080}/health" >/dev/null 2>&1 || exit 1

USER node
CMD ["node", "dist/main"]
