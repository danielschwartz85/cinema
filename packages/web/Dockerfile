# Build stage — compiles @cinema/shared then bundles the React app with Vite.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/web/package.json packages/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared ./packages/shared
RUN npm run build -w @cinema/shared

# Baked into the bundle at build time — import.meta.env.VITE_API_URL is
# inlined by Vite, so this must point at wherever the API is reachable from
# the *browser*, not from inside this container.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

COPY packages/web ./packages/web
RUN npm run build -w @cinema/web

# Runtime stage — static files served by nginx.
FROM nginx:alpine
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
