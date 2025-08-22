#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, CallToolRequest, ListToolsRequest } from "@modelcontextprotocol/sdk/types.js";
import { SpringBootDocsService } from "./services/springboot-docs.js";
import { ToolDefinitions } from "./tools/index.js";

/**
 * Serveur MCP pour accéder à la documentation Spring Boot
 */
class SpringBootMCPServer {
  private server: Server;
  private docsService: SpringBootDocsService;

  constructor() {
    this.server = new Server(
      {
        name: "springboot-mcp-server",
        version: "1.2.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.docsService = new SpringBootDocsService();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // Gestionnaire pour lister les outils disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => {
      return {
        tools: ToolDefinitions.getToolList(),
      };
    });

    // Gestionnaire pour exécuter un outil
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "search_spring_docs":
            return await this.handleSearchDocs(args);
          
          case "search_spring_projects":
            return await this.handleSearchProjects(args);
          
          case "get_spring_project":
            return await this.handleGetProject(args);
          
          case "get_all_spring_guides":
            return await this.handleGetAllGuides(args);
          
          case "get_spring_guide":
            return await this.handleGetGuide(args);
          
          case "get_spring_reference":
            return await this.handleGetReference(args);
          
          case "search_spring_concepts":
            return await this.handleSearchConcepts(args);
          
          default:
            throw new Error(`Outil inconnu: ${name}`);
        }
      } catch (error) {
        console.error(`Erreur dans l'outil ${name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
        return {
          content: [
            {
              type: "text",
              text: `Erreur lors de l'exécution de l'outil ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleSearchProjects(args: any) {
    const { query, limit = 10 } = args;
    
    if (!query || typeof query !== "string") {
      throw new Error("Le paramètre 'query' est requis et doit être une chaîne de caractères");
    }

    const results = await this.docsService.searchSpringProjects(query, limit);
    
    return {
      content: [
        {
          type: "text",
          text: `Projets Spring trouvés pour "${query}":\n\n${this.formatSearchResults(results)}`,
        },
      ],
    };
  }

  private async handleGetProject(args: any) {
    const { projectName } = args;
    
    if (!projectName || typeof projectName !== "string") {
      throw new Error("Le paramètre 'projectName' est requis et doit être une chaîne de caractères");
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
          text: `Guides Spring disponibles${category ? ` dans la catégorie "${category}"` : ""}:\n\n${this.formatSearchResults(results)}`,
        },
      ],
    };
  }

  private async handleSearchDocs(args: any) {
    const { query, docType = "all", limit = 10 } = args;
    
    if (!query || typeof query !== "string") {
      throw new Error("Le paramètre 'query' est requis et doit être une chaîne de caractères");
    }

    const results = await this.docsService.searchDocumentation(query, docType, limit);
    
    return {
      content: [
        {
          type: "text",
          text: `Résultats de recherche pour "${query}":\n\n${this.formatSearchResults(results)}`,
        },
      ],
    };
  }

  private async handleGetGuide(args: any) {
    const { guideId } = args;
    
    if (!guideId || typeof guideId !== "string") {
      throw new Error("Le paramètre 'guideId' est requis et doit être une chaîne de caractères");
    }

    const guide = await this.docsService.getGuide(guideId);
    
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
    const { section, subsection } = args;
    
    if (!section || typeof section !== "string") {
      throw new Error("Le paramètre 'section' est requis et doit être une chaîne de caractères");
    }

    const reference = await this.docsService.getReference(section, subsection);
    
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
      throw new Error("Le paramètre 'concept' est requis et doit être une chaîne de caractères");
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

  private formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return "Aucun résultat trouvé.";
    }

    return results
      .map((result, index) => {
        return `${index + 1}. **${result.title}**
   Type: ${result.type}
   URL: ${result.url}
   Description: ${result.description || "Aucune description disponible"}
   
`;
      })
      .join("\n");
  }

  private formatConceptResults(results: any): string {
    if (!results || Object.keys(results).length === 0) {
      return "Aucun concept trouvé.";
    }

    let formatted = `# Concepts Spring Boot\n\n`;
    
    for (const [category, concepts] of Object.entries(results)) {
      formatted += `## ${category}\n\n`;
      
      if (Array.isArray(concepts)) {
        concepts.forEach((concept: any) => {
          formatted += `- **${concept.name}**: ${concept.description}\n`;
          if (concept.examples && concept.examples.length > 0) {
            formatted += `  Exemples: ${concept.examples.join(", ")}\n`;
          }
        });
      }
      
      formatted += "\n";
    }

    return formatted;
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      console.error("Serveur MCP Spring Boot démarré sur stdio");
      await this.server.connect(transport);
      console.error("Serveur connecté avec succès");
    } catch (error) {
      console.error("Erreur lors du démarrage du serveur:", error);
      throw error;
    }
  }
}

// Point d'entrée principal
async function main() {
  const server = new SpringBootMCPServer();
  await server.run();
}

// Gestion des erreurs
process.on("SIGINT", async () => {
  console.error("Arrêt du serveur...");
  process.exit(0);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("Rejet de promesse non géré:", reason);
  process.exit(1);
});

// Démarrage du serveur
main().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
});
