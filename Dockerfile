# Stage 1: Build the browser widget
FROM node:20-slim AS widget-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY src/widget ./src/widget
COPY tsconfig.json ./
RUN npm run build:widget

# Stage 2: Production image
FROM node:20-slim AS runner
WORKDIR /app

# Install Litestream
RUN apt-get update && apt-get install -y curl ca-certificates && \
    LITESTREAM_VERSION=v0.3.13 && \
    ARCH=$(dpkg --print-architecture) && \
    curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin litestream && \
    apt-get remove -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

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
