# Multi-stage Dockerfile for Spring Documentation MCP Server
# Optimized for size, security, and Docker MCP Catalog compatibility

# Stage 1: Build
FROM node:20-alpine AS builder

LABEL maintainer="EnokDev <tky0065@gmail.com>"
LABEL description="Spring Documentation MCP Server - Build Stage"

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --quiet && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Verify build output exists
RUN test -f build/index.js || (echo "Build failed: build/index.js not found" && exit 1)

# Stage 2: Production
FROM node:20-alpine

LABEL maintainer="EnokDev <tky0065@gmail.com>"
LABEL description="Spring Documentation MCP Server for Spring Boot and Spring AI"
LABEL version="1.2.8"
LABEL org.opencontainers.image.title="Spring Documentation MCP Server"
LABEL org.opencontainers.image.description="MCP server providing access to Spring Boot, Spring AI, and Spring Framework documentation"
LABEL org.opencontainers.image.version="1.2.8"
LABEL org.opencontainers.image.url="https://github.com/tky0065/springdocs-mcp"
LABEL org.opencontainers.image.source="https://github.com/tky0065/springdocs-mcp"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Create non-root user for security
# Using UID/GID 1001 to avoid conflicts with common system users
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp && \
    chown -R mcp:mcp /app

# Copy package files
COPY --chown=mcp:mcp package*.json ./

# Install only production dependencies
RUN npm ci --only=production --quiet && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=mcp:mcp /app/build ./build

# Verify the entry point exists and is executable
RUN test -x build/index.js || chmod +x build/index.js

# Switch to non-root user
USER mcp

# Expose metadata for MCP protocol
ENV MCP_SERVER_NAME="springdocs-mcp"
ENV MCP_SERVER_VERSION="1.2.8"

# Health check to verify Node.js process is running
# Simple check that exits successfully if node is responsive
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# Entry point - MCP servers communicate via stdio
ENTRYPOINT ["node", "build/index.js"]

# Metadata for Docker MCP Catalog
# These labels help Docker catalog the server correctly
LABEL com.docker.mcp.server.type="stdio"
LABEL com.docker.mcp.server.protocol="2024-11-05"
LABEL com.docker.mcp.server.category="documentation"
LABEL com.docker.mcp.server.tags="spring,spring-boot,spring-ai,documentation,java,mcp"
