import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { CacheService } from './cache.js';

/**
 * Optimized Spring Boot Documentation Service with caching and enhanced features
 */
export class SpringBootDocsServiceOptimized {
  private readonly baseUrl = 'https://docs.spring.io';
  private readonly springProjectsUrl = 'https://spring.io/projects';
  private readonly springGuideUrl = 'https://spring.io/guides';
  private readonly springBootVersion = '3.5.6';
  private turndownService: TurndownService;
  private cache: CacheService;
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    this.cache = new CacheService();

    // Cleanup cache every hour
    setInterval(() => this.cache.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Search Spring projects with caching and retry logic
   */
  async searchSpringProjects(query: string, limit: number = 10) {
    const cacheKey = `projects:${query}:${limit}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for projects search: ${query}`);
      return cached;
    }

    console.error(`🔍 Fetching projects for: ${query}`);
    try {
      const response = await this.fetchWithRetry(this.springProjectsUrl);

      if (!response.ok) {
        throw new Error('Unable to access Spring projects page');
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const projects: any[] = [];

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

      // If few results, try a broader search
      if (projects.length < 3) {
        console.error(`⚠️ Limited results for "${query}", trying broader search...`);
        // Don't add mock data - return what we found from real API
      }

      const results = projects.slice(0, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error searching Spring projects:', error);
      // Return empty array instead of mock data
      return [];
    }
  }

  /**
   * Get Spring project details with caching
   */
  async getSpringProject(projectName: string): Promise<string> {
    const cacheKey = `project:${projectName}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for project: ${projectName}`);
      return cached;
    }

    console.error(`🔍 Fetching project: ${projectName}`);
    try {
      const url = `${this.springProjectsUrl}/${projectName}`;
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Project not found: ${projectName}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const content = $('.project-overview, .content, main, .project-details').first();

      if (content.length === 0) {
        throw new Error('Project content not found');
      }

      this.cleanHtml($, content);
      const markdown = this.turndownService.turndown(content.html() || '');

      const version = $('.version, .current-version').first().text().trim();
      const status = $('.status, .project-status').first().text().trim();

      let result = `# Spring Project: ${projectName}\n\n`;
      if (version) result += `**Current Version:** ${version}\n\n`;
      if (status) result += `**Status:** ${status}\n\n`;
      result += markdown;

      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error retrieving project ${projectName}:`, error);
      throw new Error(`Unable to retrieve project: ${projectName}`);
    }
  }

  /**
   * Get all Spring guides with caching
   */
  async getAllSpringGuides(category?: string, limit: number = 20) {
    const cacheKey = `guides:${category || 'all'}:${limit}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for guides: ${category || 'all'}`);
      return cached;
    }

    console.error(`🔍 Fetching guides for category: ${category || 'all'}`);
    try {
      const response = await this.fetchWithRetry(this.springGuideUrl);

      if (!response.ok) {
        throw new Error('Unable to access Spring guides page');
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const guides: any[] = [];

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

      // If few results, try a broader search
      if (guides.length < 5) {
        console.error(`⚠️ Limited guides found for "${category || 'all'}", showing available results...`);
        // Don't add mock data - return what we found from real API
      }

      const results = guides.slice(0, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error retrieving Spring guides:', error);
      // Return empty array instead of mock data
      return [];
    }
  }

  /**
   * Get specific guide with enhanced error handling and caching
   */
  async getGuide(guideId: string): Promise<string> {
    const cacheKey = `guide:${guideId}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for guide: ${guideId}`);
      return cached;
    }

    console.error(`🔍 Fetching guide: ${guideId}`);

    try {
      let content = '';
      let sourceUrl = '';

      // Multiple sources to try
      const sources = [
        { url: `https://spring.io/guides/${guideId}/`, name: 'spring.io' },
        { url: `https://raw.githubusercontent.com/spring-guides/${guideId}/main/README.adoc`, name: 'GitHub raw' },
        { url: `https://github.com/spring-guides/${guideId}/blob/main/README.adoc`, name: 'GitHub blob' }
      ];

      for (const source of sources) {
        try {
          console.error(`Trying ${source.name}: ${source.url}`);
          const response = await this.fetchWithRetry(source.url);

          if (response.ok) {
            content = await response.text();
            sourceUrl = source.url;
            console.error(`✅ Success with ${source.name} (${content.length} chars)`);
            break;
          } else {
            console.error(`❌ ${source.name} failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`❌ ${source.name} error:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (!content) {
        return this.generateGuideNotFoundMessage(guideId);
      }

      let result = '';

      // Process different content types
      if (content.includes('<html') || content.includes('<!DOCTYPE')) {
        // HTML content
        result = this.processHtmlGuide(content, guideId, sourceUrl);
      } else if (content.includes('=') || content.includes(':toc:') || content.includes('== ')) {
        // AsciiDoc content
        result = this.processAsciiDocGuide(content, guideId, sourceUrl);
      } else {
        // Plain text
        result = `# Spring Guide: ${guideId}\n\n*Source: ${sourceUrl}*\n\n\`\`\`\n${content}\n\`\`\``;
      }

      this.cache.setLongTerm(cacheKey, result);
      return result;

    } catch (error) {
      console.error(`Error retrieving guide ${guideId}:`, error);
      return this.generateGuideErrorMessage(guideId, error);
    }
  }

  /**
   * Get reference documentation with caching
   */
  async getReference(section: string, subsection?: string): Promise<string> {
    const cacheKey = `reference:${section}:${subsection || 'main'}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for reference: ${section}`);
      return cached;
    }

    console.error(`🔍 Fetching reference: ${section}`);
    try {
      let url = `${this.baseUrl}/spring-boot/docs/${this.springBootVersion}/reference/html/`;

      if (subsection) {
        url += `${section}.html#${subsection}`;
      } else {
        url += `${section}.html`;
      }

      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Reference section not found: ${section}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const content = $('.content, .section, main').first();

      if (content.length === 0) {
        throw new Error('Section content not found');
      }

      this.cleanHtml($, content);
      const markdown = this.turndownService.turndown(content.html() || '');

      const result = `# Spring Boot Reference: ${section}\n\n${markdown}`;
      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error retrieving reference ${section}:`, error);
      throw new Error(`Unable to retrieve reference section: ${section}`);
    }
  }

  /**
   * Search concepts with caching
   */
  async searchConcepts(concept: string, category?: string) {
    const cacheKey = `concepts:${concept}:${category || 'all'}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for concepts: ${concept}`);
      return cached;
    }

    console.error(`🔍 Searching concepts: ${concept}`);
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

      this.cache.setLongTerm(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error searching concepts:', error);
      throw new Error('Unable to search Spring Boot concepts');
    }
  }

  /**
   * Enhanced documentation search with parallel processing
   */
  async searchDocumentation(query: string, docType: string = 'all', limit: number = 10) {
    const cacheKey = `docs:${query}:${docType}:${limit}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for documentation search: ${query}`);
      return cached;
    }

    console.error(`🔍 Searching documentation: ${query}`);

    try {
      const searchPromises: Promise<any[]>[] = [];

      if (docType === 'all' || docType === 'guides') {
        searchPromises.push(this.searchGuides(query, Math.ceil(limit / 3)));
      }

      if (docType === 'all' || docType === 'reference') {
        searchPromises.push(this.searchReference(query, Math.ceil(limit / 3)));
      }

      if (docType === 'all' || docType === 'api') {
        searchPromises.push(this.searchAPI(query, Math.ceil(limit / 3)));
      }

      const results = await Promise.all(searchPromises);
      const flatResults = results.flat().slice(0, limit);

      this.cache.set(cacheKey, flatResults);
      return flatResults;
    } catch (error) {
      console.error('Error searching documentation:', error);
      throw new Error('Failed to search Spring Boot documentation');
    }
  }

  // Private helper methods

  private async fetchWithRetry(url: string, timeout = this.REQUEST_TIMEOUT, retries = this.MAX_RETRIES): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Spring-Docs-MCP/1.2.3',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (attempt === retries) throw error;

        console.error(`Retry ${attempt}/${retries} for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
    throw new Error('All retry attempts failed');
  }

  private processHtmlGuide(content: string, guideId: string, sourceUrl: string): string {
    console.log('Processing HTML content...');
    const $ = cheerio.load(content);

    let mainContent = $('.guide-content, .content, main, .container .row .col-md-8, .markdown-body, article').first();

    if (mainContent.length === 0) {
      const bodyContent = $('.guide-body, .guide-content, .content').first();
      if (bodyContent.length > 0) {
        mainContent = bodyContent;
      } else {
        mainContent = $('body');
      }
    }

    if (mainContent.length > 0) {
      this.cleanHtml($, mainContent);
      const markdown = this.turndownService.turndown(mainContent.html() || '');
      return `# Spring Guide: ${guideId}\n\n*Source: ${sourceUrl}*\n\n${markdown}`;
    }

    return this.generateGuideNotFoundMessage(guideId);
  }

  private processAsciiDocGuide(content: string, guideId: string, sourceUrl: string): string {
    console.log('Processing AsciiDoc content...');
    let processedContent = content
      .replace(/^= (.+)$/gm, '# $1')
      .replace(/^== (.+)$/gm, '## $1')
      .replace(/^=== (.+)$/gm, '### $1')
      .replace(/^==== (.+)$/gm, '#### $1')
      .replace(/^\[source,(\w+)\]$/gm, '')
      .replace(/^----$/gm, '```')
      .replace(/^\+\+\+\+$/gm, '```');

    return `# Spring Guide: ${guideId}\n\n*Source: ${sourceUrl}*\n\n${processedContent}`;
  }

  private generateGuideNotFoundMessage(guideId: string): string {
    return `# Spring Guide: ${guideId}

❌ **Guide not found**

The guide "${guideId}" could not be retrieved from any source.

## 📚 Popular guides available:
- \`gs-rest-service\` - Building a RESTful Web Service
- \`gs-spring-boot\` - Building an Application with Spring Boot
- \`gs-accessing-data-jpa\` - Accessing Data with JPA
- \`gs-securing-web\` - Securing a Web Application
- \`gs-actuator-service\` - Building a RESTful Web Service with Spring Boot Actuator
- \`gs-testing-web\` - Testing the Web Layer

## 🔧 Alternative tools:
1. \`get_all_spring_guides\` - See all available guides
2. \`search_spring_docs\` - Search documentation

## 💡 Identifier format:
The identifier should be in format: \`gs-guide-name\``;
  }

  private generateGuideErrorMessage(guideId: string, error: any): string {
    return `# Spring Guide: ${guideId}

❌ **Error retrieving guide**

The guide "${guideId}" could not be retrieved.

## 🔧 Possible solutions:
1. Check the guide identifier (format: \`gs-guide-name\`)
2. Use \`get_all_spring_guides\` to see all available guides
3. Use \`search_spring_docs\` to search documentation

## 📚 Popular guides:
- \`gs-rest-service\` - Creating a RESTful Web Service
- \`gs-spring-boot\` - Building an Application with Spring Boot
- \`gs-accessing-data-jpa\` - Accessing Data with JPA
- \`gs-securing-web\` - Securing a Web Application

**Technical error:** ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  private cleanHtml($: cheerio.CheerioAPI, content: any) {
    content.find('script, style, nav, .sidebar, .toc, .feedback').remove();
    content.find('*').each((index: number, element: any) => {
      $(element).removeAttr('class').removeAttr('style').removeAttr('id');
    });
  }

  // Static data methods (unchanged from original)
  private getPopularSpringProjects() {
    return [
      {
        type: 'spring-project',
        title: 'Spring Boot',
        description: 'Create stand-alone, production-grade Spring applications easily',
        url: 'https://spring.io/projects/spring-boot',
        keywords: ['boot', 'microservices', 'web', 'standalone'],
      },
      {
        type: 'spring-project',
        title: 'Spring Framework',
        description: 'The most popular Java framework for building enterprise applications',
        url: 'https://spring.io/projects/spring-framework',
        keywords: ['framework', 'core', 'mvc', 'ioc', 'dependency injection'],
      },
      {
        type: 'spring-project',
        title: 'Spring Data',
        description: 'Provides a familiar programming model for data access',
        url: 'https://spring.io/projects/spring-data',
        keywords: ['data', 'jpa', 'mongodb', 'redis', 'repository'],
      },
      {
        type: 'spring-project',
        title: 'Spring Security',
        description: 'Powerful and highly customizable security framework',
        url: 'https://spring.io/projects/spring-security',
        keywords: ['security', 'authentication', 'authorization', 'oauth'],
      },
      {
        type: 'spring-project',
        title: 'Spring Cloud',
        description: 'Tools for rapidly building distributed system patterns',
        url: 'https://spring.io/projects/spring-cloud',
        keywords: ['cloud', 'microservices', 'distributed', 'netflix'],
      },
    ];
  }

  private getPopularSpringGuides() {
    return [
      {
        type: 'spring-guide',
        title: 'Building a RESTful Web Service',
        description: 'Learn how to create a RESTful web service with Spring Boot',
        category: 'Web',
        url: 'https://spring.io/guides/gs/rest-service/',
        id: 'gs-rest-service',
      },
      {
        type: 'spring-guide',
        title: 'Building an Application with Spring Boot',
        description: 'Learn how to build an application with minimal configuration',
        category: 'Getting Started',
        url: 'https://spring.io/guides/gs/spring-boot/',
        id: 'gs-spring-boot',
      },
      {
        type: 'spring-guide',
        title: 'Accessing Data with JPA',
        description: 'Learn how to work with JPA data persistence',
        category: 'Data',
        url: 'https://spring.io/guides/gs/accessing-data-jpa/',
        id: 'gs-accessing-data-jpa',
      },
    ];
  }

  private async searchGuides(query: string, limit: number) {
    const guides = [
      { id: 'gs-rest-service', title: 'Building a RESTful Web Service', description: 'Learn how to create a RESTful web service with Spring Boot' },
      { id: 'gs-spring-boot', title: 'Building an Application with Spring Boot', description: 'Learn how to build an application with minimal configuration' },
      { id: 'gs-accessing-data-jpa', title: 'Accessing Data with JPA', description: 'Learn how to work with JPA data persistence' },
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
        url: `${this.springGuideUrl}/${guide.id}/`,
        description: guide.description,
        id: guide.id,
      }));
  }

  private async searchReference(query: string, limit: number) {
    const sections = [
      { name: 'web', title: 'Web Applications', description: 'Building web applications with Spring Boot' },
      { name: 'data', title: 'Data Access', description: 'Working with databases and data sources' },
      { name: 'security', title: 'Security', description: 'Securing Spring Boot applications' },
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

  private async searchAPI(query: string, limit: number) {
    const apiSections = [
      { name: 'Configuration Properties', description: 'Spring Boot configuration properties reference' },
      { name: 'Auto-configuration Classes', description: 'List of auto-configuration classes' },
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

  private getSpringBootConcepts() {
    return {
      core: [
        {
          name: 'Auto-configuration',
          description: 'Mechanism that automatically configures Spring Boot based on present dependencies',
          keywords: ['auto-configuration', '@EnableAutoConfiguration', 'conditional'],
          examples: ['@SpringBootApplication', '@Conditional', 'spring.factories'],
        },
        {
          name: 'Profiles',
          description: 'Allows separating parts of application configuration for different environments',
          keywords: ['profiles', '@Profile', 'application.properties'],
          examples: ['application-dev.properties', '@Profile("prod")', 'spring.profiles.active'],
        },
      ],
      web: [
        {
          name: 'Spring MVC',
          description: 'Integrated web framework for building web applications and REST APIs',
          keywords: ['mvc', '@Controller', '@RestController', 'web'],
          examples: ['@GetMapping', '@PostMapping', '@RequestMapping'],
        },
      ],
    };
  }
}