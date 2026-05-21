# Stage 1: Build the browser widget
FROM node:20-slim AS widget-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY src/widget ./src/widget
COPY tsconfig.json ./
RUN npm run build:widget

# Stage 2: Pull Litestream and Caddy binaries from official images
FROM litestream/litestream:0.3.13 AS litestream
FROM caddy:2.9.1 AS caddy

# Stage 3: Production image
FROM node:20-slim AS runner
WORKDIR /app

# Copy binaries from official images
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates procps && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies (no lockfile so npm resolves for the container platform)
COPY package.json ./
RUN npm install --omit=dev

# Copy application source and built widget
COPY src ./src
COPY tsconfig.json ./
COPY --from=widget-builder /app/public ./public

# Copy Litestream config
COPY litestream.yml ./

# Create data directory
RUN mkdir -p /data

VOLUME ["/data"]
EXPOSE 3000 80 443

# Copy and set entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
