import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { CacheService } from './cache.js';

/**
 * Advanced features service for Spring documentation - uses ONLY real Spring documentation APIs
 * No mock data - everything is fetched from actual Spring documentation sources
 */
export class AdvancedFeaturesService {
  private cache: CacheService;
  private turndownService: TurndownService;
  private readonly baseUrl = 'https://docs.spring.io';
  private readonly springProjectsUrl = 'https://spring.io/projects';
  private readonly springGuideUrl = 'https://spring.io/guides';
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.cache = new CacheService();
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
  }

  /**
   * Search across the entire Spring ecosystem using real APIs
   */
  async searchEcosystem(query: string, scope: string = 'all', limit: number = 5) {
    const cacheKey = `ecosystem:${query}:${scope}:${limit}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const results: any = {
      query,
      scope,
      totalResults: 0,
      categories: {}
    };

    try {
      if (scope === 'all' || scope === 'projects') {
        results.categories.projects = await this.searchProjects(query, limit);
      }

      if (scope === 'all' || scope === 'guides') {
        results.categories.guides = await this.searchGuides(query, limit);
      }

      if (scope === 'all' || scope === 'docs') {
        results.categories.documentation = await this.searchDocumentation(query, limit);
      }

      if (scope === 'all' || scope === 'api') {
        results.categories.api = await this.searchAPI(query, limit);
      }

      results.totalResults = Object.values(results.categories)
        .reduce((total: number, category: any) => total + (category?.length || 0), 0);

      const formattedResult = this.formatEcosystemResults(results);
      this.cache.set(cacheKey, formattedResult);
      return formattedResult;
    } catch (error) {
      console.error('Error searching ecosystem:', error);
      return `# Spring Ecosystem Search Results\n\nError searching for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get tutorials by fetching from actual Spring Boot guides
   */
  async getTutorial(topic: string, level: string = 'beginner') {
    const cacheKey = `tutorial:${topic}:${level}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Search for relevant guides based on topic
      const guides = await this.searchGuides(topic, 3);

      if (guides.length === 0) {
        return `# Tutorial Not Found\n\nNo tutorials found for topic: "${topic}"\n\nTry searching for: rest-api, jpa, security, testing, or web`;
      }

      // Fetch content from the first relevant guide
      const guide = guides[0];
      const response = await this.fetchWithRetry(guide.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch tutorial: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract main content
      const content = $('.content, .guide-content, main, .markdown-body').first();

      if (content.length === 0) {
        throw new Error('No content found in guide');
      }

      // Convert to markdown and limit length
      const markdown = this.turndownService.turndown(content.html() || '');

      const result = `# ${guide.title}\n\n**Level:** ${level}\n**Source:** ${guide.url}\n\n${markdown.substring(0, 1500)}...\n\nFor complete tutorial, visit: ${guide.url}`;

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching tutorial:', error);
      return `# Tutorial Error\n\nUnable to fetch tutorial for "${topic}": ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Compare Spring Boot versions using real release notes
   */
  async compareVersions(version1: string, version2: string, focus: string = 'all') {
    const cacheKey = `versions:${version1}:${version2}:${focus}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch release notes from GitHub
      const releaseNotesUrl = `https://api.github.com/repos/spring-projects/spring-boot/releases`;
      const response = await this.fetchWithRetry(releaseNotesUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch release data: ${response.status}`);
      }

      const releases = await response.json();

      const release1 = releases.find((r: any) => r.tag_name.includes(version1));
      const release2 = releases.find((r: any) => r.tag_name.includes(version2));

      if (!release1 || !release2) {
        return `# Version Comparison: ${version1} vs ${version2}\n\nUnable to find release information for one or both versions.\n\nAvailable versions can be found at: https://github.com/spring-projects/spring-boot/releases`;
      }

      const result = `# Spring Boot Version Comparison: ${version1} vs ${version2}

## Version ${version1}
**Released:** ${new Date(release1.published_at).toLocaleDateString()}
**Release Notes:** ${release1.html_url}

${release1.body.substring(0, 1000)}...

## Version ${version2}
**Released:** ${new Date(release2.published_at).toLocaleDateString()}
**Release Notes:** ${release2.html_url}

${release2.body.substring(0, 1000)}...

## Migration Recommendations
1. Review the full release notes at the URLs above
2. Check for breaking changes in your dependencies
3. Update your Spring Boot version gradually
4. Test thoroughly in a staging environment

For detailed migration guides, visit: https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide`;

      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error comparing versions:', error);
      return `# Version Comparison Error\n\nUnable to compare versions ${version1} and ${version2}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get best practices from official Spring documentation
   */
  async getBestPractices(category: string, experienceLevel: string = 'intermediate') {
    const cacheKey = `practices:${category}:${experienceLevel}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Map categories to Spring Boot documentation sections
      const docSections: { [key: string]: string } = {
        'architecture': 'spring-boot-features.html#boot-features-spring-application',
        'performance': 'actuator.html#actuator.metrics',
        'security': 'spring-security.html',
        'testing': 'spring-boot-features.html#boot-features-testing',
        'configuration': 'spring-boot-features.html#boot-features-external-config',
        'deployment': 'deployment.html'
      };

      const section = docSections[category];
      if (!section) {
        const availableCategories = Object.keys(docSections).join(', ');
        return `# Best Practices Not Found\n\nCategory "${category}" not available.\n\n## Available Categories:\n${availableCategories}\n\nPlease use one of the available categories.`;
      }

      // Fetch from Spring Boot reference documentation
      const docUrl = `${this.baseUrl}/spring-boot/docs/current/reference/html/${section}`;
      const response = await this.fetchWithRetry(docUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch documentation: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract relevant content
      const content = $('.content, .sect1, .chapter, main').first();

      if (content.length === 0) {
        throw new Error('No content found in documentation');
      }

      // Convert to markdown and format
      const markdown = this.turndownService.turndown(content.html() || '');

      const result = `# Spring Boot ${category.charAt(0).toUpperCase() + category.slice(1)} Best Practices

**Experience Level:** ${experienceLevel}
**Source:** ${docUrl}

${markdown.substring(0, 1000)}...

For complete documentation, visit: ${docUrl}`;

      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching best practices:', error);
      return `# Best Practices Error\n\nUnable to fetch best practices for "${category}": ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Diagnose issues using Spring Boot documentation
   */
  async diagnoseIssues(errorMessage: string, component?: string, stackTrace?: string) {
    const cacheKey = `diagnosis:${errorMessage.substring(0, 50)}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Search for the error in Spring Boot documentation
      const searchQuery = errorMessage.split(' ').slice(0, 3).join(' ');
      const docs = await this.searchDocumentation(searchQuery, 3);

      let result = `# Spring Boot Issue Diagnosis\n\n**Error:** ${errorMessage}\n`;

      if (component) {
        result += `**Component:** ${component}\n`;
      }

      result += `\n## Relevant Documentation\n\n`;

      if (docs.length > 0) {
        docs.forEach((doc, index) => {
          result += `${index + 1}. **${doc.title}**\n   ${doc.url}\n\n`;
        });
      } else {
        result += `No specific documentation found for this error.\n\n`;
      }

      result += `## General Troubleshooting Steps\n\n`;
      result += `1. Check the Spring Boot documentation: https://docs.spring.io/spring-boot/docs/current/reference/html/\n`;
      result += `2. Search Spring Boot issues: https://github.com/spring-projects/spring-boot/issues\n`;
      result += `3. Enable debug logging: \`logging.level.org.springframework=DEBUG\`\n`;
      result += `4. Check actuator health endpoint: \`/actuator/health\`\n\n`;

      if (stackTrace) {
        result += `## Stack Trace Analysis\n\nFor detailed stack trace analysis, consider:\n`;
        result += `- Looking for the root cause in the stack trace\n`;
        result += `- Checking for configuration issues\n`;
        result += `- Verifying dependency versions\n\n`;
      }

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error diagnosing issue:', error);
      return `# Diagnosis Error\n\nUnable to diagnose issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Real implementation methods (no mock data)

  private async searchProjects(query: string, limit: number) {
    try {
      const response = await this.fetchWithRetry(this.springProjectsUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Spring projects');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const projects: any[] = [];

      $('.project-list .project, .project-item, .card, .project-card').each((index: number, element: any) => {
        const $project = $(element);
        const name = $project.find('h2, h3, .title, .project-title, .card-title').first().text().trim();
        const description = $project.find('p, .description, .summary, .card-text').first().text().trim();
        const link = $project.find('a').first().attr('href');

        if (name && description) {
          const url = link?.startsWith('http') ? link : `https://spring.io${link}`;

          if (name.toLowerCase().includes(query.toLowerCase()) ||
              description.toLowerCase().includes(query.toLowerCase())) {
            projects.push({ name, description, url, type: 'project' });
          }
        }
      });

      return projects.slice(0, limit);
    } catch (error) {
      console.error('Error searching projects:', error);
      return [];
    }
  }

  private async searchGuides(query: string, limit: number) {
    try {
      const response = await this.fetchWithRetry(this.springGuideUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Spring guides');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const guides: any[] = [];

      $('.guide-item, .card, .guide-card, .list-item').each((index: number, element: any) => {
        const $guide = $(element);
        const title = $guide.find('h2, h3, .title, .guide-title, .card-title, a').first().text().trim();
        const description = $guide.find('p, .description, .summary, .card-text').first().text().trim();
        const link = $guide.find('a').first().attr('href');
        const type = $guide.find('.badge, .label, .type').first().text().trim() || 'Guide';

        if (title) {
          const url = link?.startsWith('http') ? link : `https://spring.io${link}`;

          if (title.toLowerCase().includes(query.toLowerCase()) ||
              description.toLowerCase().includes(query.toLowerCase())) {
            guides.push({ title, description: description || 'Spring Boot guide', url, type });
          }
        }
      });

      return guides.slice(0, limit);
    } catch (error) {
      console.error('Error searching guides:', error);
      return [];
    }
  }

  private async searchDocumentation(query: string, limit: number) {
    try {
      const bootDocsUrl = `${this.baseUrl}/spring-boot/docs/current/reference/html/`;
      const response = await this.fetchWithRetry(bootDocsUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch Spring Boot documentation');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const docs: any[] = [];

      $('nav a, .toc a, .nav-link, .chapter a').each((index: number, element: any) => {
        const $link = $(element);
        const title = $link.text().trim();
        const href = $link.attr('href');

        if (title && href && title.toLowerCase().includes(query.toLowerCase())) {
          const url = href.startsWith('http') ? href : `${bootDocsUrl}${href}`;
          docs.push({ title: `Spring Boot: ${title}`, url, type: 'Reference Documentation' });
        }
      });

      return docs.slice(0, limit);
    } catch (error) {
      console.error('Error searching documentation:', error);
      return [];
    }
  }

  private async searchAPI(query: string, limit: number) {
    const apis = [
      { title: 'Spring Boot API Documentation', url: 'https://docs.spring.io/spring-boot/docs/current/api/', keywords: ['boot', 'autoconfiguration', 'starters'] },
      { title: 'Spring Framework API', url: 'https://docs.spring.io/spring-framework/docs/current/javadoc-api/', keywords: ['core', 'context', 'beans', 'web'] },
      { title: 'Spring Security API', url: 'https://docs.spring.io/spring-security/site/docs/current/api/', keywords: ['security', 'authentication', 'config'] },
      { title: 'Spring Data JPA API', url: 'https://docs.spring.io/spring-data/jpa/docs/current/api/', keywords: ['jpa', 'repository', 'query'] }
    ];

    const queryLower = query.toLowerCase();
    return apis
      .filter(a =>
        a.title.toLowerCase().includes(queryLower) ||
        a.keywords.some(keyword => keyword.toLowerCase().includes(queryLower))
      )
      .map(a => ({ title: a.title, url: a.url, type: 'API Documentation' }))
      .slice(0, limit);
  }

  private formatEcosystemResults(results: any): string {
    let output = `# Spring Ecosystem Search Results\n\n`;
    output += `**Query:** ${results.query}\n`;
    output += `**Scope:** ${results.scope}\n`;
    output += `**Total Results:** ${results.totalResults}\n\n`;

    if (results.categories.projects?.length > 0) {
      output += `## Projects\n\n`;
      results.categories.projects.forEach((project: any, index: number) => {
        output += `${index + 1}. **${project.name}**\n`;
        output += `   ${project.description}\n`;
        output += `   URL: ${project.url}\n\n`;
      });
    }

    if (results.categories.guides?.length > 0) {
      output += `## Guides\n\n`;
      results.categories.guides.forEach((guide: any, index: number) => {
        output += `${index + 1}. **${guide.title}**\n`;
        if (guide.description) output += `   ${guide.description}\n`;
        output += `   URL: ${guide.url}\n\n`;
      });
    }

    if (results.categories.documentation?.length > 0) {
      output += `## Documentation\n\n`;
      results.categories.documentation.forEach((doc: any, index: number) => {
        output += `${index + 1}. **${doc.title}**\n`;
        output += `   URL: ${doc.url}\n\n`;
      });
    }

    if (results.categories.api?.length > 0) {
      output += `## Api\n\n`;
      results.categories.api.forEach((api: any, index: number) => {
        output += `${index + 1}. **${api.title}**\n`;
        output += `   URL: ${api.url}\n\n`;
      });
    }

    if (results.totalResults === 0) {
      output += `No results found for "${results.query}" in scope "${results.scope}".`;
    }

    return output;
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
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw new Error('All retry attempts failed');
  }
}