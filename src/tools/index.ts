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
              maxLength: 200,
              description: "Les mots-clés à rechercher dans la documentation",
            },
            docType: {
              type: "string",
              enum: ["guides", "reference", "projects", "content", "all"],
              description: "Type de documentation à rechercher. `content` = recherche plein texte (classement BM25) dans les pages déjà lues par le serveur (get_spring_project, get_spring_reference, get_spring_guide) ; inclus dans `all`.",
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
              maxLength: 200,
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
              maxLength: 100,
              description: "Le nom du projet Spring (ex: 'spring-boot', 'spring-security', 'spring-data')",
            },
            offset: {
              type: "number",
              minimum: 0,
              maximum: 10000000,
              default: 0,
              description: "Position (en caractères) pour lire la suite d'un document tronqué, fournie dans le pied de la réponse précédente",
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
              maxLength: 100,
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
              maxLength: 100,
              description: "L'identifiant du guide Spring Boot (par exemple: 'rest-service', 'accessing-data-jpa')",
            },
            detail_level: {
              type: "string",
              enum: ["summary", "medium", "full"],
              description: "Niveau de détail: summary (1500 chars), medium (4000 chars), full (50000 chars)",
              default: "medium",
            },
          },
          required: ["guideId"],
        },
      },
      {
        name: "get_spring_reference",
        description: "Get specific section of Spring reference documentation (supports Spring Boot, Spring AI, Spring Framework, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              enum: ["boot", "ai", "framework", "security", "data-jpa", "batch", "integration", "kafka", "modulith", "cloud-gateway", "cloud-config"],
              description: "Spring project to search ('boot' for Spring Boot, 'ai' for Spring AI, 'framework' for Spring Framework, 'security' for Spring Security, 'data-jpa' for Spring Data JPA, 'batch' for Spring Batch, 'integration' for Spring Integration, 'kafka' for Spring for Apache Kafka, 'modulith' for Spring Modulith, 'cloud-gateway' for Spring Cloud Gateway, 'cloud-config' for Spring Cloud Config)",
              default: "boot",
            },
            section: {
              type: "string",
              maxLength: 100,
              description: "Documentation section (e.g., 'web', 'data' for Boot; 'chatclient', 'rag' for AI; 'core', 'web' for Framework)",
            },
            subsection: {
              type: "string",
              maxLength: 100,
              description: "Optional subsection for more precise navigation",
            },
            offset: {
              type: "number",
              minimum: 0,
              maximum: 10000000,
              default: 0,
              description: "Position (en caractères) pour lire la suite d'un document tronqué, fournie dans le pied de la réponse précédente",
            },
            version: {
              type: "string",
              maxLength: 20,
              description: "Version de la documentation (ex: '3.4' ou '3.4.2' ; le patch est ignoré). Omis ou 'current' = dernière version. Les anciennes versions peuvent ne pas être publiées.",
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
              maxLength: 200,
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
        description: "Search across the entire Spring ecosystem including all projects, guides, documentation, and Spring AI",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              maxLength: 200,
              description: "Keywords to search across the entire Spring ecosystem",
            },
            scope: {
              type: "string",
              enum: ["all", "projects", "guides", "docs", "api", "ai"],
              description: "Scope of search (use 'ai' for Spring AI specific searches)",
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
              maxLength: 200,
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
              description: "Content detail: summary (1500 chars), medium (4000 chars), full (50000 chars)",
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
              maxLength: 50,
              description: "First Spring Boot version to compare (e.g., '2.7.0')",
            },
            version2: {
              type: "string",
              maxLength: 50,
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
        name: "get_release_notes",
        description: "Récupère les notes de release GitHub d'un projet Spring (version précise ou dernière), avec filtre sur les changements majeurs, nouveautés ou dépréciations",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              enum: ["boot", "ai", "framework", "security", "data-jpa", "batch", "integration", "kafka", "modulith", "cloud-gateway", "cloud-config"],
              description: "Projet Spring dont on veut les notes de release",
              default: "boot",
            },
            version: {
              type: "string",
              maxLength: 50,
              description: "Version de la release (ex. '3.5.0', 'v3.5.0', '4.2.0-M2'). Si omise ou 'latest' : dernière version stable",
            },
            focus: {
              type: "string",
              enum: ["all", "breaking-changes", "new-features", "deprecations"],
              description: "Aspect à mettre en avant : tout, changements majeurs, nouveautés ou dépréciations",
              default: "all",
            },
          },
          required: [],
        },
      },
      {
        name: "get_migration_guide",
        description: "Récupère le guide de migration ou les notes de version d'upgrade de Spring Boot pour une version cible, avec filtre par section (ex: jakarta)",
        inputSchema: {
          type: "object",
          properties: {
            version: {
              type: "string",
              maxLength: 20,
              description: "Version cible de Spring Boot (ex. '3.0', '3.4' ou '3.4.2' ; le patch est ignoré)",
            },
            document: {
              type: "string",
              enum: ["auto", "migration-guide", "release-notes"],
              description: "Document à lire : auto (guide de migration pour les versions x.0, notes de version sinon), guide de migration ou notes de version",
              default: "auto",
            },
            section: {
              type: "string",
              maxLength: 50,
              description: "Mot-clé de titre : ne renvoie que les sections correspondantes (ex. 'jakarta')",
            },
            offset: {
              type: "number",
              minimum: 0,
              maximum: 10000000,
              description: "Décalage en caractères pour lire la suite d'une page paginée",
              default: 0,
            },
          },
          required: ["version"],
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
              maxLength: 2000,
              description: "Error message or issue description",
            },
            component: {
              type: "string",
              enum: ["startup", "web", "data", "security", "actuator", "configuration"],
              description: "Spring Boot component related to the issue",
            },
            stack_trace: {
              type: "string",
              maxLength: 10000,
              description: "Stack trace (optional, for more specific diagnosis)",
            },
          },
          required: ["error_message"],
        },
      },
      {
        name: "spring_cache_stats",
        description: "Affiche les statistiques du cache du serveur (entrées, expirées, capacité) et permet de purger les entrées expirées ou tout le cache",
        inputSchema: {
          type: "object",
          properties: {
            purge: {
              type: "string",
              enum: ["none", "expired", "all"],
              description: "Purge à effectuer avant d'afficher les statistiques : aucune (lecture seule), entrées expirées, ou tout le cache",
              default: "none",
            },
          },
          required: [],
        },
      },
      {
        name: "get_spring_initializr",
        description: "Liste les options de Spring Initializr (start.spring.io : build, Java, langage, versions de Spring Boot) ou ses dépendances, avec filtre texte sur l'id, le nom ou la description",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["options", "dependencies"],
              description: "Ce qu'il faut lister : les options du projet ou les dépendances disponibles",
              default: "options",
            },
            query: {
              type: "string",
              maxLength: 100,
              description: "Filtre texte sur les dépendances (id, nom, description), ex. 'jpa' ou 'security'. Ignoré pour section=options",
            },
          },
          required: [],
        },
      },
      {
        name: "find_spring_dependency",
        description: "Trouve les starters Spring correspondant à un besoin (mots-clés en anglais, ex. 'jpa', 'postgres', 'oauth2') et renvoie leurs coordonnées avec des snippets Maven et Gradle prêts à coller, d'après Spring Initializr",
        inputSchema: {
          type: "object",
          properties: {
            need: {
              type: "string",
              maxLength: 100,
              description: "Besoin exprimé en mots-clés anglais (ex. 'jpa', 'postgres driver', 'oauth2 client')",
            },
            build: {
              type: "string",
              enum: ["maven", "gradle", "both"],
              description: "Snippets à produire : Maven, Gradle ou les deux",
              default: "both",
            },
          },
          required: ["need"],
        },
      },
    ];
  }
}
