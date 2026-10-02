# get_spring_initializr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le 16e tool `get_spring_initializr` : options et dépendances de start.spring.io, avec filtre texte (IMPROVE.md #50).

**Architecture:** Nouveau module `src/services/initializr.ts` : fonctions pures de formatage (`formatOptions`, `formatDependencies`) et classe `InitializrService(cache)` qui récupère `https://start.spring.io/metadata/client` via `fetchWithRetry`, met le JSON brut en cache 24 h (`setLongTerm`) et formate à la lecture. `src/index.ts` instancie le service avec le cache partagé et route le tool.

**Tech Stack:** TypeScript (Node16), vitest 3 (`vi.mock("node-fetch")`, cf. `tests/release-notes.test.ts`), MCP SDK 1.x.

**Spec:** design approuvé dans la conversation (bounded) : `section` = `options` (défaut) | `dependencies`, `query` filtre les dépendances (id/nom/description, insensible à la casse, plafond 30), pas de génération de projet, pas de snippet pom/gradle (= #51).

## Global Constraints

- URL fixe `https://start.spring.io/metadata/client` ; l'en-tête `Accept` par défaut de `fetchWithRetry` suffit (vérifié : 200, `application/hal+json`, ~75 Ko).
- `fetchWithRetry` renvoie la dernière réponse 429/5xx sans lever : toujours tester `response.ok`.
- Les erreurs réseau sont propagées (jamais mises en cache) ; le JSON n'est mis en cache qu'après une réponse valide.
- Sorties en anglais (comme les autres tools récents).
- Pas de ligne d'attribution Claude dans les commits (règle CLAUDE.md global).
- `docker/tools.json` est généré : `npm run build && npm run docker:tools`.

## Review Focus

- `query` avec caractères spéciaux (`.*`, `(`, `\`) : traité comme du texte littéral, jamais comme regex.
- `query` vide ou blanche : équivaut à l'absence de `query`.
- Plus de 30 correspondances : message « N more matches » ; zéro correspondance : message explicite.
- Réponse JSON sans `dependencies`/`bootVersion` (API modifiée) : erreur claire, pas de `TypeError` brut, rien en cache.
- Deux appels successifs : un seul fetch (cache), y compris entre `options` et `dependencies`.

---

### Task 1: Module `initializr.ts` (formatage + service)

**Files:**
- Create: `src/services/initializr.ts`
- Create: `tests/fixtures/initializr.json` (réduit à partir de l'API réelle)
- Test: `tests/initializr.test.ts`

**Interfaces:**
- Consumes: `fetchWithRetry(url): Promise<FetchResult>` (`src/services/http.ts`), `CacheService.get/setLongTerm` (`src/services/cache.ts`)
- Produces: `InitializrMetadata` (type), `formatOptions(meta): string`, `formatDependencies(meta, query?): string`, `class InitializrService { constructor(cache?: CacheService); getInitializr(section?: "options" | "dependencies", query?: string): Promise<string> }`

- [ ] **Step 1: Générer la fixture réduite** (un script jetable, pas committé ; garde 3 catégories de dépendances et 5 versions de Boot)

```bash
curl -s https://start.spring.io/metadata/client | python3 -c '
import json,sys
d=json.load(sys.stdin)
d.pop("_links",None)
d["bootVersion"]["values"]=d["bootVersion"]["values"][:5]
d["dependencies"]["values"]=[g for g in d["dependencies"]["values"] if g["name"] in ("Web","SQL","Security")]
json.dump(d,open("tests/fixtures/initializr.json","w"),indent=1)'
python3 -c 'import json;d=json.load(open("tests/fixtures/initializr.json"));print([ (g["name"],len(g["values"])) for g in d["dependencies"]["values"]], d["bootVersion"]["default"])'
```

Expected: 3 catégories (Web, Security, SQL) et la version par défaut de Boot affichée. Noter les ids réels (`web`, `data-jpa`, `security`…) pour les assertions ; si le champ `bootVersion.values[].id` contient `SNAPSHOT` ou `-M`, les tests ci-dessous les couvrent.

- [ ] **Step 2: Écrire les tests qui échouent** dans `tests/initializr.test.ts`

```ts
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { InitializrService, formatDependencies, formatOptions } from "../src/services/initializr.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const meta = JSON.parse(readFileSync(new URL("./fixtures/initializr.json", import.meta.url), "utf8"));
const URL_ = "https://start.spring.io/metadata/client";

beforeEach(() => { vi.useFakeTimers(); mockedFetch.mockReset(); });
afterEach(() => vi.useRealTimers());

describe("formatOptions", () => {
  it("liste types, Java, langages, packaging et versions de Boot avec les défauts", () => {
    const text = formatOptions(meta);
    expect(text).toContain("# Spring Initializr options");
    expect(text).toMatch(/Build type/);
    expect(text).toMatch(/Java version/);
    expect(text).toMatch(/Language/);
    expect(text).toMatch(/Packaging/);
    expect(text).toMatch(/Spring Boot version/);
    expect(text).toContain(`${meta.javaVersion.default} (default)`);
    expect(text).toContain(`${meta.bootVersion.default} (default)`);
  });

  it("marque les versions SNAPSHOT et milestone", () => {
    const text = formatOptions(meta);
    expect(text).toMatch(/SNAPSHOT\)? *\(snapshot\)|\(snapshot\)/);
  });
});

describe("formatDependencies", () => {
  it("sans query : groupé par catégorie, id et nom, sans description", () => {
    const text = formatDependencies(meta);
    expect(text).toContain("## Web");
    expect(text).toContain("`web`");
    expect(text).not.toContain(meta.dependencies.values[0].values[0].description);
  });

  it("query : filtre par id, nom ou description, insensible à la casse, avec description", () => {
    const text = formatDependencies(meta, "JPA");
    expect(text).toContain("`data-jpa`");
    expect(text).not.toContain("`security`");
    expect(text).toMatch(/Spring Data JPA/i);
  });

  it("query : caractères spéciaux traités littéralement", () => {
    expect(() => formatDependencies(meta, ".*(")).not.toThrow();
    expect(formatDependencies(meta, ".*")).toMatch(/No dependency matches/);
  });

  it("query vide ou blanche : équivaut à l'absence de query", () => {
    expect(formatDependencies(meta, "   ")).toBe(formatDependencies(meta));
  });

  it("aucune correspondance : message explicite", () => {
    expect(formatDependencies(meta, "zzzzzz")).toMatch(/No dependency matches "zzzzzz"/);
  });

  it("plus de 30 correspondances : plafonné avec un message", () => {
    const many = {
      dependencies: { values: [{ name: "Big", values: Array.from({ length: 35 }, (_, i) => ({ id: `dep-${i}`, name: `Dep ${i}`, description: "x" })) }] },
    };
    const text = formatDependencies(many as any, "dep");
    expect(text.match(/`dep-\d+`/g)).toHaveLength(30);
    expect(text).toMatch(/5 more matches/);
  });

  it("métadonnées sans dependencies : erreur claire", () => {
    expect(() => formatDependencies({} as any)).toThrow(/unexpected response/i);
  });
});

describe("InitializrService", () => {
  const ok = () => mockedFetch.mockResolvedValue(fakeResponse(200, JSON.stringify(meta)) as any);

  it("récupère l'URL des métadonnées et formate les options par défaut", async () => {
    ok();
    const text = await new InitializrService(new CacheService()).getInitializr();
    expect(mockedFetch.mock.calls[0][0]).toBe(URL_);
    expect(text).toContain("# Spring Initializr options");
  });

  it("un seul fetch pour deux appels, options puis dependencies", async () => {
    ok();
    const service = new InitializrService(new CacheService());
    await service.getInitializr("options");
    await service.getInitializr("dependencies", "web");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("propage l'erreur HTTP et ne met rien en cache", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(503, "") as any);
    const cache = new CacheService();
    const service = new InitializrService(cache);
    const outcome = await settle(service.getInitializr());
    expect(outcome.ok).toBe(false);
    expect(cache.getStats().size).toBe(0);
    ok();
    await expect(service.getInitializr()).resolves.toContain("options");
  });

  it("JSON invalide ou inattendu : erreur, rien en cache", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "{}") as any);
    const cache = new CacheService();
    const outcome = await settle(new InitializrService(cache).getInitializr("dependencies"));
    expect(outcome.ok).toBe(false);
    expect(cache.getStats().size).toBe(0);
  });
});
```

- [ ] **Step 3: Constater l'échec**

Run: `npx vitest run tests/initializr.test.ts`
Expected: FAIL (module `initializr.js` introuvable).

- [ ] **Step 4: Implémenter** `src/services/initializr.ts`

```ts
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
    else if (/-(M|RC)\d+/i.test(v.id)) tags.push('milestone');
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
```

Note : `fakeResponse` n'a pas de `json()` : si le test échoue pour cette raison, ajouter `json: async () => JSON.parse(body)` à `fakeResponse` dans `tests/helpers.ts` (changement de test uniquement, ledger en `Ruling`).

- [ ] **Step 5: Constater le succès**

Run: `npx vitest run tests/initializr.test.ts`
Expected: PASS (tous les tests). Le test « marque les versions SNAPSHOT » doit passer ; sinon l'assertion est trop souple ou la fixture n'a pas de SNAPSHOT : la corriger pour cibler un id réel de la fixture.

- [ ] **Step 6: Commit**

```bash
git add src/services/initializr.ts tests/initializr.test.ts tests/fixtures/initializr.json tests/helpers.ts docs/superpowers/plans/2026-10-02-spring-initializr.md
git commit -m "feat(initializr): service et formatage des métadonnées start.spring.io (#50)"
```

### Task 2: Tool MCP `get_spring_initializr` + synchro + compteurs

**Files:**
- Modify: `src/tools/index.ts` (entrée en fin de tableau)
- Modify: `src/index.ts` (import, champ, `case`, `handleGetInitializr`)
- Modify: `docker/tools.json` (régénéré)
- Modify: `tests/stdio.test.ts`, `tests/migration-guide.test.ts`, `tests/validation.test.ts` (15 → 16)
- Modify: `README.md`, `CLAUDE.md`, `docker/README.md`, `docs/index.html` (compteurs 15 → 16 + carte, `stat-number`)
- Test: `tests/initializr.test.ts` (validation du schéma)

**Interfaces:**
- Consumes: `InitializrService.getInitializr(section, query)` (Task 1)
- Produces: tool `get_spring_initializr` (`section?: "options" | "dependencies"`, `query?: string` ≤ 100)

- [ ] **Step 1: Tests qui échouent** (ajouter à `tests/initializr.test.ts` ; imports `ToolDefinitions` et `validateToolArguments` en tête)

```ts
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";

describe("tool get_spring_initializr (#50)", () => {
  it("est défini avec enum section et maxLength sur query", () => {
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "get_spring_initializr") as any;
    expect(tool.inputSchema.properties.section.enum).toEqual(["options", "dependencies"]);
    expect(tool.inputSchema.properties.query.maxLength).toBe(100);
    expect(tool.inputSchema.required ?? []).toEqual([]);
  });

  it("valide les arguments", () => {
    expect(() => validateToolArguments("get_spring_initializr", {})).not.toThrow();
    expect(validateToolArguments("get_spring_initializr", { section: "dependencies", query: "web" }))
      .toEqual({ section: "dependencies", query: "web" });
    expect(() => validateToolArguments("get_spring_initializr", { section: "all" })).toThrow();
    expect(() => validateToolArguments("get_spring_initializr", { query: "x".repeat(101) })).toThrow();
  });
});
```

Dans `tests/stdio.test.ts`, `tests/migration-guide.test.ts`, `tests/validation.test.ts` : « 15 » → « 16 » (titres et `toHaveLength`).

- [ ] **Step 2: Constater l'échec**

Run: `npm test`
Expected: FAIL (tool inconnu, longueurs 16 ≠ 15, landing/docker non synchronisés).

- [ ] **Step 3: Implémenter**

`src/tools/index.ts`, nouvelle dernière entrée :

```ts
      {
        name: "get_spring_initializr",
        description: "Liste les options de Spring Initializr (start.spring.io : build, Java, langage, versions de Spring Boot) ou ses dépendances, avec filtre texte sur l'id, le nom ou la description",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["options", "dependencies"],
              description: "Ce qu'il faut lister : les options du projet ou les dépendances disponibles",
              default: "options",
            },
            query: {
              type: "string",
              maxLength: 100,
              description: "Filtre texte sur les dépendances (id, nom, description), ex. 'jpa' ou 'security'. Ignoré pour section=options",
            },
          },
          required: [],
        },
      },
```

`src/index.ts` : `import { InitializrService } from "./services/initializr.js";`, champ `private initializrService: InitializrService;`, dans le constructeur `this.initializrService = new InitializrService(this.cache);`, `case` avant `default` :

```ts
          case "get_spring_initializr":
            result = await this.handleGetInitializr(args);
            break;
```

méthode :

```ts
  private async handleGetInitializr(args: any) {
    const { section = "options", query } = args;

    const text = await this.initializrService.getInitializr(section, query);

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

Docs : « 15 » → « 16 » dans README (2 occurrences), CLAUDE.md (`Handles 16 tools`, `all 16 MCP tools`), `docker/README.md` (`16 Powerful Tools`, ligne `- \`get_spring_initializr\` - Spring Initializr options and dependencies` ; titre « Advanced Tools (8 Tools) »), CLAUDE.md (« Handles the 8 advanced tools (…, `get_spring_initializr`) » et ligne `src/services/initializr.ts`), `docs/index.html` (méta ×3, sous-titre, `description` JSON, titre « All 16 Available Tools », `stat-number`, carte copiée de `spring_cache_stats` avec le texte « List Spring Initializr build options and dependencies, with a text filter on id, name or description. »).

- [ ] **Step 4: Régénérer et vérifier**

Run: `npm run build && npm run docker:tools && npm test`
Expected: tous les tests PASS ; `docker/tools.json` : diff = le nouveau tool.

- [ ] **Step 5: Vérification réseau réelle (hors suite de tests)**

Run: `node -e 'import("./build/services/initializr.js").then(async m=>{const s=new m.InitializrService();console.log((await s.getInitializr()).slice(0,500));console.log((await s.getInitializr("dependencies","jpa")).slice(0,400))})'`
Expected: options réelles puis dépendances contenant `data-jpa`.

- [ ] **Step 6: Commit**

```bash
git add src tests docker README.md CLAUDE.md docs/index.html
git commit -m "feat: tool get_spring_initializr (options et dépendances start.spring.io) (#50)"
```
