/**
 * Définitions des outils MCP pour l'accès à la documentation Spring Boot
 */

export class ToolDefinitions {
  static getToolList() {
    return [
      {
        name: "search_spring_docs",
        description: "Recherche dans la documentation Spring Boot avec des mots-clés",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Les mots-clés à rechercher dans la documentation",
            },
            docType: {
              type: "string",
              enum: ["guides", "reference", "api", "all"],
              description: "Type de documentation à rechercher",
              default: "all",
            },
            limit: {
              type: "number",
              description: "Nombre maximum de résultats à retourner",
              default: 10,
              minimum: 1,
              maximum: 50,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_spring_guide",
        description: "Récupère le contenu complet d'un guide Spring Boot spécifique",
        inputSchema: {
          type: "object",
          properties: {
            guideId: {
              type: "string",
              description: "L'identifiant du guide Spring Boot (par exemple: 'gs-rest-service', 'gs-accessing-data-jpa')",
            },
          },
          required: ["guideId"],
        },
      },
      {
        name: "get_spring_reference",
        description: "Récupère une section spécifique de la documentation de référence Spring Boot",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "La section de la documentation de référence (par exemple: 'web', 'data', 'security')",
            },
            subsection: {
              type: "string",
              description: "Sous-section optionnelle pour une recherche plus précise",
            },
          },
          required: ["section"],
        },
      },
      {
        name: "search_spring_concepts",
        description: "Recherche des concepts Spring Boot par catégorie avec des explications détaillées",
        inputSchema: {
          type: "object",
          properties: {
            concept: {
              type: "string",
              description: "Le concept Spring Boot à rechercher (par exemple: 'auto-configuration', 'profiles', 'actuator')",
            },
            category: {
              type: "string",
              enum: ["core", "web", "data", "security", "testing", "production"],
              description: "Catégorie du concept pour filtrer les résultats",
            },
          },
          required: ["concept"],
        },
      },
    ];
  }
}
