/**
 * Spring Projects Configuration Service
 *
 * Central registry for all Spring project metadata, enabling generic multi-project
 * architecture without hardcoding specific projects in service implementations.
 *
 * This configuration-driven approach allows adding new Spring projects (Security,
 * Data, Cloud, etc.) with zero code changes - only configuration updates.
 */

export interface SpringProjectConfig {
  /** Unique project identifier (e.g., "boot", "ai", "security") */
  id: string;

  /** Human-readable display name (e.g., "Spring Boot", "Spring AI") */
  displayName: string;

  /** Base URL for project documentation */
  baseDocUrl: string;

  /** Latest stable version (e.g., "3.5.6", "1.1.2") */
  latestVersion: string;

  /** Path to API documentation relative to baseDocUrl (optional) */
  apiPath?: string;

  /** Whether documentation URLs include version in path */
  hasVersionedDocs: boolean;

  /** Cache TTL strategy: 'short' (30min) for frequently updated, 'long' (24h) for stable */
  cacheStrategy: 'short' | 'long';

  /** Search keywords/scopes associated with this project */
  scopes: string[];

  /** Reference documentation sections available for this project (optional) */
  referenceSections?: string[];
}

/**
 * Spring Projects Registry
 *
 * Single source of truth for all supported Spring projects.
 * To add a new Spring project, simply add a new entry here - no code changes required.
 */
export const SPRING_PROJECTS: Map<string, SpringProjectConfig> = new Map([
  [
    'boot',
    {
      id: 'boot',
      displayName: 'Spring Boot',
      baseDocUrl: 'https://docs.spring.io/spring-boot/docs',
      latestVersion: '3.5.6',
      apiPath: '/api',
      hasVersionedDocs: true,
      cacheStrategy: 'long', // Stable releases, cache aggressively
      scopes: ['boot', 'web', 'data', 'actuator', 'starters', 'autoconfiguration'],
      referenceSections: [
        'web',
        'data',
        'messaging',
        'io',
        'actuator',
        'deployment',
        'native-image',
        'testing',
        'application-properties'
      ]
    }
  ],
  [
    'ai',
    {
      id: 'ai',
      displayName: 'Spring AI',
      baseDocUrl: 'https://docs.spring.io/spring-ai/reference/api', // Sections are under /api/
      latestVersion: '1.1.2',
      apiPath: '/api',
      hasVersionedDocs: false, // Spring AI docs don't have version in URL path
      cacheStrategy: 'short', // AI documentation evolves rapidly, shorter cache
      scopes: [
        'ai',
        'llm',
        'rag',
        'embeddings',
        'vector',
        'chatclient',
        'openai',
        'azure',
        'anthropic',
        'ollama',
        'chroma',
        'pinecone',
        'pgvector'
      ],
      referenceSections: [
        'chatclient',
        'chat-model',
        'embedding-model',
        'vector-stores',
        'retrieval-augmented-generation',
        'function-calling',
        'prompt-templates',
        'output-parsing'
      ]
    }
  ],
  [
    'framework',
    {
      id: 'framework',
      displayName: 'Spring Framework',
      baseDocUrl: 'https://docs.spring.io/spring-framework/docs',
      latestVersion: '6.2.6',
      apiPath: '/javadoc-api',
      hasVersionedDocs: true,
      cacheStrategy: 'long',
      scopes: ['core', 'context', 'beans', 'aop', 'web', 'webflux', 'data-access'],
      referenceSections: [
        'core',
        'web',
        'web-reactive',
        'data-access',
        'integration',
        'languages',
        'testing'
      ]
    }
  ]
  // Future projects can be added here:
  // 'security', 'data-jpa', 'cloud', 'batch', 'integration', etc.
]);

/**
 * Spring Projects Configuration Manager
 *
 * Provides type-safe access to Spring project configurations with validation
 * and helper methods for URL construction.
 */
export class SpringProjectsConfig {
  private readonly projects: Map<string, SpringProjectConfig>;

  constructor(projectsMap: Map<string, SpringProjectConfig> = SPRING_PROJECTS) {
    this.projects = projectsMap;
  }

  /**
   * Get configuration for a specific Spring project
   * @throws Error if project not found
   */
  getProject(projectId: string): SpringProjectConfig {
    const project = this.projects.get(projectId);
    if (!project) {
      const availableProjects = Array.from(this.projects.keys()).join(', ');
      throw new Error(
        `Unknown Spring project: "${projectId}". Available projects: ${availableProjects}`
      );
    }
    return project;
  }

  /**
   * Check if a project is supported
   */
  hasProject(projectId: string): boolean {
    return this.projects.has(projectId);
  }

  /**
   * Get all supported project IDs
   */
  getAllProjectIds(): string[] {
    return Array.from(this.projects.keys());
  }

  /**
   * Get all project configurations
   */
  getAllProjects(): SpringProjectConfig[] {
    return Array.from(this.projects.values());
  }

  /**
   * Build documentation reference URL for a project
   *
   * @param projectId - Project identifier
   * @param section - Documentation section (e.g., "web", "chatclient")
   * @param version - Optional version override (defaults to latest)
   * @returns Complete URL to documentation section
   */
  buildReferenceUrl(
    projectId: string,
    section: string,
    version?: string
  ): string {
    const project = this.getProject(projectId);
    const targetVersion = version || project.latestVersion;

    if (project.hasVersionedDocs) {
      return `${project.baseDocUrl}/${targetVersion}/reference/html/${section}.html`;
    } else {
      return `${project.baseDocUrl}/${section}.html`;
    }
  }

  /**
   * Build API documentation URL for a project
   *
   * @param projectId - Project identifier
   * @param version - Optional version override (defaults to latest)
   * @returns Complete URL to API documentation
   */
  buildApiUrl(projectId: string, version?: string): string {
    const project = this.getProject(projectId);

    if (!project.apiPath) {
      throw new Error(`Project "${projectId}" does not have API documentation configured`);
    }

    const targetVersion = version || project.latestVersion;

    if (project.hasVersionedDocs) {
      return `${project.baseDocUrl}/${targetVersion}${project.apiPath}/`;
    } else {
      return `${project.baseDocUrl}${project.apiPath}/`;
    }
  }

  /**
   * Find projects by scope/keyword
   * Useful for routing queries to appropriate projects
   *
   * @param scope - Search scope keyword (e.g., "ai", "boot", "security")
   * @returns Array of matching project configurations
   */
  findProjectsByScope(scope: string): SpringProjectConfig[] {
    const scopeLower = scope.toLowerCase();
    return this.getAllProjects().filter(project =>
      project.scopes.some(s => s.toLowerCase().includes(scopeLower))
    );
  }

  /**
   * Get cache TTL in milliseconds for a project
   *
   * @param projectId - Project identifier
   * @returns TTL in milliseconds
   */
  getCacheTTL(projectId: string): number {
    const project = this.getProject(projectId);

    // Convert strategy to milliseconds
    switch (project.cacheStrategy) {
      case 'short':
        return 30 * 60 * 1000; // 30 minutes
      case 'long':
        return 24 * 60 * 60 * 1000; // 24 hours
      default:
        return 30 * 60 * 1000; // Default to 30 minutes
    }
  }

  /**
   * Validate if a section exists for a project
   * Returns true if validation passes or if project doesn't define sections
   */
  validateSection(projectId: string, section: string): boolean {
    const project = this.getProject(projectId);

    // If project doesn't define sections, allow any section
    if (!project.referenceSections || project.referenceSections.length === 0) {
      return true;
    }

    return project.referenceSections.includes(section);
  }
}

/**
 * Singleton instance for application-wide use
 */
export const springProjectsConfig = new SpringProjectsConfig();
