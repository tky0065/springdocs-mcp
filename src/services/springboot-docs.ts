import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

/**
 * Service pour accéder et traiter la documentation Spring Boot
 */
export class SpringBootDocsService {
  private readonly baseUrl = 'https://docs.spring.io';
  private readonly springProjectsUrl = 'https://spring.io/projects';
  private readonly springGuideUrl = 'https://spring.io/guides';
  private readonly springBootVersion = '3.2.0'; // Version par défaut
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
  }

  /**
   * Recherche dans tous les projets Spring
   */
  async searchSpringProjects(query: string, limit: number = 10) {
    try {
      const response = await fetch(this.springProjectsUrl);
      
      if (!response.ok) {
        throw new Error('Impossible d\'accéder à la page des projets Spring');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      const projects: any[] = [];
      
      // Extraire les projets depuis la page
      $('.project-list .project, .project-item, .card').each((index: number, element: any) => {
        const $project = $(element);
        const title = $project.find('h2, h3, .title, .project-title').first().text().trim();
        const description = $project.find('p, .description, .summary').first().text().trim();
        const link = $project.find('a').first().attr('href');
        
        if (title && (
          title.toLowerCase().includes(query.toLowerCase()) ||
          description.toLowerCase().includes(query.toLowerCase())
        )) {
          projects.push({
            type: 'spring-project',
            title: title,
            description: description,
            url: link?.startsWith('http') ? link : `https://spring.io${link}`,
          });
        }
      });

      // Si peu de résultats, ajouter des projets populaires
      if (projects.length < 3) {
        const popularProjects = this.getPopularSpringProjects()
          .filter(project => 
            project.title.toLowerCase().includes(query.toLowerCase()) ||
            project.description.toLowerCase().includes(query.toLowerCase()) ||
            project.keywords.some((k: string) => k.toLowerCase().includes(query.toLowerCase()))
          );
        
        projects.push(...popularProjects);
      }

      return projects.slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la recherche des projets Spring:', error);
      // Fallback sur les projets populaires
      return this.getPopularSpringProjects()
        .filter(project => 
          project.title.toLowerCase().includes(query.toLowerCase()) ||
          project.description.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit);
    }
  }

  /**
   * Récupère les détails d'un projet Spring spécifique
   */
  async getSpringProject(projectName: string): Promise<string> {
    try {
      const url = `${this.springProjectsUrl}/${projectName}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Projet non trouvé: ${projectName}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extrait le contenu principal du projet
      const content = $('.project-overview, .content, main, .project-details').first();
      
      if (content.length === 0) {
        throw new Error('Contenu du projet non trouvé');
      }

      // Nettoie et convertit en Markdown
      this.cleanHtml($, content);
      const markdown = this.turndownService.turndown(content.html() || '');
      
      // Ajouter des informations supplémentaires
      const version = $('.version, .current-version').first().text().trim();
      const status = $('.status, .project-status').first().text().trim();
      
      let result = `# Projet Spring: ${projectName}\n\n`;
      if (version) result += `**Version actuelle:** ${version}\n\n`;
      if (status) result += `**Statut:** ${status}\n\n`;
      result += markdown;
      
      return result;
    } catch (error) {
      console.error(`Erreur lors de la récupération du projet ${projectName}:`, error);
      throw new Error(`Impossible de récupérer le projet: ${projectName}`);
    }
  }

  /**
   * Récupère tous les guides Spring disponibles
   */
  async getAllSpringGuides(category?: string, limit: number = 20) {
    try {
      const response = await fetch(this.springGuideUrl);
      
      if (!response.ok) {
        throw new Error('Impossible d\'accéder à la page des guides Spring');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      const guides: any[] = [];
      
      // Extraire les guides depuis la page
      $('.guide-list .guide, .guide-item, .card').each((index: number, element: any) => {
        const $guide = $(element);
        const title = $guide.find('h2, h3, .title, .guide-title').first().text().trim();
        const description = $guide.find('p, .description, .summary').first().text().trim();
        const link = $guide.find('a').first().attr('href');
        const guideCategory = $guide.find('.category, .tag').first().text().trim();
        
        if (title && (!category || guideCategory.toLowerCase().includes(category.toLowerCase()))) {
          guides.push({
            type: 'spring-guide',
            title: title,
            description: description,
            category: guideCategory,
            url: link?.startsWith('http') ? link : `https://spring.io${link}`,
            id: link?.split('/').pop()?.replace('.html', '') || title.toLowerCase().replace(/\s+/g, '-'),
          });
        }
      });

      // Si peu de résultats, ajouter des guides populaires
      if (guides.length < 5) {
        const popularGuides = this.getPopularSpringGuides();
        guides.push(...popularGuides);
      }

      return guides.slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la récupération des guides Spring:', error);
      // Fallback sur les guides populaires
      return this.getPopularSpringGuides().slice(0, limit);
    }
  }

  /**
   * Liste des projets Spring populaires
   */
  private getPopularSpringProjects() {
    return [
      {
        type: 'spring-project',
        title: 'Spring Boot',
        description: 'Créez des applications Spring de qualité production facilement',
        url: 'https://spring.io/projects/spring-boot',
        keywords: ['boot', 'microservices', 'web', 'standalone'],
      },
      {
        type: 'spring-project',
        title: 'Spring Framework',
        description: 'Le framework Java le plus populaire pour créer des applications d\'entreprise',
        url: 'https://spring.io/projects/spring-framework',
        keywords: ['framework', 'core', 'mvc', 'ioc', 'dependency injection'],
      },
      {
        type: 'spring-project',
        title: 'Spring Data',
        description: 'Fournit un modèle de programmation familier pour l\'accès aux données',
        url: 'https://spring.io/projects/spring-data',
        keywords: ['data', 'jpa', 'mongodb', 'redis', 'repository'],
      },
      {
        type: 'spring-project',
        title: 'Spring Security',
        description: 'Framework de sécurité puissant et hautement personnalisable',
        url: 'https://spring.io/projects/spring-security',
        keywords: ['security', 'authentication', 'authorization', 'oauth'],
      },
      {
        type: 'spring-project',
        title: 'Spring Cloud',
        description: 'Outils pour développer rapidement des patterns de systèmes distribués',
        url: 'https://spring.io/projects/spring-cloud',
        keywords: ['cloud', 'microservices', 'distributed', 'netflix'],
      },
      {
        type: 'spring-project',
        title: 'Spring Integration',
        description: 'Implémentation des Enterprise Integration Patterns',
        url: 'https://spring.io/projects/spring-integration',
        keywords: ['integration', 'messaging', 'endpoints', 'channels'],
      },
      {
        type: 'spring-project',
        title: 'Spring Batch',
        description: 'Framework pour le traitement batch robuste',
        url: 'https://spring.io/projects/spring-batch',
        keywords: ['batch', 'processing', 'jobs', 'steps'],
      },
      {
        type: 'spring-project',
        title: 'Spring WebFlux',
        description: 'Framework web réactif pour Spring',
        url: 'https://spring.io/projects/spring-framework',
        keywords: ['reactive', 'webflux', 'non-blocking', 'async'],
      },
    ];
  }

  /**
   * Liste des guides Spring populaires
   */
  private getPopularSpringGuides() {
    return [
      {
        type: 'spring-guide',
        title: 'Building a RESTful Web Service',
        description: 'Apprendre à créer un service web RESTful avec Spring Boot',
        category: 'Web',
        url: 'https://spring.io/guides/gs/rest-service/',
        id: 'gs-rest-service',
      },
      {
        type: 'spring-guide',
        title: 'Building an Application with Spring Boot',
        description: 'Apprendre à construire une application avec une configuration minimale',
        category: 'Getting Started',
        url: 'https://spring.io/guides/gs/spring-boot/',
        id: 'gs-spring-boot',
      },
      {
        type: 'spring-guide',
        title: 'Accessing Data with JPA',
        description: 'Apprendre à travailler avec la persistance de données JPA',
        category: 'Data',
        url: 'https://spring.io/guides/gs/accessing-data-jpa/',
        id: 'gs-accessing-data-jpa',
      },
      {
        type: 'spring-guide',
        title: 'Securing a Web Application',
        description: 'Apprendre à protéger votre application web avec Spring Security',
        category: 'Security',
        url: 'https://spring.io/guides/gs/securing-web/',
        id: 'gs-securing-web',
      },
      {
        type: 'spring-guide',
        title: 'Building a RESTful Web Service with Spring Boot Actuator',
        description: 'Apprendre à créer un service prêt pour la production',
        category: 'Production',
        url: 'https://spring.io/guides/gs/actuator-service/',
        id: 'gs-actuator-service',
      },
      {
        type: 'spring-guide',
        title: 'Testing the Web Layer',
        description: 'Apprendre à tester les applications Spring Boot',
        category: 'Testing',
        url: 'https://spring.io/guides/gs/testing-web/',
        id: 'gs-testing-web',
      },
      {
        type: 'spring-guide',
        title: 'Building a Reactive RESTful Web Service',
        description: 'Créer des services web réactifs avec Spring WebFlux',
        category: 'Reactive',
        url: 'https://spring.io/guides/gs/reactive-rest-service/',
        id: 'gs-reactive-rest-service',
      },
      {
        type: 'spring-guide',
        title: 'Consuming a RESTful Web Service',
        description: 'Apprendre à récupérer des données depuis un endpoint REST',
        category: 'Web',
        url: 'https://spring.io/guides/gs/consuming-rest/',
        id: 'gs-consuming-rest',
      },
    ];
  }
  async searchDocumentation(query: string, docType: string = 'all', limit: number = 10) {
    const results: any[] = [];

    try {
      // Recherche dans les guides
      if (docType === 'all' || docType === 'guides') {
        const guideResults = await this.searchGuides(query, Math.ceil(limit / 3));
        results.push(...guideResults);
      }

      // Recherche dans la documentation de référence
      if (docType === 'all' || docType === 'reference') {
        const refResults = await this.searchReference(query, Math.ceil(limit / 3));
        results.push(...refResults);
      }

      // Recherche dans l'API documentation
      if (docType === 'all' || docType === 'api') {
        const apiResults = await this.searchAPI(query, Math.ceil(limit / 3));
        results.push(...apiResults);
      }

      return results.slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la recherche dans la documentation:', error);
      throw new Error('Impossible de rechercher dans la documentation Spring Boot');
    }
  }

  /**
   * Récupère un guide Spring Boot spécifique
   */
  async getGuide(guideId: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/guides/${guideId}/`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Guide non trouvé: ${guideId}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extrait le contenu principal du guide
      const content = $('.content, .guide-content, main').first();
      
      if (content.length === 0) {
        throw new Error('Contenu du guide non trouvé');
      }

      // Nettoie et convertit en Markdown
      this.cleanHtml($, content);
      const markdown = this.turndownService.turndown(content.html() || '');
      
      return `# Guide Spring Boot: ${guideId}\n\n${markdown}`;
    } catch (error) {
      console.error(`Erreur lors de la récupération du guide ${guideId}:`, error);
      throw new Error(`Impossible de récupérer le guide: ${guideId}`);
    }
  }

  /**
   * Récupère une section de la documentation de référence
   */
  async getReference(section: string, subsection?: string): Promise<string> {
    try {
      let url = `${this.baseUrl}/spring-boot/docs/${this.springBootVersion}/reference/html/`;
      
      if (subsection) {
        url += `${section}.html#${subsection}`;
      } else {
        url += `${section}.html`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Section de référence non trouvée: ${section}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extrait le contenu principal
      const content = $('.content, .section, main').first();
      
      if (content.length === 0) {
        throw new Error('Contenu de la section non trouvé');
      }

      this.cleanHtml($, content);
      const markdown = this.turndownService.turndown(content.html() || '');
      
      return `# Spring Boot Reference: ${section}\n\n${markdown}`;
    } catch (error) {
      console.error(`Erreur lors de la récupération de la référence ${section}:`, error);
      throw new Error(`Impossible de récupérer la section de référence: ${section}`);
    }
  }

  /**
   * Recherche des concepts Spring Boot
   */
  async searchConcepts(concept: string, category?: string) {
    try {
      const concepts = this.getSpringBootConcepts();
      const results: any = {};

      for (const [cat, conceptList] of Object.entries(concepts)) {
        if (category && cat !== category) continue;

        const matches = conceptList.filter((c: any) => 
          c.name.toLowerCase().includes(concept.toLowerCase()) ||
          c.description.toLowerCase().includes(concept.toLowerCase()) ||
          c.keywords.some((k: string) => k.toLowerCase().includes(concept.toLowerCase()))
        );

        if (matches.length > 0) {
          results[cat] = matches;
        }
      }

      return results;
    } catch (error) {
      console.error('Erreur lors de la recherche de concepts:', error);
      throw new Error('Impossible de rechercher les concepts Spring Boot');
    }
  }

  /**
   * Recherche dans les guides Spring Boot
   */
  private async searchGuides(query: string, limit: number) {
    // Liste des guides populaires Spring Boot
    const guides = [
      { id: 'gs-rest-service', title: 'Building a RESTful Web Service', description: 'Learn how to create a RESTful web service with Spring Boot' },
      { id: 'gs-spring-boot', title: 'Building an Application with Spring Boot', description: 'Learn how to build an application with minimal configuration' },
      { id: 'gs-accessing-data-jpa', title: 'Accessing Data with JPA', description: 'Learn how to work with JPA data persistence' },
      { id: 'gs-securing-web', title: 'Securing a Web Application', description: 'Learn how to protect your web application with Spring Security' },
      { id: 'gs-consuming-rest', title: 'Consuming a RESTful Web Service', description: 'Learn how to retrieve data from a REST endpoint' },
      { id: 'gs-testing-web', title: 'Testing the Web Layer', description: 'Learn how to test Spring Boot applications' },
      { id: 'gs-actuator-service', title: 'Building a RESTful Web Service with Spring Boot Actuator', description: 'Learn how to create a production-ready service' },
    ];

    return guides
      .filter(guide => 
        guide.title.toLowerCase().includes(query.toLowerCase()) ||
        guide.description.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map(guide => ({
        type: 'guide',
        title: guide.title,
        url: `${this.baseUrl}/guides/${guide.id}/`,
        description: guide.description,
        id: guide.id,
      }));
  }

  /**
   * Recherche dans la documentation de référence
   */
  private async searchReference(query: string, limit: number) {
    const sections = [
      { name: 'web', title: 'Web Applications', description: 'Building web applications with Spring Boot' },
      { name: 'data', title: 'Data Access', description: 'Working with databases and data sources' },
      { name: 'security', title: 'Security', description: 'Securing Spring Boot applications' },
      { name: 'actuator', title: 'Production-ready Features', description: 'Monitoring and managing applications' },
      { name: 'testing', title: 'Testing', description: 'Testing Spring Boot applications' },
      { name: 'configuration', title: 'Configuration', description: 'Configuring Spring Boot applications' },
    ];

    return sections
      .filter(section => 
        section.title.toLowerCase().includes(query.toLowerCase()) ||
        section.description.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map(section => ({
        type: 'reference',
        title: section.title,
        url: `${this.baseUrl}/spring-boot/docs/${this.springBootVersion}/reference/html/${section.name}.html`,
        description: section.description,
        section: section.name,
      }));
  }

  /**
   * Recherche dans la documentation de l'API
   */
  private async searchAPI(query: string, limit: number) {
    const apiSections = [
      { name: 'Configuration Properties', description: 'Spring Boot configuration properties reference' },
      { name: 'Auto-configuration Classes', description: 'List of auto-configuration classes' },
      { name: 'Starter Dependencies', description: 'Available Spring Boot starters' },
      { name: 'Test Utilities', description: 'Testing utilities and annotations' },
    ];

    return apiSections
      .filter(section => 
        section.name.toLowerCase().includes(query.toLowerCase()) ||
        section.description.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map(section => ({
        type: 'api',
        title: section.name,
        url: `${this.baseUrl}/spring-boot/docs/${this.springBootVersion}/api/`,
        description: section.description,
      }));
  }

  /**
   * Nettoie le HTML pour une meilleure conversion en Markdown
   */
  private cleanHtml($: cheerio.CheerioAPI, content: any) {
    // Supprime les éléments indésirables
    content.find('script, style, nav, .sidebar, .toc, .feedback').remove();
    
    // Nettoie les classes CSS
    content.find('*').each((index: number, element: any) => {
      $(element).removeAttr('class').removeAttr('style').removeAttr('id');
    });
  }

  /**
   * Base de connaissances des concepts Spring Boot
   */
  private getSpringBootConcepts() {
    return {
      core: [
        {
          name: 'Auto-configuration',
          description: 'Mécanisme qui configure automatiquement Spring Boot basé sur les dépendances présentes',
          keywords: ['auto-configuration', '@EnableAutoConfiguration', 'conditional'],
          examples: ['@SpringBootApplication', '@Conditional', 'spring.factories'],
        },
        {
          name: 'Profiles',
          description: 'Permet de séparer les parties de la configuration d\'application pour différents environnements',
          keywords: ['profiles', '@Profile', 'application.properties'],
          examples: ['application-dev.properties', '@Profile("prod")', 'spring.profiles.active'],
        },
        {
          name: 'Properties',
          description: 'Système de configuration externalisée de Spring Boot',
          keywords: ['properties', '@ConfigurationProperties', '@Value'],
          examples: ['application.yml', '@ConfigurationProperties', 'Environment'],
        },
      ],
      web: [
        {
          name: 'Spring MVC',
          description: 'Framework web intégré pour construire des applications web et des API REST',
          keywords: ['mvc', '@Controller', '@RestController', 'web'],
          examples: ['@GetMapping', '@PostMapping', '@RequestMapping'],
        },
        {
          name: 'Embedded Server',
          description: 'Serveur web intégré (Tomcat, Jetty, Undertow) pour déployer des applications standalone',
          keywords: ['embedded', 'tomcat', 'jetty', 'server'],
          examples: ['server.port', 'TomcatServletWebServerFactory'],
        },
      ],
      data: [
        {
          name: 'Spring Data JPA',
          description: 'Simplifie l\'accès aux données avec JPA/Hibernate',
          keywords: ['jpa', 'hibernate', '@Entity', '@Repository'],
          examples: ['JpaRepository', '@Query', '@Transactional'],
        },
        {
          name: 'Database Migration',
          description: 'Gestion des évolutions de schéma de base de données',
          keywords: ['flyway', 'liquibase', 'migration', 'schema'],
          examples: ['db/migration', 'V1__Initial_schema.sql'],
        },
      ],
      security: [
        {
          name: 'Spring Security',
          description: 'Framework de sécurité pour l\'authentification et l\'autorisation',
          keywords: ['security', 'authentication', 'authorization', '@Secured'],
          examples: ['SecurityConfig', '@PreAuthorize', 'HttpSecurity'],
        },
      ],
      testing: [
        {
          name: 'Test Slices',
          description: 'Tests d\'intégration focalisés sur des couches spécifiques',
          keywords: ['test', '@WebMvcTest', '@DataJpaTest', 'slice'],
          examples: ['@SpringBootTest', '@TestConfiguration', 'TestRestTemplate'],
        },
      ],
      production: [
        {
          name: 'Actuator',
          description: 'Fonctionnalités de monitoring et gestion pour les applications en production',
          keywords: ['actuator', 'monitoring', 'health', 'metrics'],
          examples: ['/actuator/health', '/actuator/metrics', 'HealthIndicator'],
        },
      ],
    };
  }
}
