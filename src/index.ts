#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, CallToolRequest, ListToolsRequest } from "@modelcontextprotocol/sdk/types.js";
import { SpringBootDocsServiceOptimized } from "./services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "./services/advanced-features.js";
import { CacheService } from "./services/cache.js";
import { InitializrService } from "./services/initializr.js";
import { ToolDefinitions } from "./tools/index.js";
import { validateToolArguments } from "./validation.js";
import { VERSION } from "./version.js";
import { listPrompts, getPrompt } from "./prompts.js";
import { ResourcesService } from "./resources.js";
import { parseConfig, type ServerConfig } from "./config.js";
import { startHttpServer, type RunningHttpServer } from "./http-server.js";

/**
 * Enhanced Spring Documentation MCP Server with advanced features and optimizations
 */
class SpringBootMCPServerAdvanced {
  private docsService: SpringBootDocsServiceOptimized;
  private advancedService: AdvancedFeaturesService;
  private cache: CacheService;
  private initializrService: InitializrService;
  private resourcesService: ResourcesService;

  constructor() {
    this.cache = new CacheService();
    this.docsService = new SpringBootDocsServiceOptimized(undefined, this.cache);
    this.resourcesService = new ResourcesService(this.docsService);
    this.advancedService = new AdvancedFeaturesService(this.cache);
    this.initializrService = new InitializrService(this.cache);
  }

  /** Builds a fresh MCP server bound to the shared services (once for stdio, once per request for HTTP). */
  createServer(): Server {
    const server = new Server(
      {
        name: "springboot-mcp-server-advanced",
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );
    this.setupToolHandlers(server);
    this.setupPromptHandlers(server);
    this.setupResourceHandlers(server);
    return server;
  }

  private setupResourceHandlers(server: Server) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.resourcesService.listResources(),
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: this.resourcesService.listTemplates(),
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.resourcesService.readResource(request.params.uri);
    });
  }

  private setupPromptHandlers(server: Server) {
    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: listPrompts(),
    }));

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return getPrompt(name, args);
    });
  }

  private setupToolHandlers(server: Server) {
    // Handler for listing available tools
    server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => {
      return {
        tools: ToolDefinitions.getToolList(),
      };
    });

    // Handler for executing tools
    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: rawArgs } = request.params;

      try {
        const startTime = Date.now();
        console.error(`🔧 Executing tool: ${name}`);

        const args = validateToolArguments(name, rawArgs);

        let result;
        switch (name) {
          // Original tools
          case "search_spring_docs":
            result = await this.handleSearchDocs(args);
            break;

          case "search_spring_projects":
            result = await this.handleSearchProjects(args);
            break;

          case "get_spring_project":
            result = await this.handleGetProject(args);
            break;

          case "get_all_spring_guides":
            result = await this.handleGetAllGuides(args);
            break;

          case "get_spring_guide":
            result = await this.handleGetGuide(args);
            break;

          case "get_spring_reference":
            result = await this.handleGetReference(args);
            break;

          case "search_spring_concepts":
            result = await this.handleSearchConcepts(args);
            break;

          // New advanced tools
          case "search_spring_ecosystem":
            result = await this.handleSearchEcosystem(args);
            break;

          case "get_spring_tutorial":
            result = await this.handleGetTutorial(args);
            break;

          case "compare_spring_versions":
            result = await this.handleCompareVersions(args);
            break;

          case "get_release_notes":
            result = await this.handleGetReleaseNotes(args);
            break;

          case "get_migration_guide":
            result = await this.handleGetMigrationGuide(args);
            break;

          case "get_spring_best_practices":
            result = await this.handleGetBestPractices(args);
            break;

          case "diagnose_spring_issues":
            result = await this.handleDiagnoseIssues(args);
            break;

          case "spring_cache_stats":
            result = this.handleCacheStats(args);
            break;

          case "get_spring_initializr":
            result = await this.handleGetInitializr(args);
            break;

          case "find_spring_dependency":
            result = await this.handleFindDependency(args);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        const duration = Date.now() - startTime;
        console.error(`✅ Tool ${name} completed in ${duration}ms`);
        return result;

      } catch (error) {
        console.error(`❌ Error in tool ${name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error executing tool ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // Original tool handlers (optimized)
  private async handleSearchDocs(args: any) {
    const { query, docType = "all", limit = 10 } = args;

    if (!query || typeof query !== "string") {
      throw new Error("The 'query' parameter is required and must be a string");
    }

    const results = await this.docsService.searchDocumentation(query, docType, limit);

    return {
      content: [
        {
          type: "text",
          text: `Search results for "${query}":\n\n${this.formatSearchResults(results)}`,
        },
      ],
    };
  }

  private async handleSearchProjects(args: any) {
    const { query, limit = 10 } = args;

    if (!query || typeof query !== "string") {
      throw new Error("The 'query' parameter is required and must be a string");
    }

    const results = await this.docsService.searchSpringProjects(query, limit);

    return {
      content: [
        {
          type: "text",
          text: `Spring projects found for "${query}":\n\n${this.formatSearchResults(results)}`,
        },
      ],
    };
  }

  private async handleGetProject(args: any) {
    const { projectName, offset = 0 } = args;

    if (!projectName || typeof projectName !== "string") {
      throw new Error("The 'projectName' parameter is required and must be a string");
    }

    const project = await this.docsService.getSpringProject(projectName, offset);

    return {
      content: [
        {
          type: "text",
          text: project,
        },
      ],
    };
  }

  private async handleGetAllGuides(args: any) {
    const { category, limit = 20 } = args;

    const results = await this.docsService.getAllSpringGuides(category, limit);

    return {
      content: [
        {
          type: "text",
          text: `Available Spring guides${category ? ` in category "${category}"` : ""}:\n\n${this.formatSearchResults(results)}`,
        },
      ],
    };
  }

  private async handleGetGuide(args: any) {
    const { guideId, detail_level = "medium" } = args;

    if (!guideId || typeof guideId !== "string") {
      throw new Error("The 'guideId' parameter is required and must be a string");
    }

    const guide = await this.docsService.getGuide(guideId, detail_level);

    return {
      content: [
        {
          type: "text",
          text: guide,
        },
      ],
    };
  }

  private async handleGetReference(args: any) {
    const { project = "boot", section, subsection, offset = 0, version } = args;

    if (!section || typeof section !== "string") {
      throw new Error("The 'section' parameter is required and must be a string");
    }

    // Use new multi-project method
    const reference = await this.docsService.getSpringReference(project, section, subsection, offset, version);

    return {
      content: [
        {
          type: "text",
          text: reference,
        },
      ],
    };
  }

  private async handleSearchConcepts(args: any) {
    const { concept, category } = args;

    if (!concept || typeof concept !== "string") {
      throw new Error("The 'concept' parameter is required and must be a string");
    }

    const results = await this.docsService.searchConcepts(concept, category);

    return {
      content: [
        {
          type: "text",
          text: results,
        },
      ],
    };
  }

  // New advanced tool handlers
  private async handleSearchEcosystem(args: any) {
    const { query, scope = "all", limit = 5 } = args;

    if (!query || typeof query !== "string") {
      throw new Error("The 'query' parameter is required and must be a string");
    }

    const results = await this.advancedService.searchEcosystem(query, scope, limit);

    return {
      content: [
        {
          type: "text",
          text: results, // Already formatted by advancedService
        },
      ],
    };
  }

  private async handleGetTutorial(args: any) {
    const { topic, level = "beginner", detail_level = "medium" } = args;

    if (!topic || typeof topic !== "string") {
      throw new Error("The 'topic' parameter is required and must be a string");
    }

    const tutorial = await this.advancedService.getTutorial(topic, level, detail_level);

    return {
      content: [
        {
          type: "text",
          text: tutorial,
        },
      ],
    };
  }

  private async handleCompareVersions(args: any) {
    const { version1, version2, focus = "all" } = args;

    if (!version1 || !version2) {
      throw new Error("Both 'version1' and 'version2' parameters are required");
    }

    const comparison = await this.advancedService.compareVersions(version1, version2, focus);

    return {
      content: [
        {
          type: "text",
          text: comparison,
        },
      ],
    };
  }

  private async handleGetReleaseNotes(args: any) {
    const { project = "boot", version, focus = "all" } = args;

    const notes = await this.advancedService.getReleaseNotes(project, version, focus);

    return {
      content: [
        {
          type: "text",
          text: notes,
        },
      ],
    };
  }

  private async handleGetMigrationGuide(args: any) {
    const { version, document = "auto", section, offset = 0 } = args;

    const guide = await this.docsService.getMigrationGuide(version, document, section, offset);

    return {
      content: [
        {
          type: "text",
          text: guide,
        },
      ],
    };
  }

  private async handleGetInitializr(args: any) {
    const { section = "options", query } = args;

    const text = await this.initializrService.getInitializr(section, query);

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }

  private async handleFindDependency(args: any) {
    const { need, build = "both", bootVersion } = args;

    const text = await this.initializrService.findDependency(need, build, bootVersion);

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }

  private handleCacheStats(args: any) {
    const { purge = "none" } = args;

    return {
      content: [
        {
          type: "text",
          text: this.cache.statsReport(purge),
        },
      ],
    };
  }

  private async handleGetBestPractices(args: any) {
    const { category, experience_level = "intermediate" } = args;

    if (!category || typeof category !== "string") {
      throw new Error("The 'category' parameter is required and must be a string");
    }

    const practices = await this.advancedService.getBestPractices(category, experience_level);

    return {
      content: [
        {
          type: "text",
          text: practices,
        },
      ],
    };
  }

  private async handleDiagnoseIssues(args: any) {
    const { error_message, component, stack_trace } = args;

    if (!error_message || typeof error_message !== "string") {
      throw new Error("The 'error_message' parameter is required and must be a string");
    }

    const diagnosis = await this.advancedService.diagnoseIssues(error_message, component, stack_trace);

    return {
      content: [
        {
          type: "text",
          text: diagnosis,
        },
      ],
    };
  }

  // Formatting methods
  private formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return "No results found.";
    }

    return results
      .map((result, index) => {
        if (result.type === "note") {
          return `${index + 1}. **${result.title}**
   ${result.description}

`;
        }
        return `${index + 1}. **${result.title}**
   Type: ${result.type}
   URL: ${result.url}
   Description: ${result.description || "No description available"}

`;
      })
      .join("\n");
  }

  private formatEcosystemResults(results: any): string {
    if (!results || results.totalResults === 0) {
      return `# Spring Ecosystem Search Results

No results found for "${results.query}" in scope "${results.scope}".`;
    }

    let formatted = `# Spring Ecosystem Search Results

**Query:** ${results.query}
**Scope:** ${results.scope}
**Total Results:** ${results.totalResults}

`;

    for (const [category, items] of Object.entries(results.categories)) {
      if (Array.isArray(items) && items.length > 0) {
        formatted += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

        items.forEach((item: any, index: number) => {
          formatted += `${index + 1}. **${item.title || item.name}**\n`;
          if (item.description) {
            formatted += `   ${item.description}\n`;
          }
          if (item.url) {
            formatted += `   URL: ${item.url}\n`;
          }
          formatted += "\n";
        });
      }
    }

    return formatted;
  }

  private httpServer?: RunningHttpServer;

  async run(config: ServerConfig) {
    try {
      if (config.transport === "http") {
        const loopback = ["127.0.0.1", "localhost", "::1"].includes(config.host);
        if (!loopback) {
          console.error(`⚠️  Listening on ${config.host}: the HTTP transport has no authentication, restrict access at the network level`);
        }
        this.httpServer = await startHttpServer({
          host: config.host,
          port: config.port,
          allowedHosts: config.allowedHosts,
          createServer: () => this.createServer(),
        });
        console.error(`🚀 HTTP server listening on http://${config.host}:${this.httpServer.port}/mcp`);
        return;
      }
      const server = this.createServer();
      console.error("🚀 Advanced Spring Boot MCP Server started on stdio");
      await server.connect(new StdioServerTransport());
      console.error("✅ Server connected successfully");
    } catch (error) {
      console.error("💥 Error starting server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.httpServer?.close();
  }
}

// Main entry point
let app: SpringBootMCPServerAdvanced | undefined;

async function main() {
  let config: ServerConfig;
  try {
    config = parseConfig(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(`💥 ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  app = new SpringBootMCPServerAdvanced();
  await app.run(config);
}

// Error handling
function shutdown(signal: NodeJS.Signals): void {
  console.error(`🛑 Shutting down server (${signal})...`);
  const done = () => process.exit(0);
  // Close the HTTP server first (bounded), then exit
  const bound = setTimeout(done, 3000);
  bound.unref();
  (app?.stop() ?? Promise.resolve()).then(done, done);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("💥 Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("💥 Uncaught exception:", error);
});

// Start server
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});