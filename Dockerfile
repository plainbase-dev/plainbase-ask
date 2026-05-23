# Stage 1: Build the browser widget
FROM node:20-slim AS widget-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY src/widget ./src/widget
COPY tsconfig.json ./
RUN npm run build:widget

# Stage 2: Pull Litestream binary from official image
FROM litestream/litestream:0.3.13 AS litestream

# Stage 3: Production image
FROM node:20 AS runner
WORKDIR /app

# Copy Litestream binary
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

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
EXPOSE 3000

# Copy and set entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
