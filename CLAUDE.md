# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Model Context Protocol (MCP) server** that provides access to Spring Boot and Spring Framework documentation. It's a TypeScript-based tool published as `@enokdev/springdocs-mcp` on npm, enabling AI assistants to search and retrieve Spring documentation in real-time.

## Commands

### Building and Running
```bash
npm run build         # Compile TypeScript to JavaScript (outputs to build/)
npm start            # Run the compiled server
npm run dev          # Build and start in one command
npm run watch        # Watch mode for development
```

### Testing
```bash
npm test             # Run basic test suite (test.sh)
npm run test-npx     # Test the npx package execution
./test-enhanced.sh   # Enhanced test suite with multiple tool tests
```

### Publishing and Versioning
```bash
npm run version:patch    # Bump patch version and push tags
npm run version:minor    # Bump minor version and push tags
npm run version:major    # Bump major version and push tags
npm run release:dry      # Test publish without actually publishing
npm run release:manual   # Build and publish to npm
npm run release:check    # Check current published version
```

### CI/CD
```bash
npm run cicd:setup   # Setup GitHub Actions for auto-release
npm run cicd:check   # Check CI/CD configuration status
```

## Architecture

### Core Components

**Server Entry Point** (`src/index.ts`):
- `SpringBootMCPServerAdvanced` class orchestrates the entire MCP server
- Uses MCP SDK's `Server` class with stdio transport for communication
- Handles 12 tools split between core documentation and advanced features
- All tool handlers route to either `docsService` or `advancedService`

**Services Architecture**:
- `SpringBootDocsServiceOptimized` (`src/services/springboot-docs-optimized.ts`): Handles the 7 core documentation tools (search docs, projects, guides, references, concepts)
- `AdvancedFeaturesService` (`src/services/advanced-features.ts`): Handles the 5 advanced tools (ecosystem search, tutorials, version comparison, best practices, diagnostics)
- `CacheService` (`src/services/cache.ts`): In-memory caching with TTL (30min default, 24h for stable content)

**Tool Definitions** (`src/tools/index.ts`):
- Centralized schema definitions for all 12 MCP tools
- Defines input validation, types, and descriptions for each tool

### Key Design Patterns

1. **Real API Integration**: All data is fetched from actual Spring.io and docs.spring.io URLs using `node-fetch` and `cheerio` for HTML parsing
2. **Intelligent Caching**: Two-tier caching system (short-term for dynamic content, long-term for stable content) provides 50-80% performance improvement
3. **Retry Logic**: Built-in exponential backoff with 3 max retries and 10-second timeouts for resilience
4. **MCP Protocol**: Implements the Model Context Protocol using `@modelcontextprotocol/sdk` for universal AI assistant compatibility

### Data Flow

1. MCP client (Claude Code, etc.) sends JSON-RPC request via stdio
2. `src/index.ts` routes the tool call to appropriate service
3. Service checks cache first, then fetches from Spring URLs if needed
4. HTML is parsed with cheerio, converted to markdown with turndown
5. Response formatted and returned to client via MCP protocol

## Important Notes

- **No Mock Data**: The codebase emphasizes using ONLY real Spring documentation APIs - comments explicitly state this throughout service files
- **TypeScript Configuration**: Uses Node16 module resolution with ES2022 target, outputs to `build/` directory
- **Binary Entry Point**: The compiled `build/index.js` has a shebang (`#!/usr/bin/env node`) and is marked executable
- **MCP Protocol Version**: Currently on v1.2.5, implements MCP protocol version "2024-11-05"
- **Node Version**: Requires Node.js 18+

## Common Development Patterns

When adding new tools:
1. Define the tool schema in `src/tools/index.ts`
2. Add handler method in `src/index.ts` (either `handleX` for routing)
3. Implement the logic in appropriate service (`SpringBootDocsServiceOptimized` for core docs, `AdvancedFeaturesService` for advanced features)
4. Always implement caching with appropriate TTL
5. Use `fetchWithRetry()` for all external HTTP requests
6. Format responses as markdown for better readability

When modifying services:
- Maintain the "real API only" principle - fetch from actual Spring URLs
- Use cheerio selectors that work with Spring.io's HTML structure
- Convert HTML to markdown using the shared `turndownService` instance
- Cache aggressively but with appropriate TTL based on content volatility