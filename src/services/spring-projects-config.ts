/**
 * Spring Projects Configuration Service
 *
 * Central registry for all Spring project metadata, enabling generic multi-project
 * architecture without hardcoding specific projects in service implementations.
 *
 * This configuration-driven approach allows adding new Spring projects (Security,
 * Data, Cloud, etc.) with zero code changes - only configuration updates.
 */

import { normalizeVersion } from './url.js';

export interface SpringProjectConfig {
  /** Unique project identifier (e.g., "boot", "ai", "security") */
  id: string;

  /** Human-readable display name (e.g., "Spring Boot", "Spring AI") */
  displayName: string;

  /** Base URL for project documentation */
  baseDocUrl: string;

  /** Latest known stable version (optional, informational) */
  latestVersion?: string;

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

  /** Base URL of the reference documentation (always the current version, no version in the path) */
  referenceBaseUrl: string;

  /**
   * How a section maps to a page:
   * 'directory' -> <base>/reference/<section>/index.html, 'flat' -> <base>/<section>.html
   */
  referenceLayout: 'directory' | 'flat';

  /**
   * Sections living outside the standard layout, as a path relative to the docs root (directory layout only).
   * Limitation: in the 'directory' layout a subsection only reaches <dir>/<subsection>.html. A subsection that
   * is itself a folder (e.g. oauth2/login/..., authentication/passwords/...) is not reachable, which is why
   * such top-level sections are exposed through referencePaths instead.
   */
  referencePaths?: Record<string, string>;

  /** Prefix of the unversioned reference URL after which "<version>/" is inserted to pin a documentation version */
  versionInsertAfter?: string;
}

/**
 * Spring Projects Registry
 *
 * Single source of truth for all supported Spring projects.
 * To add a new Spring project, simply add a new entry here - no code changes required.
 */
export const SPRING_PROJECTS: Map<string, SpringProjectConfig> = new Map<string, SpringProjectConfig>([
  [
    'boot',
    {
      id: 'boot',
      versionInsertAfter: 'https://docs.spring.io/spring-boot/',
      displayName: 'Spring Boot',
      baseDocUrl: 'https://docs.spring.io/spring-boot/docs',
      referenceBaseUrl: 'https://docs.spring.io/spring-boot',
      referenceLayout: 'directory',
      referencePaths: {
        'deployment': 'how-to/deployment',
        'native-image': 'reference/packaging/native-image',
        'application-properties': 'appendix/application-properties'
      },
      latestVersion: '3.5.6',
      apiPath: '/api',
      hasVersionedDocs: true,
      cacheStrategy: 'long', // Stable releases, cache aggressively
      scopes: ['boot', 'web', 'data', 'actuator', 'starters', 'autoconfiguration'],
      referenceSections: [
        'features',
        'using',
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
      versionInsertAfter: 'https://docs.spring.io/spring-ai/reference/',
      displayName: 'Spring AI',
      baseDocUrl: 'https://docs.spring.io/spring-ai/reference/api', // Sections are under /api/
      referenceBaseUrl: 'https://docs.spring.io/spring-ai/reference/api',
      referenceLayout: 'flat',
      latestVersion: '1.1.2',
      apiPath: '/api',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-ai/reference/1.1/api/chatclient.html
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
        'chatmodel',
        'embeddings',
        'vectordbs',
        'retrieval-augmented-generation',
        'tools',
        'prompt',
        'structured-output'
      ]
    }
  ],
  [
    'framework',
    {
      id: 'framework',
      versionInsertAfter: 'https://docs.spring.io/spring-framework/reference/',
      displayName: 'Spring Framework',
      baseDocUrl: 'https://docs.spring.io/spring-framework/docs',
      referenceBaseUrl: 'https://docs.spring.io/spring-framework/reference',
      referenceLayout: 'flat',
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
  ],
  [
    'security',
    {
      id: 'security',
      versionInsertAfter: 'https://docs.spring.io/spring-security/reference/',
      displayName: 'Spring Security',
      baseDocUrl: 'https://docs.spring.io/spring-security',
      referenceBaseUrl: 'https://docs.spring.io/spring-security',
      referenceLayout: 'directory',
      // Directory layout: subsections only resolve to <dir>/<subsection>.html, so nested folders
      // (oauth2/login/..., authentication/passwords/...) are not reachable; hence the top-level paths below.
      referencePaths: {
        'authentication': 'reference/servlet/authentication',
        'authorization': 'reference/servlet/authorization',
        'oauth2': 'reference/servlet/oauth2',
        'exploits': 'reference/servlet/exploits',
        'integrations': 'reference/servlet/integrations',
        'testing': 'reference/servlet/test'
      },
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-security/reference/6.5/index.html
      cacheStrategy: 'long',
      scopes: ['security', 'authentication', 'authorization', 'oauth2', 'csrf'],
      referenceSections: [
        'servlet',
        'reactive',
        'features',
        'migration',
        'authentication',
        'authorization',
        'oauth2',
        'exploits',
        'integrations',
        'testing'
      ]
    }
  ],
  [
    'data-jpa',
    {
      id: 'data-jpa',
      versionInsertAfter: 'https://docs.spring.io/spring-data/jpa/reference/',
      displayName: 'Spring Data JPA',
      baseDocUrl: 'https://docs.spring.io/spring-data/jpa',
      referenceBaseUrl: 'https://docs.spring.io/spring-data/jpa/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-data/jpa/reference/3.5/index.html
      cacheStrategy: 'long',
      scopes: ['jpa', 'data', 'repository', 'hibernate', 'persistence'],
      referenceSections: [
        'jpa',
        'auditing',
        // repositories.html alone returns 404 (verified): this section only works with a subsection, e.g. 'core-concepts'
        'repositories'
      ]
    }
  ],
  [
    'batch',
    {
      id: 'batch',
      versionInsertAfter: 'https://docs.spring.io/spring-batch/reference/',
      displayName: 'Spring Batch',
      baseDocUrl: 'https://docs.spring.io/spring-batch',
      referenceBaseUrl: 'https://docs.spring.io/spring-batch/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-batch/reference/5.2/index.html
      cacheStrategy: 'long',
      scopes: ['batch', 'job', 'step', 'chunk', 'etl'],
      referenceSections: [
        'spring-batch-architecture',
        'whatsnew',
        'domain',
        'job',
        'step',
        'readersAndWriters',
        'processor',
        'scalability',
        'repeat',
        'retry',
        'testing',
        'common-patterns'
      ]
    }
  ],
  [
    'integration',
    {
      id: 'integration',
      versionInsertAfter: 'https://docs.spring.io/spring-integration/reference/',
      displayName: 'Spring Integration',
      baseDocUrl: 'https://docs.spring.io/spring-integration',
      referenceBaseUrl: 'https://docs.spring.io/spring-integration/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-integration/reference/6.5/index.html
      cacheStrategy: 'long',
      scopes: ['integration', 'eip', 'messaging', 'channel', 'endpoint'],
      referenceSections: [
        'overview',
        'message',
        'channel',
        'endpoint',
        'router',
        'transformer',
        'dsl',
        'http',
        'jms',
        'amqp',
        'kafka',
        'testing',
        'whats-new'
      ]
    }
  ],
  [
    'kafka',
    {
      id: 'kafka',
      versionInsertAfter: 'https://docs.spring.io/spring-kafka/reference/',
      displayName: 'Spring for Apache Kafka',
      baseDocUrl: 'https://docs.spring.io/spring-kafka',
      referenceBaseUrl: 'https://docs.spring.io/spring-kafka/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-kafka/reference/3.3/index.html
      cacheStrategy: 'long',
      scopes: ['kafka', 'streams', 'consumer', 'producer', 'retrytopic'],
      referenceSections: [
        'introduction',
        'quick-tour',
        'kafka',
        'retrytopic',
        'streams',
        'testing',
        'whats-new'
      ]
    }
  ],
  [
    'modulith',
    {
      id: 'modulith',
      versionInsertAfter: 'https://docs.spring.io/spring-modulith/reference/',
      displayName: 'Spring Modulith',
      baseDocUrl: 'https://docs.spring.io/spring-modulith',
      referenceBaseUrl: 'https://docs.spring.io/spring-modulith/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-modulith/reference/1.4/index.html
      cacheStrategy: 'long',
      scopes: ['modulith', 'modules', 'events', 'architecture'],
      referenceSections: [
        'fundamentals',
        'events',
        'testing',
        'verification',
        'documentation',
        'appendix'
      ]
    }
  ],
  [
    'cloud-gateway',
    {
      id: 'cloud-gateway',
      versionInsertAfter: 'https://docs.spring.io/spring-cloud-gateway/reference/',
      displayName: 'Spring Cloud Gateway',
      baseDocUrl: 'https://docs.spring.io/spring-cloud-gateway',
      referenceBaseUrl: 'https://docs.spring.io/spring-cloud-gateway/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-cloud-gateway/reference/4.3/index.html
      cacheStrategy: 'long',
      scopes: ['gateway', 'cloud', 'routing', 'filters', 'proxy'],
      referenceSections: [
        'spring-cloud-gateway-server-webflux',
        'spring-cloud-gateway-server-webmvc',
        'appendix'
      ]
    }
  ],
  [
    'cloud-config',
    {
      id: 'cloud-config',
      versionInsertAfter: 'https://docs.spring.io/spring-cloud-config/reference/',
      displayName: 'Spring Cloud Config',
      baseDocUrl: 'https://docs.spring.io/spring-cloud-config',
      referenceBaseUrl: 'https://docs.spring.io/spring-cloud-config/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-cloud-config/reference/4.3/index.html
      cacheStrategy: 'long',
      scopes: ['config', 'cloud', 'configuration', 'server', 'client'],
      referenceSections: [
        'quickstart',
        'server',
        'client'
      ]
    }
  ]
  // Future projects can be added here (e.g. 'cloud-*' siblings, 'data-*' modules, 'graphql', 'session').
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
   * Build documentation reference URL for a project (current documentation version)
   *
   * @param projectId - Project identifier
   * @param section - Documentation section (e.g., "web", "chatclient"), already validated as a safe URL segment
   * @param subsection - Optional page inside the section (e.g., "servlet" for boot/web)
   * @param version - Optional documentation version ("3.4" or "3.4.2"); omitted or "current" means the current docs
   * @returns Complete URL to the documentation page
   */
  buildReferenceUrl(projectId: string, section: string, subsection?: string, version?: string): string {
    const normalizedVersion = normalizeVersion(version);
    const project = this.getProject(projectId);
    const base = project.referenceBaseUrl;

    let url: string;
    if (project.referenceLayout === 'directory') {
      const dir = project.referencePaths?.[section] ?? `reference/${section}`;
      url = `${base}/${dir}/${subsection ? `${subsection}.html` : 'index.html'}`;
    } else {
      url = subsection ? `${base}/${section}/${subsection}.html` : `${base}/${section}.html`;
    }
    if (!normalizedVersion) return url;

    const prefix = project.versionInsertAfter;
    if (!project.hasVersionedDocs || !prefix) {
      throw new Error(`Project "${projectId}" does not support versioned documentation`);
    }
    if (!url.startsWith(prefix)) {
      throw new Error(`Invalid configuration for project "${projectId}": versionInsertAfter is not a prefix of ${url}`);
    }
    return `${prefix}${normalizedVersion}/${url.slice(prefix.length)}`;
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
