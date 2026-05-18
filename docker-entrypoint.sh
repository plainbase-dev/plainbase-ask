#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/data/db.sqlite}"
VEC_DB_PATH="${VEC_DATABASE_PATH:-/data/vec.sqlite}"

mkdir -p "$(dirname "$DB_PATH")" "$(dirname "$VEC_DB_PATH")"

# If DOMAIN is set, start Caddy to handle TLS termination
if [ -n "$DOMAIN" ]; then
  mkdir -p /data/caddy
  cat > /tmp/Caddyfile <<EOF
{
  storage file_system /data/caddy
}

$DOMAIN {
  reverse_proxy localhost:3000
}
EOF
  caddy run --config /tmp/Caddyfile &
fi

# If Litestream is configured and DBs don't exist, try to restore from S3
if [ -n "$LITESTREAM_S3_BUCKET" ]; then
  if [ ! -f "$DB_PATH" ]; then
    echo "[entrypoint] Attempting to restore db.sqlite from S3..."
    litestream restore -config /app/litestream.yml -if-replica-exists "$DB_PATH" || true
  fi
  if [ ! -f "$VEC_DB_PATH" ]; then
    echo "[entrypoint] Attempting to restore vec.sqlite from S3..."
    litestream restore -config /app/litestream.yml -if-replica-exists "$VEC_DB_PATH" || true
  fi
  # Start app wrapped by Litestream replication (uses litestream.yml for both DBs)
  exec litestream replicate -config /app/litestream.yml \
    -exec "node --import tsx/esm src/index.ts"
else
  exec node --import tsx/esm src/index.ts
fi
