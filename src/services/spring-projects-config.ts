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

  /** GitHub repository (owner/name) hosting the releases */
  githubRepo?: string;

  /** Prefix of the release tag, e.g. "v" for v3.5.0 */
  githubTagPrefix?: string;

  /** Human-readable display name (e.g., "Spring Boot", "Spring AI") */
  displayName: string;

  /** Whether documentation URLs include version in path */
  hasVersionedDocs: boolean;

  /** Cache TTL strategy: 'short' (30min) for frequently updated, 'long' (24h) for stable */
  cacheStrategy: 'short' | 'long';

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
      githubRepo: 'spring-projects/spring-boot',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-boot/',
      displayName: 'Spring Boot',
      referenceBaseUrl: 'https://docs.spring.io/spring-boot',
      referenceLayout: 'directory',
      referencePaths: {
        'deployment': 'how-to/deployment',
        'native-image': 'reference/packaging/native-image',
        'application-properties': 'appendix/application-properties'
      },
      hasVersionedDocs: true,
      cacheStrategy: 'long', // Stable releases, cache aggressively
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
      githubRepo: 'spring-projects/spring-ai',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-ai/reference/',
      displayName: 'Spring AI',
      referenceBaseUrl: 'https://docs.spring.io/spring-ai/reference/api',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-ai/reference/1.1/api/chatclient.html
      cacheStrategy: 'short', // AI documentation evolves rapidly, shorter cache
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
      githubRepo: 'spring-projects/spring-framework',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-framework/reference/',
      displayName: 'Spring Framework',
      referenceBaseUrl: 'https://docs.spring.io/spring-framework/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true,
      cacheStrategy: 'long',
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
      githubRepo: 'spring-projects/spring-security',
      githubTagPrefix: '',
      versionInsertAfter: 'https://docs.spring.io/spring-security/reference/',
      displayName: 'Spring Security',
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
      githubRepo: 'spring-projects/spring-data-jpa',
      githubTagPrefix: '',
      versionInsertAfter: 'https://docs.spring.io/spring-data/jpa/reference/',
      displayName: 'Spring Data JPA',
      referenceBaseUrl: 'https://docs.spring.io/spring-data/jpa/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-data/jpa/reference/3.5/index.html
      cacheStrategy: 'long',
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
      githubRepo: 'spring-projects/spring-batch',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-batch/reference/',
      displayName: 'Spring Batch',
      referenceBaseUrl: 'https://docs.spring.io/spring-batch/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-batch/reference/5.2/index.html
      cacheStrategy: 'long',
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
      githubRepo: 'spring-projects/spring-integration',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-integration/reference/',
      displayName: 'Spring Integration',
      referenceBaseUrl: 'https://docs.spring.io/spring-integration/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-integration/reference/6.5/index.html
      cacheStrategy: 'long',
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
      githubRepo: 'spring-projects/spring-kafka',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-kafka/reference/',
      displayName: 'Spring for Apache Kafka',
      referenceBaseUrl: 'https://docs.spring.io/spring-kafka/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-kafka/reference/3.3/index.html
      cacheStrategy: 'long',
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
      githubRepo: 'spring-projects/spring-modulith',
      githubTagPrefix: '',
      versionInsertAfter: 'https://docs.spring.io/spring-modulith/reference/',
      displayName: 'Spring Modulith',
      referenceBaseUrl: 'https://docs.spring.io/spring-modulith/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-modulith/reference/1.4/index.html
      cacheStrategy: 'long',
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
      githubRepo: 'spring-cloud/spring-cloud-gateway',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-cloud-gateway/reference/',
      displayName: 'Spring Cloud Gateway',
      referenceBaseUrl: 'https://docs.spring.io/spring-cloud-gateway/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-cloud-gateway/reference/4.3/index.html
      cacheStrategy: 'long',
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
      githubRepo: 'spring-cloud/spring-cloud-config',
      githubTagPrefix: 'v',
      versionInsertAfter: 'https://docs.spring.io/spring-cloud-config/reference/',
      displayName: 'Spring Cloud Config',
      referenceBaseUrl: 'https://docs.spring.io/spring-cloud-config/reference',
      referenceLayout: 'flat',
      hasVersionedDocs: true, // Verified: https://docs.spring.io/spring-cloud-config/reference/4.3/index.html
      cacheStrategy: 'long',
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
