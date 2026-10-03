import { CacheService } from './cache.js';
import { fetchWithRetry } from './http.js';
import { BuildChoice, DependencyData, escapeInline, flattenCatalog, formatDependencyMatches, rankDependencies, searchWords } from './dependency-finder.js';

// Reads the Spring Initializr metadata (https://start.spring.io/metadata/client):
// build options and the list of available dependencies. Real API only, no mock data.

const METADATA_URL = 'https://start.spring.io/metadata/client';
const CACHE_KEY = 'initializr:metadata';
const COORDINATES_URL = 'https://start.spring.io/dependencies';
const COORDINATES_CACHE_KEY = 'initializr:dependencies';
const MAX_MATCHES = 30;
const BOOT_VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

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
  if (matches.length === 0) return `No dependency matches "${escapeInline(query!)}".`;

  const shown = matches.slice(0, MAX_MATCHES);
  const lines = [`# Spring Initializr dependencies matching "${escapeInline(query!)}"`, ''];
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

  async findDependency(need: string, build: BuildChoice = 'both', bootVersion?: string): Promise<string> {
    const words = searchWords(need);
    if (words.length === 0) {
      throw new Error('The need must contain at least one searchable word (English keywords such as "jpa" or "oauth2")');
    }
    if (bootVersion !== undefined && !BOOT_VERSION.test(bootVersion)) {
      throw new Error('The bootVersion must use the X.Y.Z format (for example "4.0.8")');
    }
    const meta = await this.loadMetadata();
    const data = await this.loadCoordinates(bootVersion);
    const ranked = rankDependencies(flattenCatalog(meta), words);
    return formatDependencyMatches(need, ranked, data, build);
  }

  private async loadCoordinates(bootVersion?: string): Promise<DependencyData> {
    const cacheKey = bootVersion ? `${COORDINATES_CACHE_KEY}:${bootVersion}` : COORDINATES_CACHE_KEY;
    const cached = this.cache.get<DependencyData>(cacheKey);
    if (cached) return cached;

    const response = await fetchWithRetry(bootVersion ? `${COORDINATES_URL}?bootVersion=${bootVersion}` : COORDINATES_URL);
    if (!response.ok) {
      throw new Error(`Spring Initializr is unavailable (HTTP ${response.status})`);
    }
    const data = (await response.json()) as DependencyData;
    if (!data || typeof data.dependencies !== 'object' || data.dependencies === null || Array.isArray(data.dependencies)) {
      unexpected('dependencies');
    }
    this.cache.setLongTerm(cacheKey, data);
    return data;
  }

  private async loadMetadata(): Promise<InitializrMetadata> {
    const cached = this.cache.get<InitializrMetadata>(CACHE_KEY);
    if (cached) return cached;

    const response = await fetchWithRetry(METADATA_URL);
    if (!response.ok) {
      throw new Error(`Spring Initializr is unavailable (HTTP ${response.status})`);
    }
    const meta = (await response.json()) as InitializrMetadata;
    const optionsOk = meta && [meta.type, meta.javaVersion, meta.language, meta.packaging, meta.bootVersion]
      .every(group => Array.isArray(group?.values));
    const dependenciesOk = meta && Array.isArray(meta.dependencies?.values)
      && meta.dependencies.values.every(group => Array.isArray(group?.values));
    if (!optionsOk || !dependenciesOk) {
      unexpected('options or dependencies');
    }
    this.cache.setLongTerm(CACHE_KEY, meta);
    return meta;
  }
}
