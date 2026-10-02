import { CacheService } from './cache.js';
import { fetchWithRetry } from './http.js';

// Reads the Spring Initializr metadata (https://start.spring.io/metadata/client):
// build options and the list of available dependencies. Real API only, no mock data.

const METADATA_URL = 'https://start.spring.io/metadata/client';
const CACHE_KEY = 'initializr:metadata';
const MAX_MATCHES = 30;

interface OptionValue { id: string; name?: string }
interface OptionGroup { default?: string; values: OptionValue[] }
interface Dependency { id: string; name: string; description?: string }
interface DependencyGroup { name: string; values: Dependency[] }

export interface InitializrMetadata {
  type?: OptionGroup;
  javaVersion?: OptionGroup;
  language?: OptionGroup;
  packaging?: OptionGroup;
  bootVersion?: OptionGroup;
  dependencies?: { values: DependencyGroup[] };
}

function unexpected(what: string): never {
  throw new Error(`Spring Initializr returned an unexpected response (missing ${what})`);
}

function optionLine(label: string, group: OptionGroup | undefined): string {
  if (!group || !Array.isArray(group.values)) unexpected(label);
  const items = group.values.map(v => {
    const tags: string[] = [];
    if (v.id === group.default) tags.push('default');
    if (/SNAPSHOT/i.test(v.id)) tags.push('snapshot');
    else if (/[.-](M|RC)\d+/i.test(v.id)) tags.push('milestone');
    return `\`${v.id}\`${tags.length ? ` (${tags.join(', ')})` : ''}`;
  });
  return `- **${label}**: ${items.join(', ')}`;
}

export function formatOptions(meta: InitializrMetadata): string {
  return [
    '# Spring Initializr options',
    '',
    optionLine('Build type', meta.type),
    optionLine('Java version', meta.javaVersion),
    optionLine('Language', meta.language),
    optionLine('Packaging', meta.packaging),
    optionLine('Spring Boot version', meta.bootVersion),
    '',
    'Source: https://start.spring.io — use `section: "dependencies"` to list the dependency ids.',
  ].join('\n');
}

export function formatDependencies(meta: InitializrMetadata, query?: string): string {
  const groups = meta.dependencies?.values;
  if (!Array.isArray(groups)) unexpected('dependencies');
  const needle = query?.trim().toLowerCase();

  if (!needle) {
    const lines = ['# Spring Initializr dependencies', ''];
    for (const group of groups) {
      lines.push(`## ${group.name}`, '');
      for (const dep of group.values) lines.push(`- \`${dep.id}\` — ${dep.name}`);
      lines.push('');
    }
    return lines.join('\n').trimEnd();
  }

  const matches: Dependency[] = [];
  for (const group of groups) {
    for (const dep of group.values) {
      const haystack = `${dep.id} ${dep.name} ${dep.description ?? ''}`.toLowerCase();
      if (haystack.includes(needle)) matches.push(dep);
    }
  }
  if (matches.length === 0) return `No dependency matches "${query!.trim()}".`;

  const shown = matches.slice(0, MAX_MATCHES);
  const lines = [`# Spring Initializr dependencies matching "${query!.trim()}"`, ''];
  for (const dep of shown) lines.push(`- \`${dep.id}\` — ${dep.name}${dep.description ? `: ${dep.description}` : ''}`);
  if (matches.length > shown.length) {
    lines.push('', `${matches.length - shown.length} more matches, refine the query.`);
  }
  return lines.join('\n');
}

export class InitializrService {
  constructor(private cache: CacheService = new CacheService()) {}

  async getInitializr(section: 'options' | 'dependencies' = 'options', query?: string): Promise<string> {
    const meta = await this.loadMetadata();
    return section === 'dependencies' ? formatDependencies(meta, query) : formatOptions(meta);
  }

  private async loadMetadata(): Promise<InitializrMetadata> {
    const cached = this.cache.get<InitializrMetadata>(CACHE_KEY);
    if (cached) return cached;

    const response = await fetchWithRetry(METADATA_URL);
    if (!response.ok) {
      throw new Error(`Spring Initializr is unavailable (HTTP ${response.status})`);
    }
    const meta = (await response.json()) as InitializrMetadata;
    if (!meta || !Array.isArray(meta.dependencies?.values) || !Array.isArray(meta.bootVersion?.values)) {
      unexpected('dependencies or bootVersion');
    }
    this.cache.setLongTerm(CACHE_KEY, meta);
    return meta;
  }
}
