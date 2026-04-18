# syntax=docker/dockerfile:1.7

############################
# 1. builder — install deps + generate static SPA
############################
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat git \
 && corepack enable \
 && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# --- Build-time public configuration ---
# Empty defaults = same-origin (nginx proxies /api and /socket.io to backend)
ARG NUXT_PUBLIC_API_BASE=""
ARG NUXT_PUBLIC_SOCKET_URL=""
ARG NUXT_PUBLIC_MAPBOX_TOKEN=""

ENV NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE} \
    NUXT_PUBLIC_SOCKET_URL=${NUXT_PUBLIC_SOCKET_URL} \
    NUXT_PUBLIC_MAPBOX_TOKEN=${NUXT_PUBLIC_MAPBOX_TOKEN} \
    NODE_ENV=production

RUN pnpm run generate

############################
# 2. runner — nginx serving the static output + reverse-proxying API
############################
FROM nginx:1.27-alpine AS runner

RUN apk add --no-cache wget

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/.output/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
