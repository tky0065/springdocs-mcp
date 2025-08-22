# 📚 Spring Documentation MCP Server

[![npm version](https://badge.fury.io/js/@enokdev%2Fspringdocs-mcp.svg)](https://badge.fury.io/js/@enokdev%2Fspringdocs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/GitHub-tky0065/springdocs--mcp-blue.svg)](https://github.com/tky0065/springdocs-mcp)

A public **Model Context Protocol (MCP)** server that provides access to the complete Spring Boot documentation and Spring ecosystem directly in Claude Desktop.

## 🚀 Quick Installation

```bash
npm install -g @enokdev/springdocs-mcp
```

Then add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

## ✨ Features

- 🌐 **Complete access** to spring.io/projects (all Spring projects)
- 📖 **Practical guides** spring.io/guides with filtering
- 📚 **Reference documentation** docs.spring.io
- 🔍 **Intelligent search** across the entire Spring ecosystem
- 💡 **Built-in knowledge base** of Spring Boot concepts and best practices
- ⚡ **7 MCP tools** for comprehensive exploration

## 🛠️ Usage

### Starting the server

```bash
npm start
```

or

```bash
node build/index.js
```

## 🛠️ Available Tools

The MCP server provides **7 tools** to explore Spring documentation:

### 1. `search_spring_docs`
Search through Spring Boot documentation with keywords.

**Parameters:**
- `query` (string, required): Keywords to search for
- `docType` (string, optional): Documentation type (`guides`, `reference`, `api`, `all`)
- `limit` (number, optional): Maximum number of results (default: 10)

### 2. `search_spring_projects`
Search among all Spring projects available on spring.io/projects.

**Parameters:**
- `query` (string, required): Keywords to search in Spring projects
- `limit` (number, optional): Maximum number of projects to return (default: 10)

### 3. `get_spring_project`
Retrieve complete details of a specific Spring project.

**Parameters:**
- `projectName` (string, required): Spring project name (e.g., `spring-boot`, `spring-security`)

### 4. `get_all_spring_guides`
Retrieve a list of all available Spring guides, optionally filtered by category.

**Parameters:**
- `category` (string, optional): Guide category to filter by
- `limit` (number, optional): Maximum number of guides (default: 20)

### 5. `get_spring_guide`
Retrieve the complete content of a specific Spring Boot guide.

**Parameters:**
- `guideId` (string, required): Guide identifier (e.g., `gs-rest-service`)

### 6. `get_spring_reference`
Retrieve a specific section of the Spring Boot reference documentation.

**Parameters:**
- `section` (string, required): Documentation section (e.g., `web`, `data`, `security`)
- `subsection` (string, optional): Subsection for more precise search

### 7. `search_spring_concepts`
Search Spring Boot concepts by category with detailed explanations.

**Parameters:**
- `concept` (string, required): Concept to search for (e.g., `auto-configuration`)
- `category` (string, optional): Category (`core`, `web`, `data`, `security`, `testing`, `production`)

## 📚 Documentation Sources

This MCP server accesses the following Spring documentation sources:

- **🌟 [spring.io/projects](https://spring.io/projects)** - All Spring projects (Boot, Security, Data, Cloud, etc.)
- **📖 [spring.io/guides](https://spring.io/guides)** - Practical guides and tutorials
- **📚 [docs.spring.io](https://docs.spring.io)** - Official reference documentation
- **🔧 API Documentation** - Class and method documentation
- **💡 Built-in knowledge base** - Spring Boot concepts and best practices

## 🔧 Configuration with Claude Desktop

To use this server with Claude Desktop, add the following configuration to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

### Configuration file location

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

## 📚 Usage Examples

### General search
```
Search for "REST API" in Spring Boot documentation
```

### Spring project search
```
Find Spring projects related to "security"
```

### Specific project details
```
Show me details of the "spring-boot" project
```

### Guides by category
```
What are the Spring guides for the "Web" category?
```

### Specific guide retrieval
```
Retrieve the "gs-rest-service" guide
```

### Concept exploration
```
Explain Spring Boot auto-configuration
```

### Reference documentation
```
Show me the Spring Boot web documentation
```

## 🚀 Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation for development
```bash
# Clone the repository
git clone https://github.com/tky0065/springdocs-mcp.git
cd springdocs-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Testing
```bash
# Run tests
npm test

# Or use the test script
./test.sh
```

### Available Scripts
- `npm run build` - Compile TypeScript
- `npm run start` - Start the server
- `npm run dev` - Development mode with auto-reload
- `npm run watch` - Watch mode for TypeScript

## 🧪 Testing

Test the server functionality:

```bash
# Test all tools
./test.sh

# Or test manually
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node build/index.js
```

## 📝 Example Requests

### Initialize the server
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {"name": "test", "version": "1.0.0"}
  }
}
```

### Search Spring projects
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_spring_projects",
    "arguments": {"query": "security", "limit": 3}
  }
}
```

### Get Spring Boot project details
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_spring_project",
    "arguments": {"projectName": "spring-boot"}
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **npm package**: https://www.npmjs.com/package/@enokdev/springdocs-mcp
- **GitHub repository**: https://github.com/tky0065/springdocs-mcp
- **Issues**: https://github.com/tky0065/springdocs-mcp/issues
- **Documentation**: https://tky0065.github.io/springdocs-mcp

## 📊 Stats

- **Downloads**: https://npm-stat.com/charts.html?package=@enokdev/springdocs-mcp
- **GitHub Stars**: https://github.com/tky0065/springdocs-mcp/stargazers

## 🙏 Acknowledgments

- [Spring Framework Team](https://spring.io/team) for the excellent documentation
- [Anthropic](https://www.anthropic.com/) for the Model Context Protocol
- [Spring Community](https://spring.io/community) for continuous support

---

**Made with ❤️ by [EnokDev](https://github.com/tky0065)**

*Access the complete Spring ecosystem directly in Claude Desktop!*
