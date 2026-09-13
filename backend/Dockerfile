# ── Build stage ────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# ── Runtime stage ───────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Install curl for health check and su-exec for safe privilege drop
RUN apk add --no-cache curl su-exec

WORKDIR /app

# Copy installed deps from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Create uploads and data directories
RUN mkdir -p /app/uploads/audio /app/uploads/artwork /data/digital-products

# Create non-root user
RUN addgroup -S canopus && adduser -S canopus -G canopus
RUN chown -R canopus:canopus /app /data

# Entrypoint script ensures volume mounts are owned by canopus, then drops privileges
RUN printf '#!/bin/sh\nset -e\nmkdir -p /app/uploads/audio /app/uploads/artwork /data/digital-products\nchown -R canopus:canopus /app/uploads /data\nexec su-exec canopus "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE ${BACKEND_PORT:-8000}

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fs http://localhost:${BACKEND_PORT:-8000}/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]

