# Build stage — installs all deps (incl. dev, needed for tsc/tsx/drizzle-kit
# at both build and runtime, since migrate/seed run via tsx in the container).
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared ./packages/shared
RUN npm run build -w @cinema/shared

COPY packages/server ./packages/server
RUN npm run build -w @cinema/server

# Runtime stage
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/server ./packages/server

WORKDIR /app/packages/server
EXPOSE 3000

RUN chmod +x docker-entrypoint.sh

# Runs migrate+seed, then starts in --mode=server-with-sweep by default. Override with
# `--mode=server` / `--mode=sweep` (via `docker run <image> --mode=...` or a
# compose `command:` override) to split the HTTP server and the background
# sweeper into separate containers.
ENTRYPOINT ["./docker-entrypoint.sh"]
