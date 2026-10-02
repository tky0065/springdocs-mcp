import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { CacheService } from './cache.js';
import { fetchWithRetry, FetchResult } from './http.js';
import { turndownService, extractContent } from './markdown.js';
import { absoluteSpringUrl } from './url.js';
import { SpringProjectsConfig, springProjectsConfig } from './spring-projects-config.js';
import { ReleaseFocus, filterReleaseBody, normalizeReleaseVersion } from './release-notes.js';

/** Raw GitHub release data kept in the cache (the focus filter is applied on read). */
interface CachedRelease {
  tag: string;
  name: string | null;
  publishedAt: string | null;
  url: string;
  prerelease: boolean;
  body: string | null;
}

/**
 * Advanced features service for Spring documentation - uses ONLY real Spring documentation APIs
 * No mock data - everything is fetched from actual Spring documentation sources
 */
export class AdvancedFeaturesService {
  private cache: CacheService;
  private readonly baseUrl = 'https://docs.spring.io';
  private readonly springProjectsUrl = 'https://spring.io/projects';
  private readonly springGuideUrl = 'https://spring.io/guides';

  private projectsConfig: SpringProjectsConfig;

  constructor(
    cache: CacheService = new CacheService(),
    projectsConfig: SpringProjectsConfig = springProjectsConfig
  ) {
    this.cache = cache;
    this.projectsConfig = projectsConfig;
  }

  /**
   * Get the GitHub release notes of a Spring project (a given version or the latest one),
   * optionally filtered on breaking changes, new features or deprecations.
   */
  async getReleaseNotes(project: string, version?: string, focus: ReleaseFocus = 'all'): Promise<string> {
    const config = this.projectsConfig.getProject(project);
    if (!config.githubRepo) {
      throw new Error(`Release notes are not available for ${config.displayName}`);
    }
    // Validate before any network call
    const normalized = normalizeReleaseVersion(version);
    const repo = config.githubRepo;
    const tag = normalized === undefined ? undefined : `${config.githubTagPrefix ?? ''}${normalized}`;

    const cacheKey = `release:${project}:${normalized ?? 'latest'}`;
    let release = this.cache.get<CachedRelease>(cacheKey);

    if (!release) {
      const url = tag === undefined
        ? `https://api.github.com/repos/${repo}/releases/latest`
        : `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
      const response = await this.fetchWithRetry(url);

      if (response.status === 404) {
        throw new Error(
          tag === undefined
            ? `No release found for ${config.displayName}`
            : `Release not found: ${config.displayName} ${normalized} (tag "${tag}"). See https://github.com/${repo}/releases`
        );
      }
      if (response.status === 403 || response.status === 429) {
        throw new Error('GitHub API rate limit reached (60 requests/hour without authentication). Try again later.');
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch release data: ${response.status}`);
      }

      const data = await response.json();
      release = {
        tag: data.tag_name,
        name: data.name || null,
        publishedAt: data.published_at || null,
        url: data.html_url,
        prerelease: Boolean(data.prerelease),
        body: data.body ?? null,
      };
      // Only successful responses are cached; "latest" moves, so it keeps the short TTL
      if (normalized === undefined) {
        this.cache.set(cacheKey, release);
      } else {
        this.cache.setLongTerm(cacheKey, release);
      }
    }

    let output = `# ${config.displayName} ${release.name || release.tag}\n\n`;
    output += `**Released:** ${release.publishedAt ? release.publishedAt.slice(0, 10) : 'unknown'}\n`;
    if (release.prerelease) output += `**Pre-release:** yes\n`;
    output += `**Release notes:** ${release.url}\n`;
    output += `**Focus:** ${focus}\n\n`;

    const filtered = filterReleaseBody(release.body, focus);
    if (filtered.trim()) {
      output += extractContent(filtered, 'full').content;
    } else {
      output += `No ${focus} entries found in these release notes. See the full notes: ${release.url}`;
    }
    return output;
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
      const searches: Array<[string, string, () => Promise<any[]>]> = [
        ['projects', 'projects', () => this.searchProjects(query, limit)],
        ['guides', 'guides', () => this.searchGuides(query, limit)],
        ['docs', 'documentation', () => this.searchDocumentation(query, limit)],
        ['api', 'api', () => this.searchAPI(query, limit)],
        ['ai', 'ai', () => this.searchSpringAI(query, limit)],
      ];
      const selected = searches.filter(([name]) => scope === 'all' || scope === name);

      // Run the searches concurrently; a failed one is reported, never cached
      const settled = await Promise.allSettled(selected.map(([, , run]) => run()));
      const unavailable: string[] = [];
      selected.forEach(([, category], index) => {
        const outcome = settled[index];
        if (outcome.status === 'fulfilled') {
          results.categories[category] = outcome.value;
        } else {
          results.categories[category] = [];
          unavailable.push(category);
          console.error(`Ecosystem source "${category}" failed:`, outcome.reason instanceof Error ? outcome.reason.message : outcome.reason);
        }
      });

      if (selected.length > 0 && unavailable.length === selected.length) {
        throw new Error(`Unable to search the Spring ecosystem: all sources failed (${unavailable.join(', ')})`);
      }
      results.unavailable = unavailable;

      results.totalResults = Object.values(results.categories)
        .reduce((total: number, category: any) => total + (category?.length || 0), 0);

      const formattedResult = this.formatEcosystemResults(results);
      if (unavailable.length === 0) {
        this.cache.set(cacheKey, formattedResult);
      }
      return formattedResult;
    } catch (error) {
      console.error('Error searching ecosystem:', error);
      throw error;
    }
  }

  /**
   * Get tutorials by fetching from actual Spring Boot guides
   */
  async getTutorial(topic: string, level: string = 'beginner', detailLevel: string = 'medium') {
    const cacheKey = `tutorial:${topic}:${level}:${detailLevel}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      const guides = await this.searchGuides(topic, 3);

      if (guides.length === 0) {
        return `# Tutorial Not Found\n\nNo tutorials found for topic: "${topic}"\n\nTry searching for: rest-api, jpa, security, testing, or web`;
      }

      const guide = guides[0];
      const response = await this.fetchWithRetry(guide.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch tutorial: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const content = $('.content, .guide-content, main, .markdown-body').first();

      if (content.length === 0) {
        throw new Error('No content found in guide');
      }

      const markdown = turndownService.turndown(content.html() || '');
      const { content: extractedContent, truncated } = extractContent(markdown, detailLevel);

      const result = `# ${guide.title}\n\n**Level:** ${level}\n**Detail Level:** ${detailLevel}\n**Source:** ${guide.url}\n\n${extractedContent}${truncated ? (detailLevel === 'full' ? '\n\n---\n*Content truncated at 50,000 characters even in full mode. Visit the link above for the complete tutorial.*' : '\n\n---\n*Content truncated. Use detail_level="full" for complete tutorial or visit the link above.*') : ''}`;

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching tutorial:', error);
      throw error;
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
      throw error;
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
      const markdown = turndownService.turndown(content.html() || '');

      const result = `# Spring Boot ${category.charAt(0).toUpperCase() + category.slice(1)} Best Practices

**Experience Level:** ${experienceLevel}
**Source:** ${docUrl}

${markdown.substring(0, 1000)}...

For complete documentation, visit: ${docUrl}`;

      this.cache.setLongTerm(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching best practices:', error);
      throw error;
    }
  }

  /**
   * Diagnose issues using Spring Boot documentation
   */
  async diagnoseIssues(errorMessage: string, component?: string, stackTrace?: string) {
    const digest = createHash('sha256')
      .update(JSON.stringify([errorMessage, component ?? '', stackTrace ?? '']))
      .digest('hex');
    const cacheKey = `diagnosis:${digest}`;
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
      throw error;
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
        const url = absoluteSpringUrl($project.find('a').first().attr('href'));

        if (name && description && url) {
          if (name.toLowerCase().includes(query.toLowerCase()) ||
              description.toLowerCase().includes(query.toLowerCase())) {
            projects.push({ name, description, url, type: 'project' });
          }
        }
      });

      return projects.slice(0, limit);
    } catch (error) {
      console.error('Error searching projects:', error);
      throw error;
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
        const url = absoluteSpringUrl($guide.find('a').first().attr('href'));
        const type = $guide.find('.badge, .label, .type').first().text().trim() || 'Guide';

        if (title && url) {
          if (title.toLowerCase().includes(query.toLowerCase()) ||
              description.toLowerCase().includes(query.toLowerCase())) {
            guides.push({ title, description: description || 'Spring Boot guide', url, type });
          }
        }
      });

      return guides.slice(0, limit);
    } catch (error) {
      console.error('Error searching guides:', error);
      throw error;
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
      throw error;
    }
  }

  /**
   * Search Spring AI documentation and resources
   * Covers ChatClient, RAG, embeddings, vector stores, and LLM integrations
   */
  private async searchSpringAI(query: string, limit: number): Promise<any[]> {
    try {
      const aiDocsUrl = 'https://docs.spring.io/spring-ai/reference/';
      const response = await this.fetchWithRetry(aiDocsUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch Spring AI documentation');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const aiDocs: any[] = [];

      // Search in navigation, table of contents, and main links
      $('nav a, .toc a, .nav-link, .sidebar a, .chapter a').each((index: number, element: any) => {
        const $link = $(element);
        const title = $link.text().trim();
        const href = $link.attr('href');

        if (title && href && title.toLowerCase().includes(query.toLowerCase())) {
          const url = href.startsWith('http') ? href : `${aiDocsUrl}${href}`;
          aiDocs.push({
            title: `Spring AI: ${title}`,
            url,
            type: 'Spring AI Documentation'
          });
        }
      });

      // If no results from navigation, search in content headings
      if (aiDocs.length === 0) {
        $('h1, h2, h3, h4').each((index: number, element: any) => {
          const $heading = $(element);
          const title = $heading.text().trim();
          const id = $heading.attr('id');

          if (title && title.toLowerCase().includes(query.toLowerCase())) {
            const url = id ? `${aiDocsUrl}#${id}` : aiDocsUrl;
            aiDocs.push({
              title: `Spring AI: ${title}`,
              url,
              type: 'Spring AI Documentation'
            });
          }
        });
      }

      return aiDocs.slice(0, limit);
    } catch (error) {
      console.error('Error searching Spring AI documentation:', error);
      throw error;
    }
  }

  private async searchAPI(query: string, limit: number) {
    const apis = [
      { title: 'Spring Boot API Documentation', url: 'https://docs.spring.io/spring-boot/docs/current/api/', keywords: ['boot', 'autoconfiguration', 'starters'] },
      { title: 'Spring Framework API', url: 'https://docs.spring.io/spring-framework/docs/current/javadoc-api/', keywords: ['core', 'context', 'beans', 'web'] },
      { title: 'Spring Security API', url: 'https://docs.spring.io/spring-security/site/docs/current/api/', keywords: ['security', 'authentication', 'config'] },
      { title: 'Spring Data JPA API', url: 'https://docs.spring.io/spring-data/jpa/docs/current/api/', keywords: ['jpa', 'repository', 'query'] },
      { title: 'Spring AI API', url: 'https://docs.spring.io/spring-ai/reference/api/', keywords: ['ai', 'llm', 'rag', 'embeddings', 'chatclient', 'vector', 'openai', 'anthropic'] }
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
      output += `## API\n\n`;
      results.categories.api.forEach((api: any, index: number) => {
        output += `${index + 1}. **${api.title}**\n`;
        output += `   URL: ${api.url}\n\n`;
      });
    }

    if (results.categories.ai?.length > 0) {
      output += `## Spring AI\n\n`;
      results.categories.ai.forEach((aiDoc: any, index: number) => {
        output += `${index + 1}. **${aiDoc.title}**\n`;
        if (aiDoc.description) output += `   ${aiDoc.description}\n`;
        output += `   URL: ${aiDoc.url}\n\n`;
      });
    }

    if (results.totalResults === 0) {
      output += `No results found for "${results.query}" in scope "${results.scope}".`;
    }

    if (results.unavailable?.length > 0) {
      output += `\n\n⚠️ Some sources were unavailable: ${results.unavailable.join(', ')}. Results may be incomplete.`;
    }

    return output;
  }

  private fetchWithRetry(url: string, timeout?: number, retries?: number): Promise<FetchResult> {
    return fetchWithRetry(url, timeout, retries);
  }
}
