#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, CallToolRequest, ListToolsRequest } from "@modelcontextprotocol/sdk/types.js";
import { SpringBootDocsService } from "./services/springboot-docs.js";
import { ToolDefinitions } from "./tools/index.js";

/**
 * Serveur MCP pour accéder à la documentation Spring Boot - VERSION DEBUG
 */
class SpringBootMCPServerDebug {
  private server: Server;
  private docsService: SpringBootDocsService;

  constructor() {
    console.error("🚀 Initialisation du serveur MCP Spring Boot DEBUG...");
    
    this.server = new Server(
      {
        name: "springboot-mcp-server-debug",
        version: "1.2.0-debug",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    console.error("✅ Serveur MCP créé");
    
    this.docsService = new SpringBootDocsService();
    console.error("✅ Service de documentation initialisé");
    
    this.setupToolHandlers();
    console.error("✅ Gestionnaires d'outils configurés");
  }

  private setupToolHandlers() {
    console.error("🔧 Configuration des gestionnaires d'outils...");
    
    // Gestionnaire pour lister les outils disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => {
      console.error("📋 Demande de liste des outils reçue");
      const tools = ToolDefinitions.getToolList();
      console.error(`🛠️ Retour de ${tools.length} outils`);
      return { tools };
    });

    // Gestionnaire pour exécuter un outil
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      console.error(`🔧 Exécution de l'outil: ${name} avec args:`, JSON.stringify(args));

      try {
        let result;
        switch (name) {
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
          
          default:
            throw new Error(`Outil inconnu: ${name}`);
        }
        
        console.error(`✅ Outil ${name} exécuté avec succès`);
        return result;
        
      } catch (error) {
        console.error(`❌ Erreur dans l'outil ${name}:`, error);
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
    
    console.error("✅ Tous les gestionnaires configurés");
  }

  // Copiez toutes les méthodes handle* de l'original...
  private async handleSearchDocs(args: any) {
    console.error("🔍 Recherche dans la documentation Spring...");
    const query = args.query;
    const docType = args.docType || "all";
    const limit = args.limit || 10;

    const results = await this.docsService.searchDocumentation(query, docType, limit);
    
    return {
      content: [
        {
          type: "text",
          text: this.formatSearchResults(results, query),
        },
      ],
    };
  }

  private async handleSearchProjects(args: any) {
    console.error("🔍 Recherche dans les projets Spring...");
    const query = args.query;
    const limit = args.limit || 10;

    const results = await this.docsService.searchSpringProjects(query, limit);
    
    return {
      content: [
        {
          type: "text",
          text: this.formatProjectResults(results, query),
        },
      ],
    };
  }

  private async handleGetProject(args: any) {
    console.error("📦 Récupération du projet Spring...");
    const projectName = args.projectName;

    const result = await this.docsService.getSpringProject(projectName);
    
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  private async handleGetAllGuides(args: any) {
    console.error("📚 Récupération de tous les guides...");
    const category = args.category;
    const limit = args.limit || 20;

    const results = await this.docsService.getAllSpringGuides(category, limit);
    
    return {
      content: [
        {
          type: "text",
          text: this.formatGuideResults(results, category),
        },
      ],
    };
  }

  private async handleGetGuide(args: any) {
    console.error("📖 Récupération du guide Spring...");
    const guideId = args.guideId;

    const result = await this.docsService.getGuide(guideId);
    
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  private async handleGetReference(args: any) {
    console.error("📚 Récupération de la référence Spring...");
    const section = args.section;
    const subsection = args.subsection;

    const result = await this.docsService.getReference(section, subsection);
    
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  private async handleSearchConcepts(args: any) {
    console.error("💡 Recherche de concepts Spring...");
    const concept = args.concept;
    const category = args.category;

    const result = await this.docsService.searchConcepts(concept, category);
    
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  // Méthodes de formatage (copiées de l'original)
  private formatSearchResults(results: any[], query: string): string {
    if (results.length === 0) {
      return `Résultats de recherche pour "${query}":\n\nAucun résultat trouvé.`;
    }

    let formatted = `Résultats de recherche pour "${query}":\n\n`;
    
    for (const result of results) {
      formatted += `${result.title}\n`;
      formatted += `Type: ${result.type}\n`;
      formatted += `URL: ${result.url}\n`;
      if (result.description) {
        formatted += `Description: ${result.description}\n`;
      }
      formatted += "\n";
    }

    return formatted;
  }

  private formatProjectResults(results: any[], query: string): string {
    if (results.length === 0) {
      return `Projets Spring trouvés pour "${query}":\n\nAucun projet trouvé.`;
    }

    let formatted = `Projets Spring trouvés pour "${query}":\n\n`;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      formatted += `${i + 1}. **${result.title}**\n`;
      formatted += `   Type: ${result.type}\n`;
      formatted += `   URL: ${result.url}\n`;
      if (result.description) {
        formatted += `   Description: ${result.description}\n`;
      }
      formatted += "   \n";
    }

    return formatted;
  }

  private formatGuideResults(results: any[], category?: string): string {
    const categoryText = category ? ` dans la catégorie "${category}"` : "";
    
    if (results.length === 0) {
      return `Guides Spring disponibles${categoryText}:\n\nAucun guide trouvé.`;
    }

    let formatted = `Guides Spring disponibles${categoryText}:\n\n`;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      formatted += `${i + 1}. **${result.title}**\n`;
      formatted += `   Type: ${result.type}\n`;
      formatted += `   URL: ${result.url}\n`;
      if (result.description) {
        formatted += `   Description: ${result.description}\n`;
      }
      formatted += "   \n\n";
    }

    return formatted;
  }

  async run() {
    try {
      console.error("🔄 Démarrage du transport stdio...");
      const transport = new StdioServerTransport();
      console.error("🚀 Serveur MCP Spring Boot DEBUG démarré sur stdio");
      
      console.error("🔗 Connexion au transport...");
      await this.server.connect(transport);
      console.error("✅ Serveur connecté avec succès au transport");
      
      // Keep the process alive
      console.error("💚 Serveur en attente de requêtes...");
      
    } catch (error) {
      console.error("💥 Erreur fatale lors du démarrage du serveur:", error);
      throw error;
    }
  }
}

// Point d'entrée principal
async function main() {
  console.error("🎬 Démarrage du serveur MCP Spring Boot DEBUG...");
  console.error("📊 Informations système:");
  console.error("  - Node.js version:", process.version);
  console.error("  - Platform:", process.platform);
  console.error("  - Architecture:", process.arch);
  console.error("  - Répertoire de travail:", process.cwd());
  console.error("  - Arguments:", process.argv);
  
  const server = new SpringBootMCPServerDebug();
  await server.run();
}

// Gestion des erreurs avec debug
process.on("SIGINT", async () => {
  console.error("🛑 Signal SIGINT reçu - Arrêt du serveur...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("🛑 Signal SIGTERM reçu - Arrêt du serveur...");
  process.exit(0);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("💥 Rejet de promesse non géré:", reason);
  console.error("🔍 Promise:", promise);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  console.error("💥 Exception non capturée:", error);
  process.exit(1);
});

// Démarrage du serveur
console.error("🏁 Lancement du main()...");
main().catch((error) => {
  console.error("💥 Erreur fatale dans main():", error);
  process.exit(1);
});

console.error("🎯 Point d'entrée terminé, serveur en cours d'exécution...");
