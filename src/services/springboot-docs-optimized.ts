import * as cheerio from 'cheerio';
import { CacheService } from './cache.js';
import { fetchWithRetry, FetchResult } from './http.js';
import { turndownService, extractContent, pageMarkdown } from './markdown.js';
import { absoluteSpringUrl, assertSafeSegment, normalizeVersion } from './url.js';
import { fetchSpringGuidesList } from './guides-list.js';

import { WikiDocument, resolveWikiDocument, wikiPageName, wikiPageUrl, expectedWikiTitle, extractWikiMarkdown, selectSections } from './boot-wiki.js';
import { SpringProjectsConfig, springProjectsConfig } from './spring-projects-config.js';
import { SearchIndex } from './search-index.js';

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
  private cache: CacheService;
  private searchIndex: SearchIndex;

  constructor(
    projectsConfig: SpringProjectsConfig = springProjectsConfig,
    cache: CacheService = new CacheService(),
    searchIndex: SearchIndex = new SearchIndex()
  ) {
    this.projectsConfig = projectsConfig;
    this.cache = cache;
    this.searchIndex = searchIndex;
  }

  /** Feeds the full-text index with a page already fetched; never breaks the read path. */
  private indexPage(docId: string, title: string, url: string, text: string): void {
    try {
      this.searchIndex.add(docId, { title, url, text });
    } catch (error) {
      console.error(`Content index failure for ${docId}:`, error instanceof Error ? error.message : error);
    }
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
        const url = absoluteSpringUrl($project.find('a').first().attr('href'));

        if (url && title && (
          title.toLowerCase().includes(query.toLowerCase()) ||
          description.toLowerCase().includes(query.toLowerCase())
        )) {
          projects.push({
            type: 'spring-project',
            title: title,
            description: description,
            url: url,
          });
        }
      });

      const results = projects.slice(0, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error searching Spring projects:', error);
      throw error;
    }
  }

  /**
   * Get the full markdown of a Spring project page (cached) - REAL API ONLY
   */
  async getProjectMarkdown(projectName: string): Promise<{ markdown: string; url: string }> {
    const slug = assertSafeSegment(projectName.toLowerCase().replace(/\s+/g, '-'), 'project name');
    const cacheKey = `project:${projectName}`;
    const cached = this.cache.get<{ markdown: string; url: string }>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for project: ${projectName}`);
      return cached;
    }

    console.error(`🔍 Fetching project: ${projectName}`);
    try {
      const url = `${this.springProjectsUrl}/${slug}`;
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

      const markdown = turndownService.turndown(content.html() || '');

      // Cache the full markdown so later pages need no new fetch
      this.indexPage(`project:${slug}`, projectName, url, markdown);
      const entry = { markdown, url };
      this.cache.setLongTerm(cacheKey, entry);
      return entry;
    } catch (error) {
      console.error(`Error fetching project ${projectName}:`, error);
      throw error;
    }
  }

  /**
   * Get Spring project details - REAL API ONLY
   */
  async getSpringProject(projectName: string, offset = 0): Promise<string> {
    const { markdown, url } = await this.getProjectMarkdown(projectName);
    return this.formatPage(projectName, markdown, url, offset, 'For complete project info, visit');
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
      const guides = await fetchSpringGuidesList(category);

      const results = guides.slice(0, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error retrieving Spring guides:', error);
      throw error;
    }
  }

  /**
   * Get specific guide content - REAL API ONLY
   */
  async getGuide(guideId: string, detailLevel: string = 'medium'): Promise<string> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(guideId) || guideId.includes('..')) {
      throw new Error(`Invalid guideId "${guideId}": only letters, digits, '.', '_' and '-' are allowed`);
    }
    // Getting-started guides live under /guides/gs/<name>/; accept the repository-style "gs-<name>" too
    const name = guideId.replace(/^gs-/, '');
    if (!name) {
      throw new Error(`Invalid guideId "${guideId}": the guide name is empty`);
    }
    const safeId = encodeURIComponent(name);
    const cacheKey = `guide:${name}:${detailLevel}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for guide: ${guideId} (${detailLevel})`);
      return cached;
    }

    console.error(`🔍 Fetching guide: ${guideId} with detail level: ${detailLevel}`);

    // Fallbacks tried in order: getting-started guide, then top-level guide path
    const sources = [
      { name: 'Spring.io getting-started', url: `${this.springGuideUrl}/gs/${safeId}/` },
      { name: 'Spring.io', url: `${this.springGuideUrl}/${safeId}/` }
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
      this.indexPage(`guide:${name}`, `Guide: ${name}`, sourceUrl, result);
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
   * @param offset - Character offset for paginated reads
   * @param version - Optional documentation version ('3.4' or '3.4.2'; omitted/'current' = latest)
   * @returns Formatted markdown documentation with source URL
   */
  async getSpringReference(
    projectId: string,
    section: string,
    subsection?: string,
    offset = 0,
    version?: string
  ): Promise<string> {
    const safeSection = assertSafeSegment(section, 'section');
    const safeSubsection = subsection ? assertSafeSegment(subsection, 'subsection') : undefined;
    // Validate the version before any cache or network access
    const normalizedVersion = normalizeVersion(version);
    const baseKey = `reference:${projectId}:${section}:${subsection || 'main'}`;
    const cacheKey = normalizedVersion ? `${baseKey}:v${normalizedVersion}` : baseKey;
    const cached = this.cache.get<{ markdown: string; url: string }>(cacheKey);
    if (cached) {
      console.error(`✅ Cache hit for reference: ${projectId}/${section}`);
      return this.formatPage(this.referenceTitle(projectId, section, subsection), cached.markdown, cached.url, offset, 'For complete reference, visit');
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
      const url = this.projectsConfig.buildReferenceUrl(projectId, safeSection, safeSubsection, normalizedVersion);
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        if (normalizedVersion) {
          throw new Error(
            `Reference not found for ${project.displayName} version ${normalizedVersion} (this version may not be published at the current documentation site; omit 'version' for the latest or try a more recent one)`
          );
        }
        throw new Error(`Reference section not found: ${project.displayName} / ${section}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract content (selector may vary by project)
      const content = $('.content, .section, main, article').first();

      if (content.length === 0) {
        throw new Error(`No content found in ${project.displayName} reference documentation`);
      }

      const markdown = turndownService.turndown(content.html() || '');
      const entry = { markdown, url };
      this.indexPage(
        `reference:${projectId}:${normalizedVersion ?? 'current'}:${section}:${subsection ?? 'main'}`,
        this.referenceTitle(projectId, section, subsection),
        url,
        markdown
      );

      // Use project-specific cache strategy
      const cacheTTL = this.projectsConfig.getCacheTTL(projectId);
      if (project.cacheStrategy === 'long') {
        this.cache.setLongTerm(cacheKey, entry);
      } else {
        this.cache.set(cacheKey, entry, cacheTTL);
      }

      return this.formatPage(this.referenceTitle(projectId, section, subsection), markdown, url, offset, 'For complete reference, visit');
    } catch (error) {
      console.error(`Error fetching reference ${projectId}/${section}:`, error);
      throw error;
    }
  }

  /**
   * Get the Spring Boot migration guide or upgrade release notes from the GitHub wiki
   *
   * @param version - Target version ('3.0', '3.4' or '3.4.2'; the patch is ignored)
   * @param document - 'auto' (migration guide for x.0, release notes otherwise) or an explicit document
   * @param section - Optional keyword; only matching headings (with sub-sections) are returned
   * @param offset - Character offset for paginated reads
   */
  async getMigrationGuide(
    version: string,
    document: 'auto' | WikiDocument = 'auto',
    section?: string,
    offset = 0
  ): Promise<string> {
    // Resolve version and document before any cache or network access
    const normalizedVersion = normalizeVersion(version);
    if (!normalizedVersion) {
      throw new Error('A target Spring Boot version is required (e.g. "3.0", "3.4" or "4.0")');
    }
    const resolved = resolveWikiDocument(normalizedVersion, document);
    const keyword = section?.trim() || undefined;
    const cacheKey = `migration:${resolved}:${normalizedVersion}`;

    let entry = this.cache.get<{ markdown: string; url: string; title: string }>(cacheKey);
    if (entry) {
      console.error(`✅ Cache hit for migration page: ${cacheKey}`);
    } else {
      const url = wikiPageUrl(wikiPageName(normalizedVersion, resolved));
      console.error(`🔍 Fetching migration page: ${url}`);
      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch Spring Boot wiki page: ${response.status}`);
      }
      const html = await response.text();
      const { markdown, title } = extractWikiMarkdown(html, expectedWikiTitle(normalizedVersion, resolved), url);
      entry = { markdown, url, title };
      // Only successful, verified pages are cached
      this.cache.setLongTerm(cacheKey, entry);
    }

    const markdown = keyword ? selectSections(entry.markdown, keyword, entry.title) : entry.markdown;
    const title = keyword ? `${entry.title} (section: ${keyword})` : entry.title;
    return this.formatPage(title, markdown, entry.url, offset, 'For the complete page, visit');
  }

  private referenceTitle(projectId: string, section: string, subsection?: string): string {
    const project = this.projectsConfig.getProject(projectId);
    return `${project.displayName} Reference: ${subsection ? `${section}/${subsection}` : section}`;
  }

  /**
   * Format one page of a full markdown document with a pagination footer
   */
  private formatPage(title: string, markdown: string, url: string, offset: number, linkLabel: string): string {
    const page = pageMarkdown(markdown, offset);
    if (offset >= page.total) {
      return `No content at offset ${offset} (total: ${page.total} characters).`;
    }
    let result = `# ${title}\n\n${page.content}`;
    if (page.nextOffset !== null) {
      result += `\n\n---\nPartie ${page.start}–${page.end} sur ${page.total} caractères. Pour la suite, rappeler avec offset=${page.nextOffset}.`;
    }
    return `${result}\n\n${linkLabel}: ${url}`;
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
          const sectionMarkdown = turndownService.turndown(section.html() || '');
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
      throw error;
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
    const allowedDocTypes = ['guides', 'reference', 'projects', 'content', 'all'];
    if (!allowedDocTypes.includes(docType)) {
      throw new Error(`Invalid docType "${docType}". Allowed: ${allowedDocTypes.join(', ')}`);
    }
    const cacheKey = `docs:${query}:${docType}:${limit}`;
    // Only the title sources are cached: content hits depend on the current state of the index
    const titles = this.cache.get<any[]>(cacheKey) ?? await this.searchTitleSources(query, docType, limit, cacheKey);
    if (docType !== 'all' && docType !== 'content') {
      return titles.slice(0, limit);
    }
    return this.mergeContentResults(titles, query, limit);
  }

  private mergeContentResults(titles: any[], query: string, limit: number): any[] {
    const seen = new Set(titles.map(result => result.url));
    let content: any[] = [];
    try {
      content = this.searchIndex.search(query, limit)
        .filter(hit => !seen.has(hit.url))
        .map(hit => ({ type: 'content', title: hit.title, url: hit.url, description: hit.snippet, score: hit.score }));
    } catch (error) {
      console.error('Content search failed:', error instanceof Error ? error.message : error);
    }
    // Content takes the slots titles leave free, and at most half of them otherwise
    const contentSlots = Math.min(content.length, Math.max(Math.floor(limit / 2), limit - titles.length));
    const merged = [...titles.slice(0, limit - contentSlots), ...content.slice(0, contentSlots)];
    if (this.searchIndex.size === 0) {
      merged.push({
        type: 'note',
        title: 'Content index is empty',
        description: 'Full-text search covers pages already read: read a page first (get_spring_project, get_spring_reference or get_spring_guide), then search again.'
      });
    }
    return merged;
  }

  private async searchTitleSources(query: string, docType: string, limit: number, cacheKey: string): Promise<any[]> {
    const results: any[] = [];

    const sources: Array<[string, () => Promise<any[]>]> = [];
    if (docType === 'all' || docType === 'guides') {
      sources.push(['guides', async () => {
        const guides = await this.getAllSpringGuides(undefined, Number.MAX_SAFE_INTEGER);
        return guides.filter(guide =>
          guide.title.toLowerCase().includes(query.toLowerCase()) ||
          guide.description.toLowerCase().includes(query.toLowerCase())
        ).slice(0, limit);
      }]);
    }
    if (docType === 'all' || docType === 'projects') {
      sources.push(['projects', () => this.searchSpringProjects(query, limit)]);
    }
    if (docType === 'all' || docType === 'reference') {
      sources.push(['reference', () => this.searchInReference(query, limit)]);
    }

    // A failing source must not be hidden nor cached: fail if all fail, otherwise return partial results uncached
    const failures: string[] = [];
    const settled = await Promise.allSettled(sources.map(([, run]) => run()));
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        failures.push(sources[index][0]);
        console.error(`Documentation source "${sources[index][0]}" failed:`, outcome.reason instanceof Error ? outcome.reason.message : outcome.reason);
      }
    });

    if (sources.length > 0 && failures.length === sources.length) {
      throw new Error(`Unable to search documentation: all sources failed (${failures.join(', ')})`);
    }
    if (failures.length === 0) {
      this.cache.set(cacheKey, results);
    }
    return results.slice(0, limit);
  }

  private async searchInReference(query: string, limit: number): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/spring-boot/docs/current/reference/html/`);
      if (!response.ok) {
        throw new Error('Unable to access Spring Boot reference documentation');
      }

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
      throw error;
    }
  }

  private processHtmlGuide(content: string, guideId: string, sourceUrl: string, detailLevel: string = 'medium'): string {
    console.error(`Processing HTML content with detail level: ${detailLevel}...`);
    const $ = cheerio.load(content);

    // Remove navigation and footer elements
    $('nav, footer, .navbar, .sidebar, #js-sidebar').remove();

    // Get main content
    // Selectors are tried in priority order: a single comma list would pick the first match in
    // document order (on spring.io an unrelated <article> card comes before the guide body)
    const selectors = ['.ascii-doc', '.content', '.guide-content', 'main', '.markdown-body', '.guide-body', 'article'];
    const mainContent = selectors.map(selector => $(selector).first()).find(match => match.length > 0) ?? $();

    let markdown: string;
    if (mainContent.length === 0) {
      console.error('No main content found, using body');
      $('script, style').remove();
      markdown = turndownService.turndown($('body').html() || '');
    } else {
      markdown = turndownService.turndown(mainContent.html() || '');
    }

    if (!markdown.trim()) {
      throw new Error(`No content could be extracted from the guide page: ${sourceUrl}`);
    }

    // Use intelligent extraction
    const { content: extractedContent, truncated } = extractContent(markdown, detailLevel);

    return `# Spring Guide: ${guideId}\n\n**Source:** ${sourceUrl}\n**Detail Level:** ${detailLevel}\n\n${extractedContent}${truncated ? (detailLevel === 'full' ? '\n\n---\n*Content truncated at 50,000 characters even in full mode. Visit the link above for the complete guide.*' : '\n\n---\n*Content truncated for brevity. Use detail_level="full" for complete guide or visit the link above.*') : ''}`;
  }

  private fetchWithRetry(url: string, timeout?: number, retries?: number): Promise<FetchResult> {
    return fetchWithRetry(url, timeout, retries);
  }
}
