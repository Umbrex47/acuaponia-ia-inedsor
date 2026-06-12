# syntax=docker/dockerfile:1

# ── Etapa 1: build estático con Vite ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Etapa 2: servidor estático con Nginx + config en runtime ──
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Script que genera /config.js desde las variables APP_* al arrancar.
# La imagen oficial de nginx ejecuta automáticamente los *.sh de esta carpeta.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-app-config.sh
# Normaliza saltos de línea (evita fallos por CRLF de Windows) y lo hace ejecutable.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-app-config.sh \
    && chmod +x /docker-entrypoint.d/40-app-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1/config.js" >/dev/null 2>&1 || exit 1
