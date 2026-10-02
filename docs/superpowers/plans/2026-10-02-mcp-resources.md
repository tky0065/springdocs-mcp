# MCP resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir la doc Spring sous forme de resources MCP (`spring://project/<slug>`, `spring://guide/<id>`), en markdown complet (IMPROVE.md #47).

**Architecture:** `SpringBootDocsServiceOptimized` expose `getProjectMarkdown(name)` (markdown complet + URL, cache) dont `getSpringProject` pagine le résultat. Nouveau `src/resources.ts` : `parseResourceUri` (pure), `ResourcesService(docs)` avec `listResources()`, `listTemplates()`, `readResource(uri)`. `src/index.ts` annonce `resources: {}` et branche trois handlers.

**Tech Stack:** TypeScript (Node16), vitest 3 (`vi.mock("node-fetch")`), MCP SDK 1.x.

**Spec:** `docs/superpowers/specs/2026-10-02-mcp-resources-design.md`

## Global Constraints

- Regex : projet `^[a-z0-9][a-z0-9-]*$`, guide `^[A-Za-z0-9][A-Za-z0-9._-]*$` sans `..` ; analyse sur la chaîne brute, jamais `new URL`.
- URI invalide → `McpError(InvalidParams)` ; échec de récupération → `McpError(InternalError)` avec le message d'origine.
- Resources en markdown complet, `mimeType: "text/markdown"`, pas de pagination ; capacité `resources: {}` sans `subscribe` ni `listChanged`.
- Le nombre de tools reste 16 ; `docker/tools.json` inchangé.
- Pas de ligne d'attribution Claude dans les commits (règle CLAUDE.md global).

## Review Focus

- URI hostiles : `spring://project/../x`, `spring://project/spring-boot?x=1`, `spring://project/spring-boot#a`, `spring://project/spring-boot/extra`, `spring://guide/a/b`, `spring://guide/..`, `spring://other/x`, `http://spring.io`, chaîne vide, `spring://project/` : tous rejetés, aucun fetch.
- Casse : `spring://project/Spring-Boot` rejeté (slug en minuscules uniquement).
- Même document lu via un tool puis une resource : un seul fetch (cache partagé).
- `getSpringProject` reste paginé (footer « Partie … ») après le refactor.
- Échec réseau sur `resources/read` : erreur JSON-RPC, serveur toujours vivant, rien en cache.

---

### Task 1: `getProjectMarkdown` (refactor sans changement de comportement)

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts:84-121`
- Test: `tests/project-markdown.test.ts` (créer)

**Interfaces:**
- Produces: `getProjectMarkdown(projectName: string): Promise<{ markdown: string; url: string }>` ; `getSpringProject(projectName, offset)` inchangé (sortie identique).

- [ ] **Step 1: Test qui échoue** `tests/project-markdown.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const HTML = "<main><h1>Spring Boot</h1><p>Contenu du projet.</p></main>";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, HTML) as any);
});

describe("getProjectMarkdown (#47)", () => {
  it("renvoie le markdown complet et l'URL source", async () => {
    const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
    const { markdown, url } = await docs.getProjectMarkdown("spring-boot");
    expect(markdown).toContain("Contenu du projet.");
    expect(url).toBe("https://spring.io/projects/spring-boot");
  });

  it("un seul fetch partagé avec getSpringProject", async () => {
    const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
    await docs.getProjectMarkdown("spring-boot");
    const paged = await docs.getSpringProject("spring-boot");
    expect(paged).toMatch(/^# spring-boot\n/);
    expect(paged).toContain("For complete project info, visit: https://spring.io/projects/spring-boot");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("rejette un nom dangereux avant tout fetch", async () => {
    const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
    await expect(docs.getProjectMarkdown("../x")).rejects.toThrow();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("projet introuvable : erreur et rien en cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "") as any);
    const cache = new CacheService();
    const docs = new SpringBootDocsServiceOptimized(undefined, cache);
    await expect(docs.getProjectMarkdown("spring-nope")).rejects.toThrow(/not found/i);
    expect(cache.getStats().size).toBe(0);
  });
});
```

- [ ] **Step 2: Constater l'échec**

Run: `npx vitest run tests/project-markdown.test.ts`
Expected: FAIL (`getProjectMarkdown is not a function`) ; le test « rejette un nom dangereux » et « introuvable » échouent aussi pour la même raison.

- [ ] **Step 3: Implémenter** : remplacer `getSpringProject` (lignes 84-121) par :

```ts
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
```

- [ ] **Step 4: Vérifier (nouveaux tests + suite : le refactor ne doit rien casser)**

Run: `npx vitest run tests/project-markdown.test.ts && npm test`
Expected: PASS ; `tests/pagination.test.ts` (cas `getSpringProject`) reste vert.

- [ ] **Step 5: Commit**

```bash
git add src/services/springboot-docs-optimized.ts tests/project-markdown.test.ts docs/superpowers/plans/2026-10-02-mcp-resources.md
git commit -m "refactor(docs): getProjectMarkdown renvoie le markdown complet d'un projet (#47)"
```

### Task 2: Module `src/resources.ts`

**Files:**
- Create: `src/resources.ts`
- Test: `tests/resources.test.ts`

**Interfaces:**
- Consumes: `getProjectMarkdown(name)`, `getGuide(id, "full")` (`SpringBootDocsServiceOptimized`), `springProjectsConfig.getAllProjects()` (champs `id`, `displayName`)
- Produces: `parseResourceUri(uri: string): { kind: "project" | "guide"; id: string }` (lève `McpError(InvalidParams)`), `class ResourcesService { constructor(docs: SpringBootDocsServiceOptimized); listResources(): { uri; name; description; mimeType }[]; listTemplates(): { uriTemplate; name; description; mimeType }[]; readResource(uri: string): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> }`

- [ ] **Step 1: Tests qui échouent** `tests/resources.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CacheService } from "../src/services/cache.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { ResourcesService, parseResourceUri } from "../src/resources.js";
import { springProjectsConfig } from "../src/services/spring-projects-config.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

function setup() {
  const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
  return { docs, resources: new ResourcesService(docs) };
}

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) {
    expect(e).toBeInstanceOf(McpError);
    return (e as McpError).code;
  }
  throw new Error("aucune erreur levée");
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, "<main><h1>Titre</h1><p>Corps du document.</p></main>") as any);
});

describe("parseResourceUri", () => {
  it("accepte projet et guide", () => {
    expect(parseResourceUri("spring://project/spring-boot")).toEqual({ kind: "project", id: "spring-boot" });
    expect(parseResourceUri("spring://guide/rest-service")).toEqual({ kind: "guide", id: "rest-service" });
    expect(parseResourceUri("spring://guide/gs-rest.service_2")).toEqual({ kind: "guide", id: "gs-rest.service_2" });
  });

  it.each([
    "spring://project/../x", "spring://project/spring-boot?x=1", "spring://project/spring-boot#a",
    "spring://project/spring-boot/extra", "spring://project/Spring-Boot", "spring://project/", "spring://project",
    "spring://guide/a/b", "spring://guide/..", "spring://guide/a..b", "spring://guide/",
    "spring://other/x", "http://spring.io", "", "spring://project/spring-boot\n", " spring://project/spring-boot",
  ])("rejette %j en InvalidParams", (uri) => {
    expect(code(() => parseResourceUri(uri))).toBe(ErrorCode.InvalidParams);
  });
});

describe("listResources / listTemplates", () => {
  it("liste les 11 projets du registre avec des URI uniques bien formées", () => {
    const list = setup().resources.listResources();
    expect(list).toHaveLength(springProjectsConfig.getAllProjects().length);
    expect(list).toHaveLength(11);
    expect(new Set(list.map((r) => r.uri)).size).toBe(11);
    for (const r of list) {
      expect(() => parseResourceUri(r.uri)).not.toThrow();
      expect(r.uri.startsWith("spring://project/spring-")).toBe(true);
      expect(r.mimeType).toBe("text/markdown");
      expect(r.name).toBeTruthy();
    }
    expect(list.map((r) => r.uri)).toContain("spring://project/spring-boot");
  });

  it("expose les templates projet et guide", () => {
    const templates = setup().resources.listTemplates();
    expect(templates.map((t) => t.uriTemplate)).toEqual(["spring://project/{name}", "spring://guide/{id}"]);
    for (const t of templates) expect(t.mimeType).toBe("text/markdown");
  });
});

describe("readResource", () => {
  it("lit un projet : markdown complet, mimeType et source", async () => {
    const { contents } = await setup().resources.readResource("spring://project/spring-boot");
    expect(contents).toHaveLength(1);
    expect(contents[0].uri).toBe("spring://project/spring-boot");
    expect(contents[0].mimeType).toBe("text/markdown");
    expect(contents[0].text).toContain("Corps du document.");
    expect(contents[0].text).toContain("Source: https://spring.io/projects/spring-boot");
  });

  it("lit un guide", async () => {
    const { contents } = await setup().resources.readResource("spring://guide/rest-service");
    expect(contents[0].mimeType).toBe("text/markdown");
    expect(contents[0].text).toContain("Corps du document.");
  });

  it("une URI invalide ne déclenche aucun fetch", async () => {
    await expect(setup().resources.readResource("spring://project/../x")).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("un échec de récupération devient une McpError InternalError, sans cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "") as any);
    const cache = new CacheService();
    const docs = new SpringBootDocsServiceOptimized(undefined, cache);
    await expect(new ResourcesService(docs).readResource("spring://project/spring-nope"))
      .rejects.toMatchObject({ code: ErrorCode.InternalError });
    expect(cache.getStats().size).toBe(0);
  });

  it("partage le cache avec les tools : un seul fetch", async () => {
    const { docs, resources } = setup();
    await docs.getSpringProject("spring-boot");
    await resources.readResource("spring://project/spring-boot");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Constater l'échec**

Run: `npx vitest run tests/resources.test.ts`
Expected: FAIL (module `resources.js` introuvable).

- [ ] **Step 3: Implémenter** `src/resources.ts`

```ts
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { SpringBootDocsServiceOptimized } from "./services/springboot-docs-optimized.js";
import { springProjectsConfig } from "./services/spring-projects-config.js";

// MCP resources: the Spring documentation the server already fetches, served as complete markdown documents.
// Real API only: reads go through the same services, cache and URL checks as the tools.

const MIME_TYPE = "text/markdown";
const PROJECT_PATTERN = /^spring:\/\/project\/([a-z0-9][a-z0-9-]*)$/;
const GUIDE_PATTERN = /^spring:\/\/guide\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;
const ACCEPTED_FORMS = "spring://project/<name> (e.g. spring://project/spring-boot) or spring://guide/<id> (e.g. spring://guide/rest-service)";

export type ParsedResource = { kind: "project" | "guide"; id: string };

/** Strict parsing of the raw string: no URL normalization, so nothing but the two accepted forms gets through. */
export function parseResourceUri(uri: string): ParsedResource {
  const project = PROJECT_PATTERN.exec(uri);
  if (project) return { kind: "project", id: project[1] };

  const guide = GUIDE_PATTERN.exec(uri);
  if (guide && !guide[1].includes("..")) return { kind: "guide", id: guide[1] };

  throw new McpError(ErrorCode.InvalidParams, `Invalid resource URI. Expected ${ACCEPTED_FORMS}`);
}

export class ResourcesService {
  constructor(private docs: SpringBootDocsServiceOptimized) {}

  listResources() {
    return springProjectsConfig.getAllProjects().map((project) => ({
      uri: `spring://project/spring-${project.id}`,
      name: project.displayName,
      description: `${project.displayName} project page on spring.io`,
      mimeType: MIME_TYPE,
    }));
  }

  listTemplates() {
    return [
      {
        uriTemplate: "spring://project/{name}",
        name: "Spring project",
        description: "Any project page of spring.io/projects, by slug (e.g. spring-boot)",
        mimeType: MIME_TYPE,
      },
      {
        uriTemplate: "spring://guide/{id}",
        name: "Spring guide",
        description: "A getting-started guide of spring.io/guides, by id (e.g. rest-service)",
        mimeType: MIME_TYPE,
      },
    ];
  }

  async readResource(uri: string) {
    const { kind, id } = parseResourceUri(uri);
    try {
      let text: string;
      if (kind === "project") {
        const { markdown, url } = await this.docs.getProjectMarkdown(id);
        text = `# ${id}\n\n${markdown}\n\nSource: ${url}`;
      } else {
        text = await this.docs.getGuide(id, "full");
      }
      return { contents: [{ uri, mimeType: MIME_TYPE, text }] };
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : "Unable to read the resource");
    }
  }
}
```

- [ ] **Step 4: Constater le succès**

Run: `npx vitest run tests/resources.test.ts && npx tsc --noEmit`
Expected: PASS ; `tsc` sans erreur. Si l'assertion du guide échoue (le HTML factice ne ressemble pas à une page de guide), adapter la fixture du test à ce que `processHtmlGuide` extrait réellement, sans toucher au code de production (ledger en `Ruling`).

- [ ] **Step 5: Commit**

```bash
git add src/resources.ts tests/resources.test.ts
git commit -m "feat(resources): ResourcesService et analyse stricte des URI spring:// (#47)"
```

### Task 3: Branchement dans le serveur + docs

**Files:**
- Modify: `src/index.ts` (imports, `capabilities`, `setupResourceHandlers`)
- Modify: `README.md`, `CLAUDE.md`, `docker/README.md`
- Test: `tests/stdio.test.ts`

**Interfaces:**
- Consumes: `ResourcesService` (Task 2)
- Produces: capacité `resources` ; requêtes `resources/list`, `resources/templates/list`, `resources/read`

- [ ] **Step 1: Tests stdio qui échouent** (après les tests de prompts dans `tests/stdio.test.ts`)

```ts
  it("annonce la capacité resources et liste projets et templates", async () => {
    client = new Client();
    const init = await client.initialize("2024-11-05");
    expect(init.result.capabilities.resources).toBeDefined();
    const list = await client.request("resources/list", {});
    expect(list.result.resources).toHaveLength(11);
    const templates = await client.request("resources/templates/list", {});
    expect(templates.result.resourceTemplates.map((t: any) => t.uriTemplate))
      .toEqual(["spring://project/{name}", "spring://guide/{id}"]);
  });

  it("resources/read rejette une URI invalide sans réseau", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const bad = await client.request("resources/read", { uri: "spring://project/../x" });
    expect(bad.error?.code).toBe(-32602);
  });
```

- [ ] **Step 2: Constater l'échec**

Run: `npx vitest run tests/stdio.test.ts`
Expected: FAIL (capacité absente, méthode inconnue).

- [ ] **Step 3: Implémenter** dans `src/index.ts`

Imports : ajouter `ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema` à l'import de `@modelcontextprotocol/sdk/types.js` et `import { ResourcesService } from "./resources.js";`. Champ `private resourcesService: ResourcesService;`, capacités `resources: {}` après `prompts: {}`, dans le constructeur après la création de `docsService` : `this.resourcesService = new ResourcesService(this.docsService);`, et après `this.setupPromptHandlers();` : `this.setupResourceHandlers();`. Méthode :

```ts
  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.resourcesService.listResources(),
    }));

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: this.resourcesService.listTemplates(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.resourcesService.readResource(request.params.uri);
    });
  }
```

Docs : section « Resources » dans `README.md` (avant « Prompts »), `docker/README.md` (avant « Prompts »), ligne dans la liste des composants de `CLAUDE.md` (`src/resources.ts` : MCP resources `spring://project/<slug>` et `spring://guide/<id>`, markdown complet, via `docsService`) ; mentionner que `resources/list` énumère les 11 projets du registre et que les guides passent par le template.

- [ ] **Step 4: Vérifier**

Run: `npm test`
Expected: tous les tests PASS.

- [ ] **Step 5: Vérification réseau réelle (hors suite)**

Run: `node -e 'import("./build/services/springboot-docs-optimized.js").then(async d=>{const {ResourcesService}=await import("./build/resources.js");const r=new ResourcesService(new d.SpringBootDocsServiceOptimized());const p=await r.readResource("spring://project/spring-boot");console.log(p.contents[0].text.length,p.contents[0].text.slice(0,300));const g=await r.readResource("spring://guide/rest-service");console.log(g.contents[0].text.length,g.contents[0].text.slice(0,200))})'` (après `npm run build`)
Expected: deux documents non vides (projet et guide `rest-service`).

- [ ] **Step 6: Commit**

```bash
git add src tests README.md CLAUDE.md docker/README.md
git commit -m "feat: annonce et sert les MCP resources spring:// (#47)"
```
