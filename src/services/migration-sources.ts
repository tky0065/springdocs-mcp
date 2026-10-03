// Migration guides of projects other than Spring Boot: raw markdown pages of their wiki
// (raw host of the code forge). Pure helpers, no network access here.
//
// Verified against the network: the raw endpoint answers a missing page with a real 404 (unlike
// the HTML wiki, which redirects to the home page with a 200).
//   Framework: Spring-Framework-<major.minor>-Release-Notes.md (5.3, 6.0, 6.1, 6.2, 7.0 exist)
//   Batch:     Spring-Batch-<major.minor>-Migration-Guide.md   (5.0, 6.0 exist)
// Candidates not implemented: Spring Security (docs.spring.io/spring-security/reference/<v>/migration/
// shows the guide of the version's major, not of a target version) and Spring AI (a single
// upgrade-notes.html page for all versions).

export type MigrationProject = 'spring-boot' | 'spring-framework' | 'spring-batch';
export type RawMigrationDocument = 'migration-guide' | 'release-notes';
export type RawMigrationProject = Exclude<MigrationProject, 'spring-boot'>;

export const MIGRATION_PROJECTS: readonly MigrationProject[] = ['spring-boot', 'spring-framework', 'spring-batch'];

interface RawWikiSource {
  repo: string;
  displayName: string;
  document: RawMigrationDocument;
}

const RAW_SOURCES: Record<RawMigrationProject, RawWikiSource> = {
  'spring-framework': { repo: 'spring-framework', displayName: 'Spring Framework', document: 'release-notes' },
  'spring-batch': { repo: 'spring-batch', displayName: 'Spring Batch', document: 'migration-guide' },
};

export function isMigrationProject(value: string): value is MigrationProject {
  return (MIGRATION_PROJECTS as readonly string[]).includes(value);
}

export function projectDisplayName(project: MigrationProject): string {
  return project === 'spring-boot' ? 'Spring Boot' : RAW_SOURCES[project].displayName;
}

const label = (document: RawMigrationDocument) => (document === 'migration-guide' ? 'Migration Guide' : 'Release Notes');

export function rawWikiTitle(project: RawMigrationProject, version: string): string {
  const source = RAW_SOURCES[project];
  return `${source.displayName} ${version} ${label(source.document)}`;
}

export function rawWikiUrl(project: RawMigrationProject, version: string): string {
  const source = RAW_SOURCES[project];
  const page = `${source.displayName.replace(' ', '-')}-${version}-${label(source.document).replace(' ', '-')}`;
  return `https://raw.githubusercontent.com/wiki/spring-projects/${source.repo}/${page}.md`;
}

/** `auto` and the project's only document resolve to it; the other one is rejected before any request. */
export function resolveRawDocument(
  project: RawMigrationProject,
  document: 'auto' | RawMigrationDocument,
): RawMigrationDocument {
  const source = RAW_SOURCES[project];
  if (document !== 'auto' && document !== source.document) {
    throw new Error(`${source.displayName} only has "${source.document}" documents (document="${document}" is not available)`);
  }
  return source.document;
}

/** A real page is markdown, never an HTML document (home page or error page). */
export function assertRawMarkdown(body: string, title: string, url: string): string {
  const text = body.trim();
  if (!text || /^<(!doctype|html)/i.test(text)) {
    throw new Error(`Wiki page not found: ${title} (${url})`);
  }
  return text;
}
