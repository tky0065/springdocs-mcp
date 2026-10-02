# find_spring_dependency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le 17e tool `find_spring_dependency` : besoin en mots-clés anglais → starters Spring avec coordonnées et snippets Maven/Gradle (IMPROVE.md #51).

**Architecture:** Module pur `src/services/dependency-finder.ts` (mots de recherche, classement, snippets, formatage). `InitializrService` (`src/services/initializr.ts`) gagne `loadCoordinates()` (`GET https://start.spring.io/dependencies`, cache 24 h) et `findDependency(need, build)`. `src/index.ts` route le tool.

**Tech Stack:** TypeScript (Node16), vitest 3 (`vi.mock("node-fetch")`), MCP SDK 1.x.

**Spec:** `docs/superpowers/specs/2026-10-02-find-spring-dependency-design.md`

## Global Constraints

- Comparaison par sous-chaîne littérale, jamais de regex construite à partir de `need`.
- `need` : `maxLength` 100 ; aucun mot exploitable après filtrage → erreur avant tout réseau.
- 5 résultats maximum, tri : score décroissant, id le plus court, ordre alphabétique de l'id.
- `fetchWithRetry` renvoie la dernière réponse 429/5xx sans lever : toujours tester `response.ok`. Les échecs ne sont jamais mis en cache.
- Les valeurs de coordonnées viennent d'une API distante : tout `groupId`/`artifactId`/`version`/scope hors `^[A-Za-z0-9_.-]+$` rend la fiche « sans snippet » (jamais de texte distant arbitraire dans un bloc de code).
- Sorties en anglais ; compteur de tools 16 → 17 ; `docker/tools.json` régénéré (`npm run build && npm run docker:tools`).
- Pas de ligne d'attribution Claude dans les commits (règle CLAUDE.md global).

## Review Focus

- `need` = `.*(`, `\\`, `[`, ou uniquement des mots vides (`the for spring`) : littéral ou erreur claire, jamais de `SyntaxError` de regex.
- `need` non ASCII (« base de données ») : pas de crash ; mots de moins de 2 caractères écartés.
- BOM absent de `boms` : note, pas de `TypeError`.
- Entrée de `/dependencies` avec un `groupId` contenant `<` ou un retour à la ligne : fiche sans snippet.
- Réponse `/dependencies` vide ou sans `dependencies` : erreur claire, rien en cache ; `boms`/`repositories` absents : tolérés.

---

### Task 1: Module pur `dependency-finder.ts`

**Files:**
- Create: `src/services/dependency-finder.ts`
- Test: `tests/dependency-finder.test.ts`

**Interfaces:**
- Consumes: type `InitializrMetadata` (`src/services/initializr.ts`)
- Produces: `BuildChoice = "maven" | "gradle" | "both"` ; `CatalogEntry = { id: string; name: string; description: string }` ; `Coordinates = { groupId: string; artifactId: string; scope: string; bom?: string; version?: string; repository?: string }` ; `DependencyData = { bootVersion?: string; dependencies: Record<string, Coordinates>; boms?: Record<string, { groupId: string; artifactId: string; version: string }>; repositories?: Record<string, { name: string; url: string }> }` ; `searchWords(need): string[]` ; `flattenCatalog(meta): CatalogEntry[]` ; `rankDependencies(catalog, words): CatalogEntry[]` ; `buildSnippets(id, data, build): { kind: "dependency" | "plugin" | "unavailable"; coordinates?: string; scope?: string; notes: string[]; maven?: string; gradle?: string }` ; `formatDependencyMatches(need, ranked, data, build): string`

- [ ] **Step 1: Écrire les tests qui échouent** `tests/dependency-finder.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  buildSnippets, flattenCatalog, formatDependencyMatches, rankDependencies, searchWords,
  type CatalogEntry, type DependencyData,
} from "../src/services/dependency-finder.js";

const data: DependencyData = {
  bootVersion: "4.1.1",
  dependencies: {
    web: { groupId: "org.springframework.boot", artifactId: "spring-boot-starter-webmvc", scope: "compile" },
    h2: { groupId: "com.h2database", artifactId: "h2", scope: "runtime" },
    testcontainers: { groupId: "org.testcontainers", artifactId: "testcontainers-junit-jupiter", scope: "test" },
    lombok: { groupId: "org.projectlombok", artifactId: "lombok", scope: "annotationProcessor" },
    "spring-ai-openai": { groupId: "org.springframework.ai", artifactId: "spring-ai-starter-model-openai", scope: "compile", bom: "spring-ai" },
    "bom-missing": { groupId: "org.acme", artifactId: "acme-starter", scope: "compile", bom: "ghost" },
    springdoc: { groupId: "org.springdoc", artifactId: "springdoc-openapi-starter-webmvc-ui", scope: "compile", version: "3.1.0" },
    saml: { groupId: "org.springframework.boot", artifactId: "spring-boot-starter-security-saml2", scope: "compile", repository: "shibboleth" },
    native: { groupId: "org.springframework.boot", artifactId: "spring-boot", scope: "compile" },
    provided: { groupId: "jakarta.servlet", artifactId: "jakarta.servlet-api", scope: "provided" },
    weird: { groupId: "org.acme", artifactId: "weird", scope: "banana" },
    evil: { groupId: "org.acme\n```\n# pwn", artifactId: "x", scope: "compile" },
  },
  boms: { "spring-ai": { groupId: "org.springframework.ai", artifactId: "spring-ai-bom", version: "2.0.0" } },
  repositories: { shibboleth: { name: "Shibboleth Releases", url: "https://build.shibboleth.net/maven/releases" } },
};

describe("searchWords", () => {
  it("découpe, passe en minuscules, retire les mots vides et les doublons", () => {
    expect(searchWords("I want a Postgres driver")).toEqual(["postgres", "driver"]);
    expect(searchWords("Spring Data JPA!")).toEqual(["data", "jpa"]);
    expect(searchWords("jpa JPA jpa")).toEqual(["jpa"]);
    expect(searchWords("oauth2-client")).toEqual(["oauth2", "client"]);
  });

  it("n'interprète jamais les caractères spéciaux", () => {
    expect(searchWords(".*(")).toEqual([]);
    expect(searchWords("\\ [ ] ^ $")).toEqual([]);
    expect(searchWords("the for spring")).toEqual([]);
  });

  it("garde les mots courts utiles et ignore les caractères non ASCII", () => {
    expect(searchWords("ai")).toEqual(["ai"]);
    expect(() => searchWords("base de données")).not.toThrow();
    expect(searchWords("x")).toEqual([]);
  });
});

describe("flattenCatalog", () => {
  it("aplatit les catégories en entrées id/name/description", () => {
    const flat = flattenCatalog({ dependencies: { values: [{ name: "Web", values: [{ id: "web", name: "Spring Web", description: "MVC" }] }] } } as any);
    expect(flat).toEqual([{ id: "web", name: "Spring Web", description: "MVC" }]);
  });

  it("métadonnées sans dependencies : erreur claire", () => {
    expect(() => flattenCatalog({} as any)).toThrow(/unexpected response/i);
  });
});

describe("rankDependencies", () => {
  const catalog: CatalogEntry[] = [
    { id: "data-jpa", name: "Spring Data JPA", description: "Persist data in SQL stores" },
    { id: "jpa-extras", name: "Extras", description: "Something" },
    { id: "other", name: "JPA helper", description: "Helper" },
    { id: "zzz", name: "Zzz", description: "Works with jpa too" },
    { id: "jpa", name: "JPA", description: "x" },
    { id: "nomatch", name: "Nothing", description: "Nothing" },
  ];

  it("id égal > id contenant > nom > description, sans les non-correspondances", () => {
    const ids = rankDependencies(catalog, ["jpa"]).map((e) => e.id);
    expect(ids).toEqual(["jpa", "data-jpa", "jpa-extras", "other", "zzz"]);
  });

  it("cumule les scores de plusieurs mots", () => {
    const ids = rankDependencies(catalog, ["data", "jpa"]).map((e) => e.id);
    expect(ids[0]).toBe("data-jpa");
  });

  it("départage par id le plus court puis ordre alphabétique", () => {
    const tie: CatalogEntry[] = [
      { id: "bbb-x", name: "n", description: "d" },
      { id: "aaa-x", name: "n", description: "d" },
      { id: "x", name: "n", description: "d" },
    ];
    expect(rankDependencies(tie, ["x"]).map((e) => e.id)).toEqual(["x", "aaa-x", "bbb-x"]);
  });

  it("sans mot ou sans correspondance : liste vide", () => {
    expect(rankDependencies(catalog, [])).toEqual([]);
    expect(rankDependencies(catalog, ["qqqqq"])).toEqual([]);
  });
});

describe("buildSnippets", () => {
  it("compile : Maven sans scope, Gradle implementation", () => {
    const s = buildSnippets("web", data, "both");
    expect(s.kind).toBe("dependency");
    expect(s.coordinates).toBe("org.springframework.boot:spring-boot-starter-webmvc");
    expect(s.maven).toBe("<dependency>\n    <groupId>org.springframework.boot</groupId>\n    <artifactId>spring-boot-starter-webmvc</artifactId>\n</dependency>");
    expect(s.gradle).toBe('implementation("org.springframework.boot:spring-boot-starter-webmvc")');
  });

  it("runtime et test", () => {
    expect(buildSnippets("h2", data, "both").maven).toContain("<scope>runtime</scope>");
    expect(buildSnippets("h2", data, "both").gradle).toBe('runtimeOnly("com.h2database:h2")');
    expect(buildSnippets("testcontainers", data, "both").maven).toContain("<scope>test</scope>");
    expect(buildSnippets("testcontainers", data, "both").gradle).toContain("testImplementation(");
  });

  it("annotationProcessor : optional en Maven, compileOnly + annotationProcessor en Gradle", () => {
    const s = buildSnippets("lombok", data, "both");
    expect(s.maven).toContain("<optional>true</optional>");
    expect(s.gradle).toBe('compileOnly("org.projectlombok:lombok")\nannotationProcessor("org.projectlombok:lombok")');
  });

  it("provided", () => {
    const s = buildSnippets("provided", data, "both");
    expect(s.maven).toContain("<scope>provided</scope>");
    expect(s.gradle).toContain("compileOnly(");
  });

  it("scope inconnu : traité comme compile avec une note", () => {
    const s = buildSnippets("weird", data, "both");
    expect(s.gradle).toBe('implementation("org.acme:weird")');
    expect(s.notes.join(" ")).toMatch(/banana/);
  });

  it("BOM : import du BOM avec sa version avant la dépendance", () => {
    const s = buildSnippets("spring-ai-openai", data, "both");
    expect(s.maven).toContain("<dependencyManagement>");
    expect(s.maven).toContain("<artifactId>spring-ai-bom</artifactId>");
    expect(s.maven).toContain("<version>2.0.0</version>");
    expect(s.maven).toContain("<type>pom</type>");
    expect(s.maven).toContain("<scope>import</scope>");
    expect(s.maven!.indexOf("<dependencyManagement>")).toBeLessThan(s.maven!.indexOf("spring-ai-starter-model-openai"));
    expect(s.gradle).toBe('implementation(platform("org.springframework.ai:spring-ai-bom:2.0.0"))\nimplementation("org.springframework.ai:spring-ai-starter-model-openai")');
  });

  it("BOM absent de la liste : note, pas d'exception", () => {
    const s = buildSnippets("bom-missing", data, "both");
    expect(s.kind).toBe("dependency");
    expect(s.notes.join(" ")).toMatch(/ghost/);
    expect(s.maven).not.toContain("dependencyManagement");
  });

  it("version explicite", () => {
    const s = buildSnippets("springdoc", data, "both");
    expect(s.maven).toContain("<version>3.1.0</version>");
    expect(s.gradle).toBe('implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.0")');
  });

  it("dépôt supplémentaire : note avec nom et URL", () => {
    const s = buildSnippets("saml", data, "both");
    expect(s.notes.join(" ")).toContain("Shibboleth Releases (https://build.shibboleth.net/maven/releases)");
  });

  it("plugin de build : pas de snippet", () => {
    const s = buildSnippets("native", data, "both");
    expect(s.kind).toBe("plugin");
    expect(s.maven).toBeUndefined();
    expect(s.notes.join(" ")).toMatch(/build plugin/i);
  });

  it("id sans coordonnées : pas de snippet", () => {
    const s = buildSnippets("htmx", data, "both");
    expect(s.kind).toBe("unavailable");
    expect(s.notes.join(" ")).toMatch(/no Maven coordinates/i);
  });

  it("coordonnées au contenu douteux : pas de snippet", () => {
    const s = buildSnippets("evil", data, "both");
    expect(s.kind).toBe("unavailable");
    expect(s.maven).toBeUndefined();
  });

  it("build limite les snippets produits", () => {
    expect(buildSnippets("web", data, "maven").gradle).toBeUndefined();
    expect(buildSnippets("web", data, "gradle").maven).toBeUndefined();
    expect(buildSnippets("web", data, "gradle").gradle).toBeDefined();
  });
});

describe("formatDependencyMatches", () => {
  const entry = (id: string): CatalogEntry => ({ id, name: `Name ${id}`, description: `Description ${id}` });

  it("en-tête avec le besoin et la version de Boot, fiches avec snippets", () => {
    const text = formatDependencyMatches("web", [entry("web")], data, "both");
    expect(text).toContain('# Dependencies for "web" (Spring Boot 4.1.1)');
    expect(text).toContain("## `web` — Name web");
    expect(text).toContain("Description web");
    expect(text).toContain("org.springframework.boot:spring-boot-starter-webmvc");
    expect(text).toContain("```xml");
    expect(text).toContain("```gradle");
  });

  it("plafonne à 5 résultats avec le nombre restant", () => {
    const ranked = Array.from({ length: 8 }, (_, i) => entry(`dep-${i}`));
    const text = formatDependencyMatches("dep", ranked, data, "both");
    expect(text.match(/^## `/gm)).toHaveLength(5);
    expect(text).toMatch(/3 more matches, refine the query/);
  });

  it("aucun résultat : message avec piste vers get_spring_initializr", () => {
    const text = formatDependencyMatches("zzz", [], data, "both");
    expect(text).toMatch(/No dependency matches "zzz"/);
    expect(text).toContain("get_spring_initializr");
  });

  it("une fiche sans snippet affiche sa note", () => {
    const text = formatDependencyMatches("native", [entry("native")], data, "both");
    expect(text).toMatch(/build plugin/i);
    expect(text).not.toContain("```xml");
  });
});
```

- [ ] **Step 2: Constater l'échec**

Run: `npx vitest run tests/dependency-finder.test.ts`
Expected: FAIL (module `dependency-finder.js` introuvable).

- [ ] **Step 3: Implémenter** `src/services/dependency-finder.ts`

```ts
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
```

- [ ] **Step 4: Constater le succès**

Run: `npx vitest run tests/dependency-finder.test.ts && npx tsc --noEmit`
Expected: PASS ; `tsc` sans erreur (import circulaire de type uniquement : `import type`).

- [ ] **Step 5: Commit**

```bash
git add src/services/dependency-finder.ts tests/dependency-finder.test.ts docs/superpowers/plans/2026-10-02-find-spring-dependency.md
git commit -m "feat(initializr): classement des dépendances et snippets Maven/Gradle (#51)"
```

### Task 2: `InitializrService.findDependency` + tool MCP + synchro + docs

**Files:**
- Modify: `src/services/initializr.ts` (`loadCoordinates`, `findDependency`)
- Modify: `src/tools/index.ts` (entrée en fin de tableau)
- Modify: `src/index.ts` (`case`, `handleFindDependency`)
- Create: `tests/fixtures/initializr-dependencies.json`
- Modify: `docker/tools.json` (régénéré) ; `tests/stdio.test.ts`, `tests/migration-guide.test.ts`, `tests/validation.test.ts` (16 → 17)
- Modify: `README.md`, `CLAUDE.md`, `docker/README.md`, `docs/index.html` (compteurs 16 → 17, carte, `stat-number`)
- Test: `tests/find-dependency.test.ts`

**Interfaces:**
- Consumes: `searchWords`, `flattenCatalog`, `rankDependencies`, `formatDependencyMatches`, `DependencyData`, `BuildChoice` (Task 1) ; `InitializrService.loadMetadata` (privé existant)
- Produces: `InitializrService.findDependency(need: string, build?: BuildChoice): Promise<string>` ; tool `find_spring_dependency` (`need: string`, `build?: "maven" | "gradle" | "both"`)

- [ ] **Step 1: Générer la fixture réduite** (réelle, filtrée sur les ids de `tests/fixtures/initializr.json`)

```bash
curl -s https://start.spring.io/dependencies | python3 -c '
import json,sys
d=json.load(sys.stdin)
m=json.load(open("tests/fixtures/initializr.json"))
ids={x["id"] for g in m["dependencies"]["values"] for x in g["values"]}
d["dependencies"]={k:v for k,v in d["dependencies"].items() if k in ids}
used={v["bom"] for v in d["dependencies"].values() if "bom" in v}
d["boms"]={k:v for k,v in d["boms"].items() if k in used}
used={v["repository"] for v in d["dependencies"].values() if "repository" in v}
d["repositories"]={k:v for k,v in d["repositories"].items() if k in used}
json.dump(d,open("tests/fixtures/initializr-dependencies.json","w"),indent=1)
print(len(d["dependencies"]), list(d["boms"]), list(d["repositories"]), d["bootVersion"])'
```

Expected: quelques dizaines de dépendances (Web, Security, SQL) ; noter les ids réels (`data-jpa`, `web`, `security-saml2`, `h2`…) pour les assertions.

- [ ] **Step 2: Écrire les tests qui échouent** `tests/find-dependency.test.ts`

```ts
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { InitializrService } from "../src/services/initializr.js";
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const METADATA = read("initializr.json");
const DEPENDENCIES = read("initializr-dependencies.json");
const DEPENDENCIES_URL = "https://start.spring.io/dependencies";

const route = (overrides: { dependencies?: any } = {}) =>
  mockedFetch.mockImplementation(async (url: string) =>
    (url === DEPENDENCIES_URL
      ? (overrides.dependencies ?? fakeResponse(200, DEPENDENCIES))
      : fakeResponse(200, METADATA)) as any);

beforeEach(() => {
  vi.useFakeTimers();
  mockedFetch.mockReset();
});

describe("InitializrService.findDependency (#51)", () => {
  it("trouve data-jpa avec ses snippets Maven et Gradle (données réelles)", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("jpa");
    expect(text).toContain("## `data-jpa`");
    expect(text).toContain("org.springframework.boot:spring-boot-starter-data-jpa");
    expect(text).toContain("```xml");
    expect(text).toContain("```gradle");
  });

  it("build=maven ne produit que le snippet Maven", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("jpa", "maven");
    expect(text).toContain("```xml");
    expect(text).not.toContain("```gradle");
  });

  it("need sans mot exploitable : erreur avant tout réseau", async () => {
    route();
    const service = new InitializrService(new CacheService());
    await expect(service.findDependency("the for spring")).rejects.toThrow(/searchable word/i);
    await expect(service.findDependency(".*(")).rejects.toThrow(/searchable word/i);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("aucune correspondance : message explicite", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("zzzzzzqq");
    expect(text).toMatch(/No dependency matches "zzzzzzqq"/);
  });

  it("need non ASCII : pas de crash", async () => {
    route();
    await expect(new InitializrService(new CacheService()).findDependency("base de données")).resolves.toBeTypeOf("string");
  });

  it("deux recherches : un fetch par source, pas plus", async () => {
    route();
    const service = new InitializrService(new CacheService());
    await service.findDependency("jpa");
    await service.findDependency("web");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("erreur HTTP sur /dependencies : propagée, rien de /dependencies en cache", async () => {
    route({ dependencies: fakeResponse(503, "") });
    const cache = new CacheService();
    const outcome = await settle(new InitializrService(cache).findDependency("jpa"));
    expect(outcome.ok).toBe(false);
    expect(cache.get("initializr:dependencies")).toBeNull();
  });

  it("réponse /dependencies sans dependencies : erreur claire, rien en cache", async () => {
    route({ dependencies: fakeResponse(200, "{}") });
    const cache = new CacheService();
    const outcome = await settle(new InitializrService(cache).findDependency("jpa"));
    expect(outcome.ok).toBe(false);
    expect(String((outcome as any).error)).toMatch(/unexpected response/i);
    expect(cache.get("initializr:dependencies")).toBeNull();
  });

  it("boms et repositories absents : tolérés", async () => {
    route({ dependencies: fakeResponse(200, JSON.stringify({ bootVersion: "4.1.1", dependencies: JSON.parse(DEPENDENCIES).dependencies })) });
    await expect(new InitializrService(new CacheService()).findDependency("jpa")).resolves.toContain("`data-jpa`");
  });
});

describe("tool find_spring_dependency (#51)", () => {
  it("est défini avec need borné et build en enum", () => {
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "find_spring_dependency") as any;
    expect(tool.inputSchema.required).toEqual(["need"]);
    expect(tool.inputSchema.properties.need.maxLength).toBe(100);
    expect(tool.inputSchema.properties.build.enum).toEqual(["maven", "gradle", "both"]);
  });

  it("valide les arguments", () => {
    expect(validateToolArguments("find_spring_dependency", { need: "jpa" })).toEqual({ need: "jpa" });
    expect(validateToolArguments("find_spring_dependency", { need: "jpa", build: "gradle" })).toEqual({ need: "jpa", build: "gradle" });
    expect(() => validateToolArguments("find_spring_dependency", {})).toThrow();
    expect(() => validateToolArguments("find_spring_dependency", { need: "  " })).toThrow();
    expect(() => validateToolArguments("find_spring_dependency", { need: "x".repeat(101) })).toThrow();
    expect(() => validateToolArguments("find_spring_dependency", { need: "jpa", build: "ant" })).toThrow();
  });
});
```

Dans `tests/stdio.test.ts`, `tests/migration-guide.test.ts`, `tests/validation.test.ts` : « 16 » → « 17 » (titres et `toHaveLength`).

- [ ] **Step 3: Constater l'échec**

Run: `npm test`
Expected: FAIL (`findDependency is not a function`, tool inconnu, longueurs 17 ≠ 16, landing et docker non synchronisés).

- [ ] **Step 4: Implémenter**

`src/services/initializr.ts` : imports `import { BuildChoice, DependencyData, flattenCatalog, formatDependencyMatches, rankDependencies, searchWords } from './dependency-finder.js';`, constantes `const COORDINATES_URL = 'https://start.spring.io/dependencies';` et `const COORDINATES_CACHE_KEY = 'initializr:dependencies';`, puis dans la classe :

```ts
  async findDependency(need: string, build: BuildChoice = 'both'): Promise<string> {
    const words = searchWords(need);
    if (words.length === 0) {
      throw new Error('The need must contain at least one searchable word (English keywords such as "jpa" or "oauth2")');
    }
    const meta = await this.loadMetadata();
    const data = await this.loadCoordinates();
    const ranked = rankDependencies(flattenCatalog(meta), words);
    return formatDependencyMatches(need, ranked, data, build);
  }

  private async loadCoordinates(): Promise<DependencyData> {
    const cached = this.cache.get<DependencyData>(COORDINATES_CACHE_KEY);
    if (cached) return cached;

    const response = await fetchWithRetry(COORDINATES_URL);
    if (!response.ok) {
      throw new Error(`Spring Initializr is unavailable (HTTP ${response.status})`);
    }
    const data = (await response.json()) as DependencyData;
    if (!data || typeof data.dependencies !== 'object' || data.dependencies === null || Array.isArray(data.dependencies)) {
      unexpected('dependencies');
    }
    this.cache.setLongTerm(COORDINATES_CACHE_KEY, data);
    return data;
  }
```

`src/tools/index.ts`, nouvelle dernière entrée :

```ts
      {
        name: "find_spring_dependency",
        description: "Trouve les starters Spring correspondant à un besoin (mots-clés en anglais, ex. 'jpa', 'postgres', 'oauth2') et renvoie leurs coordonnées avec des snippets Maven et Gradle prêts à coller, d'après Spring Initializr",
        inputSchema: {
          type: "object",
          properties: {
            need: {
              type: "string",
              maxLength: 100,
              description: "Besoin exprimé en mots-clés anglais (ex. 'jpa', 'postgres driver', 'oauth2 client')",
            },
            build: {
              type: "string",
              enum: ["maven", "gradle", "both"],
              description: "Snippets à produire : Maven, Gradle ou les deux",
              default: "both",
            },
          },
          required: ["need"],
        },
      },
```

`src/index.ts` : `case` avant `default` :

```ts
          case "find_spring_dependency":
            result = await this.handleFindDependency(args);
            break;
```

méthode (à côté de `handleGetInitializr`) :

```ts
  private async handleFindDependency(args: any) {
    const { need, build = "both" } = args;

    const text = await this.initializrService.findDependency(need, build);

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }
```

Docs : « 16 » → « 17 » dans `README.md` (2 occurrences), `CLAUDE.md` (`Handles 17 tools`, `all 17 MCP tools` ; ligne `src/services/dependency-finder.ts` : classement et snippets pour `find_spring_dependency`, pur), `docker/README.md` (`17 Powerful Tools`, ligne `- \`find_spring_dependency\` - Find starters for a need with Maven/Gradle snippets`, titre « Advanced Tools (9 Tools) »), `docs/index.html` (méta ×3, sous-titre, `description` JSON, « All 17 Available Tools », `stat-number`, carte copiée de `get_spring_initializr` avec le texte « Find the Spring starters matching a need, with ready-to-paste Maven and Gradle snippets. »).

- [ ] **Step 5: Régénérer et vérifier**

Run: `npm run build && npm run docker:tools && npm test`
Expected: tous les tests PASS ; `docker/tools.json` : diff = le nouveau tool.

- [ ] **Step 6: Vérification réseau réelle (hors suite)**

Run: `node -e 'import("./build/services/initializr.js").then(async m=>{const s=new m.InitializrService();for (const n of ["jpa","postgres","lombok","spring ai openai","saml"]) {const t=await s.findDependency(n);console.log("=====",n);console.log(t.slice(0,1400))}})'`
Expected : `jpa` → `data-jpa` en tête avec ses snippets ; `postgres` → `postgresql` (runtime) ; `lombok` → `compileOnly` + `annotationProcessor` ; `spring ai openai` → `spring-ai-openai` avec le BOM `spring-ai` ; `saml` → note du dépôt Shibboleth. Toute sortie inattendue est notée en `Ruling` ou corrigée par un test RED d'abord.

- [ ] **Step 7: Commit**

```bash
git add src tests docker README.md CLAUDE.md docs/index.html
git commit -m "feat: tool find_spring_dependency (starters, coordonnées et snippets Maven/Gradle) (#51)"
```
