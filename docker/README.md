# Spring Documentation MCP Server - Docker Distribution

Official Docker distribution of the Spring Documentation MCP Server, providing access to Spring Boot, Spring AI, and Spring Framework documentation.

## Quick Start

### Using Docker MCP CLI (Recommended)

```bash
# Add to Docker MCP catalog
docker mcp add springdocs-mcp

# Start using it immediately in Docker Desktop
```

### Using Docker Run

```bash
# Run interactively via stdio
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  docker run -i mcp/springdocs-mcp

# Run with custom memory allocation
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  docker run -i --memory=512m mcp/springdocs-mcp
```

### Using Docker Compose

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
    restart: unless-stopped
```

## Configuration

### Environment Variables

All configuration is optional with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `REQUEST_TIMEOUT` | `10000` | HTTP request timeout (milliseconds) |
| `MAX_RETRIES` | `3` | Maximum retry attempts for failed requests |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | Node.js memory settings |
| `HTTP_PROXY` | - | HTTP proxy for corporate environments |
| `HTTPS_PROXY` | - | HTTPS proxy for corporate environments |

### Example with Custom Configuration

```bash
docker run -i \
  -e REQUEST_TIMEOUT=15000 \
  -e MAX_RETRIES=5 \
  -e NODE_OPTIONS="--max-old-space-size=2048" \
  mcp/springdocs-mcp
```

## Features

- **17 Powerful Tools**: Search docs, get tutorials, compare versions, release notes, diagnose issues
- **Spring AI Support**: ChatClient, RAG, embeddings, vector stores, LLM integrations
- **Intelligent Caching**: repeated requests are served from the in-memory cache (30 min TTL, 24 h for stable content)
- **Zero Configuration**: Works out-of-the-box with no setup required
- **Secure**: Runs as non-root user, minimal attack surface
- **Lightweight**: ~220MB optimized Alpine-based image

## Tools Available

### Core Documentation (8 Tools)
- `search_spring_docs` - Search Spring Boot documentation
- `search_spring_projects` - Find Spring projects
- `get_spring_project` - Get project details
- `get_all_spring_guides` - List available guides
- `get_spring_guide` - Get complete guide content
- `get_spring_reference` - Get reference docs for 11 projects (Boot, AI, Framework, Security, Data JPA, Batch, Integration, Kafka, Modulith, Cloud Gateway, Cloud Config); optional `version` and `offset` parameters
- `get_migration_guide` - Spring Boot migration guide / upgrade notes
- `search_spring_concepts` - Explore Spring concepts

### Advanced Tools (9 Tools)
- `search_spring_ecosystem` - Search entire ecosystem + Spring AI
- `get_spring_tutorial` - Step-by-step tutorials
- `compare_spring_versions` - Version comparison & migration
- `get_release_notes` - GitHub release notes (any project, with focus filter)
- `get_spring_best_practices` - Expert guidance by category
- `diagnose_spring_issues` - Intelligent error diagnosis
- `spring_cache_stats` - Cache statistics and optional purge
- `get_spring_initializr` - Spring Initializr options and dependencies (start.spring.io)
- `find_spring_dependency` - Find starters for a need, with Maven and Gradle snippets

## Resources

- `spring://project/<slug>` - Spring project page as complete markdown (the 11 registry projects are listed, any spring.io project works)
- `spring://guide/<id>` - Spring getting-started guide as complete markdown

## Prompts

- `migrate-boot-version` (`to_version`, optional `from_version`) - Spring Boot upgrade plan using the migration and release notes tools
- `explain-error` (`error_message`, optional `stack_trace`) - Spring error explanation using the diagnosis and reference tools

## Example Usage

```bash
# List all available tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker run -i mcp/springdocs-mcp

# Search Spring AI documentation
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {"name": "search_spring_ecosystem",
  "arguments": {"query": "chatclient", "scope": "ai"}}}' | \
  docker run -i mcp/springdocs-mcp

# Get Spring Boot reference
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {"name": "get_spring_reference",
  "arguments": {"project": "boot", "section": "web"}}}' | \
  docker run -i mcp/springdocs-mcp
```

## Health Check

The container includes a built-in health check:

```bash
# Check container health
docker inspect mcp/springdocs-mcp | jq '.[0].State.Health'
```

## Resource Requirements

- **Memory**: 512MB minimum, 1GB recommended
- **CPU**: 1 core minimum, 2 cores recommended for optimal performance
- **Disk**: ~220MB for image
- **Network**: Internet access required for fetching Spring documentation

## Security

- Runs as non-root user (UID 1001)
- Minimal Alpine Linux base
- No shell or unnecessary utilities
- Read-only recommended for production:

```bash
docker run -i --read-only mcp/springdocs-mcp
```

## Troubleshooting

### Container exits immediately
- Ensure you're piping input via stdin (`-i` flag)
- MCP servers communicate via stdio, they don't run as daemons

### Memory issues
- Increase memory limit: `docker run -i --memory=1g mcp/springdocs-mcp`
- Adjust `NODE_OPTIONS`: `-e NODE_OPTIONS="--max-old-space-size=2048"`

### Network errors
- Check internet connectivity from container
- Configure proxy if in corporate environment:
  ```bash
  docker run -i \
    -e HTTP_PROXY=http://proxy.company.com:8080 \
    -e HTTPS_PROXY=http://proxy.company.com:8080 \
    mcp/springdocs-mcp
  ```

### Slow responses
- First request is slower (fetching docs)
- Subsequent identical requests are served from the in-memory cache without a new network call
- Ensure adequate memory allocation

## Documentation

For complete documentation, see the main repository:
- **GitHub**: https://github.com/tky0065/springdocs-mcp
- **Issues**: https://github.com/tky0065/springdocs-mcp/issues
- **Discussions**: https://github.com/tky0065/springdocs-mcp/discussions

## Version

**Current Version**: 1.2.8

**Changelog**: See [CHANGELOG.md](https://github.com/tky0065/springdocs-mcp/blob/main/CHANGELOG.md)

## License

MIT License - see [LICENSE](https://github.com/tky0065/springdocs-mcp/blob/main/LICENSE)
