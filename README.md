# 🍃 Spring Documentation MCP Server

[![npm version](https://badge.fury.io/js/@enokdev%2Fspringdocs-mcp.svg)](https://badge.fury.io/js/@enokdev%2Fspringdocs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.18+-green.svg)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Universal%20Compatible-brightgreen.svg)](https://modelcontextprotocol.io/)

> **🚀 Enhanced v1.4.1:** 17 powerful tools with **Spring AI support**, intelligent caching, advanced tutorials, and comprehensive Spring ecosystem access
>
> **🌐 Universal MCP Compatibility:** Works with Claude Code, Gemini CLI, VS Code, JetBrains IDEs, and all MCP-compatible clients!

## 🎯 Quick Start

### 🔌 Universal MCP Compatibility

This server works with **ALL MCP-compatible clients**:

#### Claude Desktop/Code
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "npx",
      "args": ["@enokdev/springdocs-mcp@latest"],
      "description": "Spring Documentation MCP Server with 17 powerful tools"
    }
  }
}
```

#### Gemini CLI
```yaml
mcp_servers:
  spring-docs:
    command: "npx"
    args: ["@enokdev/springdocs-mcp@latest"]
    description: "Spring Documentation Server"
```

#### VS Code MCP Extension
```json
{
  "mcp.servers": {
    "spring-docs": {
      "command": "npx",
      "args": ["@enokdev/springdocs-mcp@latest"]
    }
  }
}
```

#### Any MCP Client (NPX)
```bash
npx @enokdev/springdocs-mcp@latest
```

#### Global Installation (All Clients)
```bash
npm install -g @enokdev/springdocs-mcp
# Then use: springdocs-mcp
```

#### Docker (Coming Soon - Docker MCP Catalog)
```bash
# Via Docker MCP CLI (when available in catalog)
docker mcp add springdocs-mcp

# Via Docker directly
docker pull mcp/springdocs-mcp:latest
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker run -i mcp/springdocs-mcp:latest
```

**Benefits of Docker distribution:**
- Enhanced security with cryptographic signatures and SBOMs
- Isolated execution environment
- Reduced token usage in Docker Desktop
- Automatic security updates

**Config file locations:**
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- **Claude Code:** `~/.claude-code/mcp-config.json`
- **VS Code:** `~/.vscode/mcp-settings.json`
- **JetBrains IDEs:** `.jetbrains/mcp-config.json`

---

## ✨ Features & Tools

The server exposes **17 tools**.

### 📚 **Core Documentation (8 Tools)**
| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `search_spring_docs` | Search Spring documentation (`docType` all, guides, projects, reference, content; optional `version`) | "Search docs for WebClient" |
| `search_spring_projects` | Find Spring projects | "Find projects about security" |
| `get_spring_project` | Project page as markdown (paginated with `offset`) | "Show the Spring Data project" |
| `get_all_spring_guides` | List the getting-started guides | "List the guides" |
| `get_spring_guide` | Complete guide content | "Get the rest-service guide" |
| `get_spring_reference` | Reference documentation for 11 projects (`version`, `offset`) | "Boot reference, web section" |
| `get_migration_guide` | Spring Boot / Framework / Batch migration guides and upgrade notes | "Migration guide to Boot 3.4" |
| `search_spring_concepts` | Explore Spring concepts (optional `version`) | "Explain auto-configuration" |

### 🚀 **Advanced Features (6 Tools)**
| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `search_spring_ecosystem` | Search the whole ecosystem, Spring AI included | "Find Spring AI vector stores" |
| `get_spring_tutorial` | Step-by-step tutorials | "Tutorial on Spring Security" |
| `compare_spring_versions` | Version comparison and migration notes | "Compare 3.3 and 3.4" |
| `get_release_notes` | GitHub release notes with focus filter | "Release notes of Boot 3.5" |
| `get_spring_best_practices` | Expert guidance by category | "Best practices for testing" |
| `diagnose_spring_issues` | Offline stack trace and error diagnosis | "Diagnose this DataSource error" |

### 🧰 **Tooling (3 Tools)**
| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `get_spring_initializr` | Spring Initializr metadata: Boot versions, dependencies (start.spring.io) | "Which Boot versions does Initializr offer?" |
| `find_spring_dependency` | Find starters for a need, with Maven and Gradle snippets (optional `bootVersion` as X.Y.Z) | "Which dependency for Redis caching?" |
| `spring_cache_stats` | In-memory cache statistics and optional purge | "Show cache stats" |

---

### 📎 **Resources**

- `spring://project/<slug>` : Spring project page as complete markdown (e.g. `spring://project/spring-boot`); `resources/list` enumerates the 11 projects of the registry, the template accepts any project of spring.io
- `spring://guide/<id>` : Spring getting-started guide as complete markdown (e.g. `spring://guide/rest-service`), available through the resource template

### 💬 **Prompts**

- `migrate-boot-version` (`to_version`, optional `from_version`): plans a Spring Boot upgrade by chaining `get_migration_guide`, `get_release_notes` and `get_spring_reference`
- `explain-error` (`error_message`, optional `stack_trace`): explains a Spring error by chaining `diagnose_spring_issues` and `get_spring_reference`

## 📖 Usage Examples

### Basic Search
```
"Search for REST API documentation in Spring Boot"
```

`search_spring_docs` and `search_spring_concepts` accept an optional `version` (`3.4` or `3.4.2`, the patch is ignored; `current` or omitted = latest) that targets the Spring Boot reference documentation of that version (a version that is not published gives a dedicated error). Guides and projects are not versioned and ignore it; with `docType=content`, Boot reference pages of other versions are left out of the results.

`get_migration_guide` accepts `project` (`spring-boot` by default, `spring-framework`, `spring-batch`): Framework serves the release notes of its minor version (`6.2`, section "Upgrading From ..."), Batch its migration guide (`5.0`, `6.0`), both read as raw markdown from the project wiki; `section` and `offset` work as for Boot. Spring Security and Spring AI (docs.spring.io pages) are not covered yet.

`search_spring_docs` accepts `docType=content`: full-text search (BM25 ranking) over the pages the server has already read (`get_spring_project`, `get_spring_reference`, `get_spring_guide`). It is included in `docType=all` and stays empty until a page has been read.

### 🆕 Spring AI Support
```
"Get Spring AI ChatClient reference documentation"
"Search for RAG and embeddings in Spring AI"
"Show me Spring AI vector store documentation"
"Find Spring AI LLM integration examples"
```

### Ecosystem Exploration
```
"Search the Spring ecosystem for microservices patterns"
```

### Learning Path
```
"Get a beginner tutorial for REST API development"
```

### Problem Solving
```
"Diagnose 'Failed to configure DataSource' error"
```

### Migration Planning
```
"Compare Spring Boot 2.7.0 and 3.0.0 breaking changes"
```

### Best Practices
```
"Get architecture best practices for expert developers"
```

---

## 🔧 Advanced Configuration

### Performance Optimization
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "npx",
      "args": ["@enokdev/springdocs-mcp@latest"],
      "env": {
        "NODE_OPTIONS": "--max-old-space-size=4096",
        "REQUEST_TIMEOUT": "15000",
        "MAX_RETRIES": "3"
      }
    }
  }
}
```

### Corporate/Proxy Environment
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "npx",
      "args": ["@enokdev/springdocs-mcp@latest"],
      "env": {
        "HTTP_PROXY": "http://proxy.company.com:8080",
        "HTTPS_PROXY": "http://proxy.company.com:8080"
      }
    }
  }
}
```

---

## Transport HTTP (optionnel)

Par défaut le serveur parle stdio. Pour l'héberger en local ou en conteneur :

```bash
npx @enokdev/springdocs-mcp --transport http --port 3000   # écoute sur 127.0.0.1
```

| Option | Variable | Défaut |
|---|---|---|
| `--transport stdio\|http` | `MCP_TRANSPORT` | `stdio` |
| `--port` | `MCP_PORT` | `3000` |
| `--host` | `MCP_HOST` | `127.0.0.1` |
| (aucune) | `MCP_ALLOWED_HOSTS` | vide : liste de `Host` supplémentaires, séparés par des virgules |

Endpoint MCP : `POST /mcp` (mode sans état) ; santé : `GET /healthz`. **Aucune authentification** : l'écoute reste sur loopback par défaut, et les en-têtes `Host`/`Origin` sont contrôlés contre le DNS rebinding. Pour un conteneur, `MCP_TRANSPORT=http MCP_HOST=0.0.0.0` avec le port publié (`-p 127.0.0.1:3000:3000`) ; si le port publié diffère du port interne, déclarer le `Host` utilisé par le client, par exemple `MCP_ALLOWED_HOSTS=localhost:8080`.

Le `Host` doit être de la forme `nom:port` : un `Host` sans port (client sur le port 80 ou 443 derrière un reverse proxy, par exemple `Host: mcp.example.com`) est refusé en 403. Il faut alors le déclarer tel que le proxy le transmet, via `MCP_ALLOWED_HOSTS=mcp.example.com` (liste séparée par des virgules, comparaison exacte avec l'en-tête reçu).

### Jeton GitHub (optionnel)

`get_release_notes` et `compare_spring_versions` interrogent l'API GitHub, limitée à 60 requêtes/heure sans authentification. Définir `GITHUB_TOKEN` (jeton sans scope particulier suffit) relève cette limite à 5000/heure ; le jeton n'est envoyé qu'à `api.github.com` (jamais à un autre hôte ni après une redirection) et n'est jamais journalisé. En cas de limite atteinte, l'outil échoue immédiatement avec un message clair (délai de reprise inclus) au lieu d'attendre. `get_release_notes` accepte `version` en `X.Y` (ex. `3.5`) pour obtenir la dernière release stable de cette mineure ; `compare_spring_versions` applique `focus` (`breaking-changes`, `new-features`, `deprecations`).

```json
{ "mcpServers": { "springdocs": { "command": "npx", "args": ["@enokdev/springdocs-mcp@latest"], "env": { "GITHUB_TOKEN": "ghp_..." } } } }
```

## 🧪 Testing & Development

### Quick Test
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | npx @enokdev/springdocs-mcp@latest
```

### Development Setup
```bash
git clone https://github.com/tky0065/springdocs-mcp.git
cd springdocs-mcp
npm install
npm run build
npm test
```

### Load Testing
```bash
# Test multiple tools quickly
for tool in "search_spring_docs" "search_spring_projects" "search_spring_ecosystem"; do
  echo "Testing $tool..."
  echo "{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"tools/call\", \"params\": {\"name\": \"$tool\", \"arguments\": {\"query\": \"test\", \"limit\": 2}}}" | npx @enokdev/springdocs-mcp@latest > /dev/null
done
```

---

## 🆘 Troubleshooting

### Common Issues & Solutions

#### "Server failed to start"
```bash
# Check Node.js version (requires 20.18.1+)
node --version

# Update to latest
npm update -g @enokdev/springdocs-mcp

# Clear cache
npm cache clean --force
```

#### "Tools not responding"
```bash
# Test connectivity
curl -I https://spring.io

# Check Claude Desktop config syntax
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```

#### "Slow performance"
- Enable caching (automatic in v1.2.3+)
- Use specific queries instead of broad searches
- Increase memory: `NODE_OPTIONS="--max-old-space-size=4096"`

#### "Port 8080 already in use" (Spring Boot error)
**Solution:** Change port in `application.properties`:
```properties
server.port=8081
```

#### "Failed to configure DataSource"
**Solutions:**
1. Add database dependency to `pom.xml`
2. Configure datasource in `application.properties`
3. Exclude auto-configuration: `@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})`

### Health Check Script
```bash
#!/bin/bash
echo "🔍 Testing Spring MCP Server..."

# Test server startup
timeout 10s echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | npx @enokdev/springdocs-mcp@latest > /dev/null
echo $? -eq 0 && echo "✅ Server: OK" || echo "❌ Server: FAILED"

# Test network
curl -s --max-time 5 https://spring.io > /dev/null
echo $? -eq 0 && echo "✅ Network: OK" || echo "❌ Network: FAILED"
```

---

## 📊 What's New in v1.2.3

### 🆕 **Major Enhancements**
- **5 new advanced tools** for comprehensive Spring ecosystem access
- **In-memory caching** of repeated requests (30 min TTL, 24 h for stable content)
- **Auto-retry** with exponential backoff and a 5 MiB response size cap
- **Clean architecture** with modular services and optimized code

### 🎯 **New Capabilities**
- **Ecosystem-wide search** across projects, guides, docs, and APIs
- **Progressive tutorials** with beginner/intermediate/advanced levels
- **Smart version comparison** with detailed migration guidance
- **Expert best practices** categorized by domain and experience level
- **Intelligent diagnostics** for common Spring Boot issues

### ⚡ **Performance & Resilience**
- Repeated requests are served from the in-memory cache (30 min TTL, 24 h for stable content) without a new network call
- The cache is bounded by an estimated memory budget (64 MiB by default, LRU eviction, a single value larger than the budget is not cached); override with `MCP_CACHE_MAX_MB` (e.g. `MCP_CACHE_MAX_MB=32`). `spring_cache_stats` reports entries and estimated memory used / budget
- Retry with exponential backoff and request timeouts on all external HTTP calls
- Responses larger than 5 MiB are rejected

---

## 🔮 Roadmap

### v1.5.0 (Next)
- Interactive Spring Boot project generator (Initializr metadata and dependency lookup are already available)
- Custom tutorial creation

### v1.6.0 (Future)
- AI-powered code suggestions
- Performance bottleneck detection
- Security vulnerability scanning
- Automated testing recommendations

---

## 🤝 Contributing & Support

### Quick Links
- **Issues:** https://github.com/tky0065/springdocs-mcp/issues
- **Discussions:** https://github.com/tky0065/springdocs-mcp/discussions
- **NPM Package:** https://www.npmjs.com/package/@enokdev/springdocs-mcp

### Getting Help
1. **Search existing issues** on GitHub
2. **Create detailed issue** with error messages and steps to reproduce
3. **Join community discussions** for questions and feature requests

### Development
```bash
# Setup development environment
git clone https://github.com/tky0065/springdocs-mcp.git
cd springdocs-mcp
npm install
npm run build

# Run tests
npm test
./test-enhanced.sh

# Submit PR
git checkout -b feature/your-feature
# Make changes
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

## 🌐 CLI Integration Examples

### Claude Code
```bash
# Direct usage
claude-code --mcp-server "npx @enokdev/springdocs-mcp@latest"

# With config file
claude-code --mcp-config claude-mcp-config.json
```

### Gemini CLI
```bash
# Direct integration
gemini --mcp-server "npx @enokdev/springdocs-mcp@latest"

# With YAML config
gemini --mcp-config gemini-config.yaml

# Environment variable
export GEMINI_MCP_SERVERS='[{"name":"spring-docs","command":"npx","args":["@enokdev/springdocs-mcp@latest"]}]'
gemini "Search for Spring Boot security documentation"
```

### Custom API Integration
```javascript
// Express.js API Gateway example
const { spawn } = require('child_process');

app.post('/spring-docs/:tool', async (req, res) => {
    const mcp = spawn('npx', ['@enokdev/springdocs-mcp@latest']);
    const request = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
            name: req.params.tool,
            arguments: req.body
        }
    };
    mcp.stdin.write(JSON.stringify(request));
    // Handle response...
});
```

### Compatibility Testing
```bash
# Test MCP protocol handshake
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | npx @enokdev/springdocs-mcp@latest

# Test tools listing
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}' | npx @enokdev/springdocs-mcp@latest

# Test tool execution
echo '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_spring_projects", "arguments": {"query": "boot", "limit": 1}}}' | npx @enokdev/springdocs-mcp@latest
```

---

## 📄 License & Acknowledgments

**License:** MIT - see [LICENSE](LICENSE) file

**Thanks to:**
- [Spring Framework Team](https://spring.io/team) for excellent documentation
- [Anthropic](https://www.anthropic.com/) for the Model Context Protocol
- [Spring Community](https://spring.io/community) for continuous support

---

**🚀 Ready to explore the Spring ecosystem with enhanced intelligence and performance!**

**🌐 Universal MCP Compatibility:** Works seamlessly with Claude Code, Gemini CLI, VS Code, JetBrains IDEs, and any MCP-compatible client!

*Made with ❤️ by [EnokDev](https://github.com/tky0065)*