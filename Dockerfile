# Aurora RSS Reader - Docker Image
# Multi-stage build for frontend + backend

# ============================================
# Stage 1: Build Frontend (Vue 3)
# ============================================
FROM node:20-bookworm AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy frontend package files
COPY rss-desktop/package.json rss-desktop/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY rss-desktop/ ./

# Build frontend for web (not electron)
RUN pnpm build:web

# ============================================
# Stage 2: Build Backend (Node.js + Fastify)
# ============================================
FROM node:20-bookworm AS backend-builder

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy backend package files
COPY backend-node/package*.json ./

# Install dependencies (including native modules)
RUN npm ci

# Copy backend source
COPY backend-node/ ./

# Build TypeScript
RUN npm run build

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:20-bookworm-slim

# Install nginx, curl and runtime dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend build and node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create data directory
RUN mkdir -p /data

# Environment variables
ENV NODE_ENV=production \
    API_HOST=127.0.0.1 \
    API_PORT=15432 \
    DATABASE_PATH=/data/aurora-rss.db

# Expose port (nginx)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:15432/health || exit 1

# Start services
CMD ["/app/start.sh"]
