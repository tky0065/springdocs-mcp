import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { CacheService } from './cache.js';

/**
 * Clean Spring Boot Documentation Service - uses ONLY real Spring documentation APIs
 * No mock data whatsoever - everything is fetched from actual Spring sources
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
   * Search Spring projects with caching and retry logic - REAL API ONLY
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

      // Parse actual Spring projects page
      $('.project-list .project, .project-item, .card, .project-card, .project').each((_, element: any) => {
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

      const results = projects.slice(0, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error searching Spring projects:', error);
      return [];
    }
  }

  /**
   * Get Spring project details - REAL API ONLY
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
      const url = `${this.springProjectsUrl}/${projectName.toLowerCase().replace(/\s+/g, '-')}`;
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Project not found: ${projectName}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const content = $('.project-overview, .content, main, .project-details').first();

      if (content.length === 0) {
        throw new Error('No content found for project');
      }

      const markdown = this.turndownService.turndown(content.html() || '');
      const result = `# ${projectName}\n\n${markdown}`;

      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error fetching project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Get all Spring guides - REAL API ONLY
   */
  async getAllSpringGuides(category?: string, limit: number = 20): Promise<any[]> {
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

      // Parse actual Spring guides page
      $('.guide-item, .card, .guide-card, .list-item, .guide').each((_, element: any) => {
        const $guide = $(element);
        const title = $guide.find('h2, h3, .title, .guide-title, a').first().text().trim();
        const description = $guide.find('p, .description, .summary').first().text().trim();
        const guideCategory = $guide.find('.category, .badge, .label').first().text().trim();
        const link = $guide.find('a').first().attr('href');

        if (title) {
          if (!category || guideCategory.toLowerCase().includes(category.toLowerCase())) {
            guides.push({
              type: 'spring-guide',
              title: title,
              description: description || 'Spring guide',
              category: guideCategory || 'General',
              url: link?.startsWith('http') ? link : `https://spring.io${link}`,
            });
          }
        }
      });

      const results = guides.slice(0, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error retrieving Spring guides:', error);
      return [];
    }
  }

  /**
   * Get specific guide content - REAL API ONLY
   */
  async getGuide(guideId: string): Promise<string> {
    const cacheKey = `guide:${guideId}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for guide: ${guideId}`);
      return cached;
    }

    console.error(`🔍 Fetching guide: ${guideId}`);

    // Try multiple sources for guides
    const sources = [
      { name: 'Spring.io', url: `${this.springGuideUrl}/${guideId}/` },
      { name: 'GitHub', url: `https://github.com/spring-guides/${guideId}` },
      { name: 'Spring.io alt', url: `${this.springGuideUrl}/gs/${guideId}/` }
    ];

    let content = '';
    let sourceUrl = '';

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
        console.error(`❌ ${source.name} error:`, error instanceof Error ? error.message : 'Unknown');
      }
    }

    if (!content) {
      throw new Error(`Guide not found: ${guideId}`);
    }

    try {
      const result = this.processHtmlGuide(content, guideId, sourceUrl);
      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error processing guide content:', error);
      throw error;
    }
  }

  /**
   * Get Spring reference documentation - alias for backward compatibility
   */
  async getReference(section: string, subsection?: string): Promise<string> {
    return this.getSpringReference(section, subsection);
  }

  /**
   * Get Spring reference documentation - REAL API ONLY
   */
  async getSpringReference(section: string, subsection?: string): Promise<string> {
    const cacheKey = `reference:${section}:${subsection || 'main'}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for reference: ${section}`);
      return cached;
    }

    console.error(`🔍 Fetching reference: ${section}`);
    try {
      const url = `${this.baseUrl}/spring-boot/docs/${this.springBootVersion}/reference/html/${section}.html`;
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Reference section not found: ${section}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const content = $('.content, .section, main').first();

      if (content.length === 0) {
        throw new Error('No content found in reference documentation');
      }

      const markdown = this.turndownService.turndown(content.html() || '');
      const result = `# Spring Boot Reference: ${section}\n\n${markdown}`;

      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error fetching reference ${section}:`, error);
      throw error;
    }
  }

  /**
   * Search Spring concepts - alias for backward compatibility
   */
  async searchConcepts(concept: string, category?: string): Promise<string> {
    return this.searchSpringConcepts(concept, category);
  }

  /**
   * Search Spring concepts - using real documentation
   */
  async searchSpringConcepts(concept: string, category?: string): Promise<string> {
    const cacheKey = `concepts:${concept}:${category || 'all'}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Search in Spring Boot reference documentation
      const searchUrl = `${this.baseUrl}/spring-boot/docs/current/reference/html/`;
      const response = await this.fetchWithRetry(searchUrl);

      if (!response.ok) {
        throw new Error('Unable to access Spring Boot documentation');
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Look for concept in documentation
      let conceptContent = '';
      $('h1, h2, h3, h4').each((_, element) => {
        const heading = $(element);
        const headingText = heading.text().toLowerCase();

        if (headingText.includes(concept.toLowerCase())) {
          const section = heading.parent();
          conceptContent += this.turndownService.turndown(section.html() || '');
        }
      });

      if (!conceptContent) {
        conceptContent = `# Spring Concept: ${concept}\n\nConcept not found in documentation. Try searching for more specific terms.`;
      } else {
        conceptContent = `# Spring Concept: ${concept}\n\n${conceptContent}`;
      }

      this.cache.set(cacheKey, conceptContent);
      return conceptContent;
    } catch (error) {
      console.error('Error searching concepts:', error);
      return `# Spring Concept Search Error\n\nUnable to search for concept "${concept}": ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Search documentation with real API - alias for backward compatibility
   */
  async searchDocumentation(query: string, docType: string = 'all', limit: number = 10): Promise<any[]> {
    return this.searchSpringDocs(query, docType, limit);
  }

  /**
   * Search documentation with real API
   */
  async searchSpringDocs(query: string, docType: string = 'all', limit: number = 10): Promise<any[]> {
    const cacheKey = `docs:${query}:${docType}:${limit}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const results: any[] = [];

    try {
      if (docType === 'all' || docType === 'guides') {
        const guides = await this.getAllSpringGuides(undefined, limit);
        const filteredGuides = guides.filter(guide =>
          guide.title.toLowerCase().includes(query.toLowerCase()) ||
          guide.description.toLowerCase().includes(query.toLowerCase())
        );
        results.push(...filteredGuides);
      }

      if (docType === 'all' || docType === 'projects') {
        const projects = await this.searchSpringProjects(query, limit);
        results.push(...projects);
      }

      if (docType === 'all' || docType === 'reference') {
        // Search in reference documentation
        const refResults = await this.searchInReference(query, limit);
        results.push(...refResults);
      }

      this.cache.set(cacheKey, results);
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching documentation:', error);
      return [];
    }
  }

  private async searchInReference(query: string, limit: number): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/spring-boot/docs/current/reference/html/`);
      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: any[] = [];

      $('nav a, .toc a, .nav-link').each((_, element) => {
        const link = $(element);
        const text = link.text().trim();
        const href = link.attr('href');

        if (text && href && text.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'reference',
            title: `Spring Boot: ${text}`,
            url: href.startsWith('http') ? href : `${this.baseUrl}/spring-boot/docs/current/reference/html/${href}`,
            description: `Reference documentation section`
          });
        }
      });

      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching reference:', error);
      return [];
    }
  }

  private processHtmlGuide(content: string, guideId: string, sourceUrl: string): string {
    console.log('Processing HTML content...');
    const $ = cheerio.load(content);

    // Remove navigation and footer elements
    $('nav, footer, .navbar, .sidebar, #js-sidebar').remove();

    // Get main content
    const mainContent = $('.content, .guide-content, main, .markdown-body, .guide-body, article').first();

    if (mainContent.length === 0) {
      console.log('No main content found, using body');
      $('script, style').remove();
      const bodyMarkdown = this.turndownService.turndown($('body').html() || '');
      return `# Spring Guide: ${guideId}\n\n**Source:** ${sourceUrl}\n\n${bodyMarkdown}`;
    }

    const markdown = this.turndownService.turndown(mainContent.html() || '');
    return `# Spring Guide: ${guideId}\n\n**Source:** ${sourceUrl}\n\n${markdown}`;
  }

  private async fetchWithRetry(url: string, timeout = this.REQUEST_TIMEOUT, retries = this.MAX_RETRIES): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Spring-Docs-MCP/1.2.4',
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
}