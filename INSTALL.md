# 📦 Spring Documentation MCP Server - Public Installation

Public MCP server for accessing complete Spring Boot documentation and the Spring ecosystem.

## 🚀 Quick Installation

### Via npm (recommended)
```bash
npm install -g @enokdev/springdocs-mcp
```

### Via npx (without installation)
```bash
npx @enokdev/springdocs-mcp
```

## ⚡ Claude Desktop Configuration

### 1. Global Installation
```bash
npm install -g @enokdev/springdocs-mcp
```

### 2. Claude Desktop Configuration
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

### 3. Configuration File Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## 🛠️ Advanced Configuration

### With specific path
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "node",
      "args": ["/path/to/global/node_modules/@enokdev/springdocs-mcp/build/index.js"]
    }
  }
}
```

### With npx (without global installation)
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "npx",
      "args": ["@enokdev/springdocs-mcp"]
    }
  }
}
```

## 🔧 Available Tools

Once configured, you'll have access to 7 tools in Claude Desktop:

1. **`search_spring_docs`** - Search Spring Boot documentation
2. **`search_spring_projects`** - Search Spring projects
3. **`get_spring_project`** - Get Spring project details
4. **`get_all_spring_guides`** - List Spring guides
5. **`get_spring_guide`** - Get specific guide content
6. **`get_spring_reference`** - Get reference documentation
7. **`search_spring_concepts`** - Search Spring Boot concepts

## 💡 Usage Examples

Once installed, ask Claude:

- *"What Spring projects are available for security?"*
- *"Show me the guide for creating a REST API with Spring Boot"*
- *"How do I configure Spring Security?"*
- *"Explain Spring Boot auto-configuration"*

## 🔄 Updates

```bash
npm update -g @enokdev/springdocs-mcp
```

## 🆘 Troubleshooting

### Check installation
```bash
springdocs-mcp --version
```

### Manual test
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | springdocs-mcp
```

### Reinstallation
```bash
npm uninstall -g @enokdev/springdocs-mcp
npm install -g @enokdev/springdocs-mcp
```

## 📚 Documentation Sources

This server accesses:
- **spring.io/projects** - All Spring projects
- **spring.io/guides** - Practical guides
- **docs.spring.io** - Reference documentation
- **Built-in knowledge base** - Spring Boot concepts

---

**🌟 Enjoy complete access to the Spring ecosystem directly in Claude Desktop!**
