# syntax=docker/dockerfile:1.7

############################
# 1. deps — install full deps (native modules need build tools)
############################
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++ libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

############################
# 2. build — compile TypeScript
############################
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

############################
# 3. prod-deps — only runtime deps, with native modules rebuilt for alpine
############################
FROM node:20-alpine AS prod-deps

RUN apk add --no-cache python3 make g++ libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

############################
# 4. runner — final minimal image
############################
FROM node:20-alpine AS runner

RUN apk add --no-cache tini wget

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/dist          ./dist
COPY package.json ./

# Pre-create the uploads directory owned by the `node` user. This is the
# mount point of the named Docker volume in docker-compose; without this
# the volume would be created as root:root and the runtime would crash
# trying to persist licence/insurance/avatar files.
RUN mkdir -p /app/uploads/licenses /app/uploads/insurance /app/uploads/avatars \
 && chown -R node:node /app/uploads

EXPOSE 3001

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
