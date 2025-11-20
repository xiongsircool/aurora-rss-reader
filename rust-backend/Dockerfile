# Multi-stage build for RSS Backend
FROM rust:1.75-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy source code
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -r -s /bin/false rss

# Create data directory
RUN mkdir -p /app/data && chown rss:rss /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/rss-backend /usr/local/bin/rss-backend

# Set permissions
RUN chmod +x /usr/local/bin/rss-backend

# Switch to app user
USER rss

# Create data directory for user
WORKDIR /app

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8787/ || exit 1

# Run the application
CMD ["rss-backend"]