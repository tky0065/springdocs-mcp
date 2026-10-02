import type { InitializrMetadata } from './initializr.js';

// Pure helpers behind find_spring_dependency: search words, ranking and Maven/Gradle snippets
// built from the Spring Initializr data. No network access here, no mock data.

export type BuildChoice = 'maven' | 'gradle' | 'both';

export interface CatalogEntry { id: string; name: string; description: string }

export interface Coordinates {
  groupId: string;
  artifactId: string;
  scope: string;
  bom?: string;
  version?: string;
  repository?: string;
}

export interface DependencyData {
  bootVersion?: string;
  dependencies: Record<string, Coordinates>;
  boms?: Record<string, { groupId: string; artifactId: string; version: string }>;
  repositories?: Record<string, { name: string; url: string }>;
}

export interface Snippets {
  kind: 'dependency' | 'plugin' | 'unavailable';
  coordinates?: string;
  scope?: string;
  notes: string[];
  maven?: string;
  gradle?: string;
}

const MAX_RESULTS = 5;
const MIN_WORD_LENGTH = 2;
const SAFE_VALUE = /^[A-Za-z0-9_.-]+$/;
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'with', 'to', 'and', 'of', 'in', 'on', 'my', 'i', 'want', 'need', 'use', 'using', 'spring',
]);

/** Lowercase alphanumeric words of the need, without stop words or duplicates. */
export function searchWords(need: string): string[] {
  const words = need.toLowerCase().split(/[^a-z0-9]+/)
    .filter(word => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word));
  return [...new Set(words)];
}

export function flattenCatalog(meta: InitializrMetadata): CatalogEntry[] {
  const groups = meta.dependencies?.values;
  if (!Array.isArray(groups)) {
    throw new Error('Spring Initializr returned an unexpected response (missing dependencies)');
  }
  return groups.flatMap(group => group.values.map(dep => ({
    id: dep.id,
    name: dep.name,
    description: dep.description ?? '',
  })));
}

function score(entry: CatalogEntry, words: string[]): number {
  const id = entry.id.toLowerCase();
  const name = entry.name.toLowerCase();
  const description = entry.description.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (id === word) total += 10;
    else if (id.includes(word)) total += 5;
    if (name.includes(word)) total += 4;
    if (description.includes(word)) total += 1;
  }
  return total;
}

/** Entries matching at least one word, best first (score, then shortest id, then alphabetical). */
export function rankDependencies(catalog: CatalogEntry[], words: string[]): CatalogEntry[] {
  if (words.length === 0) return [];
  return catalog
    .map(entry => ({ entry, score: score(entry, words) }))
    .filter(item => item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      a.entry.id.length - b.entry.id.length ||
      a.entry.id.localeCompare(b.entry.id))
    .map(item => item.entry);
}

function mavenBlock(groupId: string, artifactId: string, extra: string[]): string {
  return ['<dependency>', `    <groupId>${groupId}</groupId>`, `    <artifactId>${artifactId}</artifactId>`,
    ...extra.map(line => `    ${line}`), '</dependency>'].join('\n');
}

export function buildSnippets(id: string, data: DependencyData, build: BuildChoice): Snippets {
  const c = data.dependencies[id];
  if (!c) {
    return { kind: 'unavailable', notes: ['No Maven coordinates published by Initializr for this id.'] };
  }
  const bom = c.bom ? data.boms?.[c.bom] : undefined;
  const values = [c.groupId, c.artifactId, c.scope, c.version, bom?.groupId, bom?.artifactId, bom?.version]
    .filter((value): value is string => value !== undefined);
  if (!values.every(value => SAFE_VALUE.test(value))) {
    return { kind: 'unavailable', notes: ['The coordinates published by Initializr contain unexpected characters: no snippet generated.'] };
  }
  const coordinates = `${c.groupId}:${c.artifactId}`;
  if (c.groupId === 'org.springframework.boot' && c.artifactId === 'spring-boot') {
    return { kind: 'plugin', coordinates, notes: ['Build plugin, not a dependency: enable it in the build configuration.'] };
  }

  const notes: string[] = [];
  if (c.bom && !bom) {
    notes.push(`Needs the BOM "${c.bom}", which Initializr does not describe: add its version manually.`);
  }
  if (c.repository) {
    const repo = data.repositories?.[c.repository];
    notes.push(`Requires the Maven repository ${repo ? `${repo.name} (${repo.url})` : c.repository}.`);
  }

  let scope = c.scope;
  if (!['compile', 'runtime', 'test', 'provided', 'annotationProcessor'].includes(scope)) {
    notes.push(`Unknown scope "${scope}": shown as a regular (compile) dependency.`);
    scope = 'compile';
  }

  const gav = c.version ? `${coordinates}:${c.version}` : coordinates;
  const mavenExtra = [
    ...(c.version ? [`<version>${c.version}</version>`] : []),
    ...(scope === 'runtime' || scope === 'test' || scope === 'provided' ? [`<scope>${scope}</scope>`] : []),
    ...(scope === 'annotationProcessor' ? ['<optional>true</optional>'] : []),
  ];
  const mavenParts: string[] = [];
  if (bom) {
    mavenParts.push([
      '<dependencyManagement>',
      '    <dependencies>',
      '        <dependency>',
      `            <groupId>${bom.groupId}</groupId>`,
      `            <artifactId>${bom.artifactId}</artifactId>`,
      `            <version>${bom.version}</version>`,
      '            <type>pom</type>',
      '            <scope>import</scope>',
      '        </dependency>',
      '    </dependencies>',
      '</dependencyManagement>',
    ].join('\n'));
  }
  mavenParts.push(mavenBlock(c.groupId, c.artifactId, mavenExtra));

  const gradleConfig: Record<string, string[]> = {
    compile: ['implementation'],
    runtime: ['runtimeOnly'],
    test: ['testImplementation'],
    provided: ['compileOnly'],
    annotationProcessor: ['compileOnly', 'annotationProcessor'],
  };
  const gradleLines = [
    ...(bom ? [`implementation(platform("${bom.groupId}:${bom.artifactId}:${bom.version}"))`] : []),
    ...gradleConfig[scope].map(config => `${config}("${gav}")`),
  ];

  return {
    kind: 'dependency',
    coordinates,
    scope: c.scope,
    notes,
    maven: build === 'gradle' ? undefined : mavenParts.join('\n\n'),
    gradle: build === 'maven' ? undefined : gradleLines.join('\n'),
  };
}

export function formatDependencyMatches(
  need: string,
  ranked: CatalogEntry[],
  data: DependencyData,
  build: BuildChoice,
): string {
  if (ranked.length === 0) {
    return `No dependency matches "${need.trim()}". Try other English keywords, or list everything with get_spring_initializr (section "dependencies").`;
  }
  const lines = [`# Dependencies for "${need.trim()}"${data.bootVersion ? ` (Spring Boot ${data.bootVersion})` : ''}`];
  for (const entry of ranked.slice(0, MAX_RESULTS)) {
    const snippets = buildSnippets(entry.id, data, build);
    lines.push('', `## \`${entry.id}\` — ${entry.name}`);
    if (entry.description) lines.push('', entry.description);
    lines.push('');
    if (snippets.coordinates) lines.push(`- Coordinates: \`${snippets.coordinates}\``);
    if (snippets.scope) lines.push(`- Scope: ${snippets.scope}`);
    for (const note of snippets.notes) lines.push(`- ${note}`);
    if (snippets.maven) lines.push('', '**Maven**', '', '```xml', snippets.maven, '```');
    if (snippets.gradle) lines.push('', '**Gradle** (Groovy and Kotlin DSL)', '', '```gradle', snippets.gradle, '```');
  }
  if (ranked.length > MAX_RESULTS) {
    lines.push('', `${ranked.length - MAX_RESULTS} more matches, refine the query.`);
  }
  return lines.join('\n');
}
