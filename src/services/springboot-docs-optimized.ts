import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { CacheService } from './cache.js';
import { SpringProjectsConfig, springProjectsConfig } from './spring-projects-config.js';

/**
 * Spring Documentation Service - Supports multiple Spring projects (Boot, AI, Framework, etc.)
 * Uses ONLY real Spring documentation APIs - no mock data
 *
 * Architecture: Configuration-driven multi-project support via SpringProjectsConfig
 */
export class SpringBootDocsServiceOptimized {
  private readonly baseUrl = 'https://docs.spring.io';
  private readonly springProjectsUrl = 'https://spring.io/projects';
  private readonly springGuideUrl = 'https://spring.io/guides';
  private projectsConfig: SpringProjectsConfig;
  private turndownService: TurndownService;
  private cache: CacheService;
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;

  constructor(projectsConfig: SpringProjectsConfig = springProjectsConfig) {
    this.projectsConfig = projectsConfig;
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    this.cache = new CacheService();

    // Cleanup cache every hour
    setInterval(() => this.cache.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Extract content intelligently based on detail level
   * Preserves code blocks, key sections, and structure
   */
  private extractIntelligentContent(markdown: string, detailLevel: string = 'medium'): string {
    const limits: { [key: string]: number } = {
      'summary': 1500,
      'medium': 4000,
      'full': 8000
    };

    const maxLength = limits[detailLevel] || limits['medium'];

    // If content is smaller than limit, return as-is
    if (markdown.length <= maxLength) {
      return markdown;
    }

    // Extract important sections
    const lines = markdown.split('\n');
    let result = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    let currentLength = 0;

    for (const line of lines) {
      // Track code blocks
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (!inCodeBlock && codeBlockContent) {
          // Keep complete code blocks
          const blockToAdd = codeBlockContent + line + '\n';
          if (currentLength + blockToAdd.length <= maxLength * 0.8) { // Reserve 20% for text
            result += blockToAdd;
            currentLength += blockToAdd.length;
          }
          codeBlockContent = '';
        } else {
          codeBlockContent = line + '\n';
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
      }

      // Keep headers, important lines
      if (line.startsWith('#') || line.startsWith('-') || line.startsWith('*') || line.trim().startsWith('>')) {
        if (currentLength + line.length + 1 <= maxLength) {
          result += line + '\n';
          currentLength += line.length + 1;
        }
      } else if (line.trim() && currentLength + line.length + 1 <= maxLength) {
        result += line + '\n';
        currentLength += line.length + 1;
      }

      if (currentLength >= maxLength) break;
    }

    return result.trim();
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
      const projectUrl = `${this.springProjectsUrl}/${projectName.toLowerCase().replace(/\s+/g, '-')}`;
      const result = `# ${projectName}\n\n${markdown.substring(0, 1500)}...\n\nFor complete project info, visit: ${projectUrl}`;

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
  async getGuide(guideId: string, detailLevel: string = 'medium'): Promise<string> {
    const cacheKey = `guide:${guideId}:${detailLevel}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for guide: ${guideId} (${detailLevel})`);
      return cached;
    }

    console.error(`🔍 Fetching guide: ${guideId} with detail level: ${detailLevel}`);

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
      const result = this.processHtmlGuide(content, guideId, sourceUrl, detailLevel);
      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error processing guide content:', error);
      throw error;
    }
  }

  /**
   * Get Spring reference documentation - backward compatibility (defaults to Spring Boot)
   * @deprecated Use getSpringReference('boot', section) instead
   */
  async getReference(section: string, subsection?: string): Promise<string> {
    console.warn('getReference() is deprecated. Use getSpringReference("boot", section) instead');
    return this.getSpringReference('boot', section, subsection);
  }

  /**
   * Get Spring reference documentation for any Spring project
   * Supports: Spring Boot, Spring AI, Spring Framework, and future projects
   *
   * @param projectId - Project identifier ('boot', 'ai', 'framework', etc.)
   * @param section - Documentation section (e.g., 'web', 'chatclient', 'core')
   * @param subsection - Optional subsection for deeper navigation
   * @returns Formatted markdown documentation with source URL
   */
  async getSpringReference(
    projectId: string,
    section: string,
    subsection?: string
  ): Promise<string> {
    const cacheKey = `reference:${projectId}:${section}:${subsection || 'main'}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for reference: ${projectId}/${section}`);
      return cached;
    }

    console.error(`🔍 Fetching reference: ${projectId}/${section}`);
    try {
      // Validate project exists
      const project = this.projectsConfig.getProject(projectId);

      // Validate section if project defines allowed sections
      if (!this.projectsConfig.validateSection(projectId, section)) {
        const availableSections = project.referenceSections?.join(', ') || 'any';
        throw new Error(
          `Invalid section "${section}" for ${project.displayName}. Available sections: ${availableSections}`
        );
      }

      // Build URL using configuration
      const url = this.projectsConfig.buildReferenceUrl(projectId, section);
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Reference section not found: ${project.displayName} / ${section}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract content (selector may vary by project)
      const content = $('.content, .section, main, article').first();

      if (content.length === 0) {
        throw new Error(`No content found in ${project.displayName} reference documentation`);
      }

      const markdown = this.turndownService.turndown(content.html() || '');
      const result = `# ${project.displayName} Reference: ${section}\n\n${markdown.substring(0, 1500)}...\n\nFor complete reference, visit: ${url}`;

      // Use project-specific cache strategy
      const cacheTTL = this.projectsConfig.getCacheTTL(projectId);
      if (project.cacheStrategy === 'long') {
        this.cache.setLongTerm(cacheKey, result);
      } else {
        this.cache.set(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      console.error(`Error fetching reference ${projectId}/${section}:`, error);
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
      let foundSections = 0;
      const maxSections = 3;

      $('h1, h2, h3, h4').each((_, element) => {
        if (foundSections >= maxSections) return false; // Stop after 3 sections

        const heading = $(element);
        const headingText = heading.text().toLowerCase();

        if (headingText.includes(concept.toLowerCase())) {
          const section = heading.parent();
          const sectionMarkdown = this.turndownService.turndown(section.html() || '');
          conceptContent += sectionMarkdown.substring(0, 500) + '\n\n';
          foundSections++;
        }
      });

      if (!conceptContent) {
        conceptContent = `# Spring Concept: ${concept}\n\nConcept not found in documentation. Try searching for more specific terms.`;
      } else {
        conceptContent = `# Spring Concept: ${concept}\n\n${conceptContent}\n\nFor complete documentation, visit: ${searchUrl}`;
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

  private processHtmlGuide(content: string, guideId: string, sourceUrl: string, detailLevel: string = 'medium'): string {
    console.log(`Processing HTML content with detail level: ${detailLevel}...`);
    const $ = cheerio.load(content);

    // Remove navigation and footer elements
    $('nav, footer, .navbar, .sidebar, #js-sidebar').remove();

    // Get main content
    const mainContent = $('.content, .guide-content, main, .markdown-body, .guide-body, article').first();

    let markdown: string;
    if (mainContent.length === 0) {
      console.log('No main content found, using body');
      $('script, style').remove();
      markdown = this.turndownService.turndown($('body').html() || '');
    } else {
      markdown = this.turndownService.turndown(mainContent.html() || '');
    }

    // Use intelligent extraction
    const extractedContent = this.extractIntelligentContent(markdown, detailLevel);
    const needsTruncation = markdown.length > extractedContent.length;

    return `# Spring Guide: ${guideId}\n\n**Source:** ${sourceUrl}\n**Detail Level:** ${detailLevel}\n\n${extractedContent}${needsTruncation ? '\n\n---\n*Content truncated for brevity. Use detail_level="full" for complete guide or visit the link above.*' : ''}`;
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