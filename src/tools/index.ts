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
        name: "search_spring_projects",
        description: "Recherche parmi tous les projets Spring disponibles sur spring.io/projects",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Les mots-clés à rechercher dans les projets Spring (ex: 'security', 'data', 'cloud')",
            },
            limit: {
              type: "number",
              description: "Nombre maximum de projets à retourner",
              default: 10,
              minimum: 1,
              maximum: 20,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_spring_project",
        description: "Récupère les détails complets d'un projet Spring spécifique",
        inputSchema: {
          type: "object",
          properties: {
            projectName: {
              type: "string",
              description: "Le nom du projet Spring (ex: 'spring-boot', 'spring-security', 'spring-data')",
            },
          },
          required: ["projectName"],
        },
      },
      {
        name: "get_all_spring_guides",
        description: "Récupère la liste de tous les guides Spring disponibles, optionnellement filtrés par catégorie",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Catégorie de guides à filtrer (ex: 'Web', 'Data', 'Security', 'Testing')",
            },
            limit: {
              type: "number",
              description: "Nombre maximum de guides à retourner",
              default: 20,
              minimum: 1,
              maximum: 50,
            },
          },
          required: [],
        },
      },
      {
        name: "get_spring_guide",
        description: "Récupère le contenu d'un guide Spring Boot spécifique avec niveau de détail configurable",
        inputSchema: {
          type: "object",
          properties: {
            guideId: {
              type: "string",
              description: "L'identifiant du guide Spring Boot (par exemple: 'gs-rest-service', 'gs-accessing-data-jpa')",
            },
            detail_level: {
              type: "string",
              enum: ["summary", "medium", "full"],
              description: "Niveau de détail: summary (1500 chars), medium (4000 chars), full (8000 chars)",
              default: "medium",
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
      {
        name: "search_spring_ecosystem",
        description: "Search across the entire Spring ecosystem including all projects, guides, and documentation",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Keywords to search across the entire Spring ecosystem",
            },
            scope: {
              type: "string",
              enum: ["all", "projects", "guides", "docs", "api"],
              description: "Scope of search",
              default: "all",
            },
            limit: {
              type: "number",
              description: "Maximum number of results per category",
              default: 5,
              minimum: 1,
              maximum: 20,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_spring_tutorial",
        description: "Get step-by-step tutorials for specific Spring Boot features",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Tutorial topic (e.g., 'rest-api', 'jpa', 'security', 'testing')",
            },
            level: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"],
              description: "Tutorial difficulty level",
              default: "beginner",
            },
            detail_level: {
              type: "string",
              enum: ["summary", "medium", "full"],
              description: "Content detail: summary (1500 chars), medium (4000 chars), full (8000 chars)",
              default: "medium",
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "compare_spring_versions",
        description: "Compare different Spring Boot versions and their features",
        inputSchema: {
          type: "object",
          properties: {
            version1: {
              type: "string",
              description: "First Spring Boot version to compare (e.g., '2.7.0')",
            },
            version2: {
              type: "string",
              description: "Second Spring Boot version to compare (e.g., '3.0.0')",
            },
            focus: {
              type: "string",
              enum: ["all", "breaking-changes", "new-features", "deprecations"],
              description: "What aspect to focus on in comparison",
              default: "all",
            },
          },
          required: ["version1", "version2"],
        },
      },
      {
        name: "get_spring_best_practices",
        description: "Get best practices and recommendations for Spring Boot development",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["architecture", "performance", "security", "testing", "configuration", "deployment"],
              description: "Category of best practices",
            },
            experience_level: {
              type: "string",
              enum: ["beginner", "intermediate", "expert"],
              description: "Developer experience level",
              default: "intermediate",
            },
          },
          required: ["category"],
        },
      },
      {
        name: "diagnose_spring_issues",
        description: "Diagnose common Spring Boot issues and provide solutions",
        inputSchema: {
          type: "object",
          properties: {
            error_message: {
              type: "string",
              description: "Error message or issue description",
            },
            component: {
              type: "string",
              enum: ["startup", "web", "data", "security", "actuator", "configuration"],
              description: "Spring Boot component related to the issue",
            },
            stack_trace: {
              type: "string",
              description: "Stack trace (optional, for more specific diagnosis)",
            },
          },
          required: ["error_message"],
        },
      },
    ];
  }
}
