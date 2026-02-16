# Docker Distribution Guide

This document provides comprehensive information about the Docker distribution of the Spring Documentation MCP Server.

## Overview

The Spring Documentation MCP Server is available as a Docker image optimized for:
- **Security**: Non-root user, minimal Alpine base, cryptographic signatures
- **Performance**: ~220MB optimized image with intelligent caching
- **Compatibility**: Full MCP protocol support via stdio transport
- **Reliability**: Health checks, automatic retry logic, multi-source fallbacks

## Current Status

**Development Complete** ✅
- Dockerfile optimized for production use
- Multi-stage build with Node 20 Alpine
- Security best practices implemented
- All 12 tools fully functional in Docker

**Docker MCP Catalog Submission** 🚧
- Ready for submission to Docker MCP Catalog
- All required artifacts prepared
- Awaiting Docker team review

## For Users

### Installation (When Available in Catalog)

```bash
# Recommended: Via Docker MCP CLI
docker mcp add springdocs-mcp

# Or pull directly
docker pull mcp/springdocs-mcp:latest
```

### Usage Examples

```bash
# List all available tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker run -i --rm mcp/springdocs-mcp:latest

# Search Spring AI documentation
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {"name": "search_spring_ecosystem",
  "arguments": {"query": "embeddings", "scope": "ai"}}}' | \
  docker run -i --rm mcp/springdocs-mcp:latest

# Get Spring Boot reference
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {"name": "get_spring_reference",
  "arguments": {"project": "boot", "section": "web"}}}' | \
  docker run -i --rm mcp/springdocs-mcp:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  springdocs-mcp:
    image: mcp/springdocs-mcp:latest
    stdin_open: true
    tty: false
    environment:
      - REQUEST_TIMEOUT=15000
      - MAX_RETRIES=3
      - NODE_OPTIONS=--max-old-space-size=4096
    mem_limit: 1g
    restart: unless-stopped
```

### Configuration

See `docker/README.md` for detailed configuration options.

## For Developers

### Building Locally

```bash
# Build with version tag
npm run docker:build

# Or build manually
docker build -t mcp/springdocs-mcp:test .
```

### Testing

```bash
# Run comprehensive test suite
./test-docker.sh

# Or test manually
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker run -i --rm mcp/springdocs-mcp:test
```

### Image Details

- **Base Image**: node:20-alpine
- **Size**: ~220MB
- **User**: mcp (UID 1001)
- **Entry Point**: node build/index.js
- **Health Check**: Included (30s interval)
- **Protocol**: MCP stdio transport

### Generated Artifacts

| File | Purpose | Generation |
|------|---------|-----------|
| `Dockerfile` | Multi-stage build definition | Manual |
| `.dockerignore` | Build context optimization | Manual |
| `docker/server.yaml` | MCP Catalog server definition | Manual |
| `docker/tools.json` | Static tool catalog | Generated via `npm run docker:tools` |
| `docker/README.md` | Docker-specific docs | Manual |
| `test-docker.sh` | Validation test suite | Manual |

### Regenerating tools.json

```bash
# After modifying tool definitions
npm run build
npm run docker:tools
```

## Docker MCP Catalog Submission

### Prerequisites

1. **GitHub Repository**
   - All Docker artifacts committed
   - Tagged release (e.g., v1.3.0)
   - Clean git history

2. **Validation**
   - All tests passing: `./test-docker.sh`
   - Image builds successfully
   - All 12 tools functional

3. **Documentation**
   - README.md updated
   - CHANGELOG.md includes Docker changes
   - docker/README.md complete

### Submission Process

#### Step 1: Prepare Repository

```bash
# Ensure everything is committed
git add Dockerfile .dockerignore docker/ scripts/generate-tools-json.js test-docker.sh
git commit -m "feat: add Docker MCP Catalog support"

# Create release tag
git tag v1.3.0
git push origin main --tags
```

#### Step 2: Fork Docker MCP Registry

```bash
git clone https://github.com/docker/mcp-registry.git
cd mcp-registry
git checkout -b add-springdocs-mcp
```

#### Step 3: Add Server Files

```bash
# Copy artifacts to registry
cp /path/to/springdocs-mcp/docker/server.yaml servers/springdocs-mcp.yaml
cp /path/to/springdocs-mcp/docker/tools.json servers/springdocs-mcp-tools.json
cp /path/to/springdocs-mcp/docker/README.md servers/springdocs-mcp-README.md

# Update commit hash in server.yaml
# Replace HEAD with actual commit SHA
```

#### Step 4: Validate & Submit

```bash
# Validate (if validation script available)
make validate

# Create pull request
git add servers/springdocs-mcp*
git commit -m "Add Spring Documentation MCP Server"
git push origin add-springdocs-mcp

# Create PR via GitHub or CLI
gh pr create --title "Add Spring Documentation MCP Server" \
  --body "MIT licensed MCP server for Spring Boot, Spring AI, and Spring Framework documentation"
```

#### Step 5: Wait for Review

- Docker team reviews submission (typically 1-3 business days)
- Docker builds and publishes within 24 hours of approval
- Image becomes available at `docker.io/mcp/springdocs-mcp`

#### Step 6: Verify Publication

```bash
# Check if available
docker mcp catalog list | grep springdocs

# Test installation
docker mcp add springdocs-mcp

# Verify functionality
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker mcp run springdocs-mcp
```

### Submission Checklist

Pre-submission validation:

- [ ] Docker image builds successfully
- [ ] Image size is reasonable (~220MB)
- [ ] All 12 tools are listed via `tools/list`
- [ ] Sample tool calls work correctly
- [ ] Runs as non-root user (UID 1001)
- [ ] Works with 512MB memory limit
- [ ] `server.yaml` validates against Docker schema
- [ ] `tools.json` is valid JSON with all 12 tools
- [ ] `docker/README.md` includes Docker examples
- [ ] Repository is clean and tagged
- [ ] CHANGELOG.md documents Docker support

Documentation:

- [ ] README.md mentions Docker distribution
- [ ] DOCKER.md provides comprehensive Docker guide
- [ ] docker/README.md has quick-start instructions
- [ ] All environment variables documented

Testing:

- [ ] `./test-docker.sh` passes all tests
- [ ] Manual testing confirms functionality
- [ ] Performance is acceptable
- [ ] Security validation passes

## Troubleshooting

### Build Issues

**Problem**: Docker build fails
```bash
# Check Docker daemon
docker info

# Clean build cache
docker builder prune

# Rebuild from scratch
docker build --no-cache -t mcp/springdocs-mcp:test .
```

**Problem**: Node.js compatibility errors
- Ensure using Node 20 Alpine (not Node 18)
- Check package.json requires Node 18+ but Docker uses Node 20

### Runtime Issues

**Problem**: Container exits immediately
- MCP servers use stdio transport - must pipe input
- Use `-i` flag: `docker run -i mcp/springdocs-mcp:test`

**Problem**: Out of memory
```bash
# Increase memory limit
docker run -i --memory=1g mcp/springdocs-mcp:test
```

**Problem**: Network errors
```bash
# Check internet connectivity
docker run -i mcp/springdocs-mcp:test sh -c "wget -O- https://docs.spring.io"

# Configure proxy if needed
docker run -i \
  -e HTTP_PROXY=http://proxy:8080 \
  mcp/springdocs-mcp:test
```

### Testing Issues

**Problem**: test-docker.sh fails
```bash
# Check if image exists
docker images mcp/springdocs-mcp:test

# Rebuild if missing
docker build -t mcp/springdocs-mcp:test .

# Run individual tests
docker run --rm mcp/springdocs-mcp:test id
```

## Future Enhancements

Planned improvements for Docker distribution:

1. **Multi-architecture Support**
   - ARM64/aarch64 for Apple Silicon
   - AMD64/x86_64 for Intel/AMD

2. **Image Variants**
   - Slim variant (minimal dependencies)
   - Debug variant (includes diagnostic tools)

3. **Performance Optimizations**
   - Persistent cache volume support
   - Pre-warmed cache images
   - Layer optimization for faster pulls

4. **Security Enhancements**
   - Distroless base image option
   - SBOM generation
   - Vulnerability scanning automation

## Support

- **Docker Issues**: https://github.com/tky0065/springdocs-mcp/issues
- **MCP Catalog**: https://github.com/docker/mcp-registry
- **Documentation**: https://github.com/tky0065/springdocs-mcp/blob/main/docker/README.md

## License

MIT License - Same as the main Spring Documentation MCP Server project.
