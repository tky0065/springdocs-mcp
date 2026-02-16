#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, CallToolRequest, ListToolsRequest } from "@modelcontextprotocol/sdk/types.js";
import { SpringBootDocsServiceOptimized } from "./services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "./services/advanced-features.js";
import { ToolDefinitions } from "./tools/index.js";

/**
 * Enhanced Spring Documentation MCP Server with advanced features and optimizations
 */
class SpringBootMCPServerAdvanced {
  private server: Server;
  private docsService: SpringBootDocsServiceOptimized;
  private advancedService: AdvancedFeaturesService;

  constructor() {
    this.server = new Server(
      {
        name: "springboot-mcp-server-advanced",
        version: "1.2.4",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.docsService = new SpringBootDocsServiceOptimized();
    this.advancedService = new AdvancedFeaturesService();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // Handler for listing available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => {
      return {
        tools: ToolDefinitions.getToolList(),
      };
    });

    // Handler for executing tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        const startTime = Date.now();
        console.error(`🔧 Executing tool: ${name}`);

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

          case "get_spring_best_practices":
            result = await this.handleGetBestPractices(args);
            break;

          case "diagnose_spring_issues":
            result = await this.handleDiagnoseIssues(args);
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
    const { projectName } = args;

    if (!projectName || typeof projectName !== "string") {
      throw new Error("The 'projectName' parameter is required and must be a string");
    }

    const project = await this.docsService.getSpringProject(projectName);

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
    const { project = "boot", section, subsection } = args;

    if (!section || typeof section !== "string") {
      throw new Error("The 'section' parameter is required and must be a string");
    }

    // Use new multi-project method
    const reference = await this.docsService.getSpringReference(project, section, subsection);

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
          text: this.formatConceptResults(results),
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
        return `${index + 1}. **${result.title}**
   Type: ${result.type}
   URL: ${result.url}
   Description: ${result.description || "No description available"}

`;
      })
      .join("\n");
  }

  private formatConceptResults(results: any): string {
    if (!results || Object.keys(results).length === 0) {
      return "No concepts found.";
    }

    let formatted = `# Spring Boot Concepts\n\n`;

    for (const [category, concepts] of Object.entries(results)) {
      formatted += `## ${category}\n\n`;

      if (Array.isArray(concepts)) {
        concepts.forEach((concept: any) => {
          formatted += `- **${concept.name}**: ${concept.description}\n`;
          if (concept.examples && concept.examples.length > 0) {
            formatted += `  Examples: ${concept.examples.join(", ")}\n`;
          }
        });
      }

      formatted += "\n";
    }

    return formatted;
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

  async run() {
    try {
      const transport = new StdioServerTransport();
      console.error("🚀 Advanced Spring Boot MCP Server started on stdio");
      await this.server.connect(transport);
      console.error("✅ Server connected successfully");
    } catch (error) {
      console.error("💥 Error starting server:", error);
      throw error;
    }
  }
}

// Main entry point
async function main() {
  const server = new SpringBootMCPServerAdvanced();
  await server.run();
}

// Error handling
process.on("SIGINT", async () => {
  console.error("🛑 Shutting down server...");
  process.exit(0);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("💥 Unhandled promise rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  console.error("💥 Uncaught exception:", error);
  process.exit(1);
});

// Start server
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});