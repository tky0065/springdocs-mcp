# Recherche plein texte locale (BM25) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `search_spring_docs` retrouve les pages par leur contenu (classement BM25) grâce à un index en mémoire alimenté par les pages déjà lues.

**Architecture:** un module pur `SearchIndex` (sans réseau, sans dépendance) est injecté dans `SpringBootDocsServiceOptimized`, qui y ajoute chaque page complète qu'il obtient (projet, référence, guide). `searchSpringDocs` gagne un `docType="content"` (inclus dans `all`) dont les résultats ne sont jamais mis en cache.

**Tech Stack:** TypeScript (Node16, ES2022), vitest 3, aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-10-03-fulltext-search-design.md`

## Global Constraints

- Aucune nouvelle dépendance npm ; BM25 écrit à la main (k1 = 1,2, b = 0,75, titre ×3).
- Aucune requête réseau ajoutée : l'index n'est alimenté que par les pages déjà téléchargées.
- Budget de l'index : 8 000 000 caractères par défaut (`maxChars`), éviction du plus ancien.
- Compteur de tools inchangé (17) ; enum `docType` : `["guides", "reference", "projects", "content", "all"]`.
- Les journaux vont sur stderr (`console.error`), jamais sur stdout.
- `docker/tools.json` doit rester synchronisé (test `tests/docker-tools.test.ts`).
- Migration (`get_migration_guide`) hors périmètre.
- Commits sans ligne d'attribution à Claude (règle du CLAUDE.md global de l'utilisateur).

## Review Focus

- Requête vide ou faite uniquement de stopwords (`"the of"`) : renvoie `[]`, pas d'exception ni de division par zéro.
- Index vide + `docType="all"` : les résultats de titres restent renvoyés, plus une note explicite d'index vide.
- Une page re-lue (même `docId`) remplace l'ancienne entrée sans doublon ni fuite de mémoire.
- Une page seule plus grande que le budget est tronquée au lieu de vider l'index ou de boucler.
- Une exception de l'index ne doit jamais casser la lecture d'une page.

---

## File Structure

- Create `src/services/search-index.ts` : classe `SearchIndex` (tokenisation, BM25, budget, extrait). Aucune dépendance interne.
- Modify `src/services/springboot-docs-optimized.ts` : constructeur (3e paramètre), `indexPage`, alimentation dans `getProjectMarkdown`, `getSpringReference`, `getGuide`, source `content` dans `searchSpringDocs`.
- Modify `src/tools/index.ts:19-24` : enum et description de `docType`.
- Modify `src/index.ts` (`formatSearchResults`) : affichage d'une note.
- Modify `docker/tools.json` (régénéré), `README.md`, `CLAUDE.md`.
- Create `tests/search-index.test.ts`, `tests/fulltext-search.test.ts`; modify `tests/doctype.test.ts`, `tests/error-propagation.test.ts` si leurs assertions changent.

---

### Task 1: Module `SearchIndex`

**Files:**
- Create: `src/services/search-index.ts`
- Test: `tests/search-index.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  export interface SearchHit { docId: string; title: string; url: string; score: number; snippet: string }
  export class SearchIndex {
    constructor(opts?: { maxChars?: number })
    add(docId: string, doc: { title: string; url: string; text: string }): void
    search(query: string, limit: number): SearchHit[]
    get size(): number
  }
  export function tokenize(text: string): string[]
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/search-index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SearchIndex, tokenize } from "../src/services/search-index.js";

function corpus(): SearchIndex {
  const index = new SearchIndex();
  index.add("a", { title: "Datasource configuration", url: "https://x/a", text: "Configure the spring.datasource.url property and the connection pool hikari settings." });
  index.add("b", { title: "Web MVC", url: "https://x/b", text: "Spring MVC controllers handle requests and return views." });
  index.add("c", { title: "Security", url: "https://x/c", text: "Spring Security authentication and authorization filters." });
  index.add("d", { title: "Messaging", url: "https://x/d", text: "Kafka and RabbitMQ messaging with spring." });
  return index;
}

describe("tokenize", () => {
  it("garde les clés pointées et indexe aussi leurs fragments", () => {
    const tokens = tokenize("Set spring.datasource.url now");
    expect(tokens).toContain("spring.datasource.url");
    expect(tokens).toContain("datasource");
    expect(tokens).toContain("url");
  });

  it("retire les stopwords et les jetons d'un caractère", () => {
    expect(tokenize("the of a x")).toEqual([]);
  });
});

describe("SearchIndex.search", () => {
  it("classe en tête la page qui parle du sujet", () => {
    const hits = corpus().search("datasource connection pool", 5);
    expect(hits[0].docId).toBe("a");
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("trouve une clé de configuration pointée", () => {
    expect(corpus().search("spring.datasource.url", 5)[0].docId).toBe("a");
  });

  it("ne renvoie que les pages contenant le terme", () => {
    expect(corpus().search("kafka", 5).map(h => h.docId)).toEqual(["d"]);
  });

  it("renvoie [] pour une requête vide ou faite de stopwords", () => {
    const index = corpus();
    expect(index.search("", 5)).toEqual([]);
    expect(index.search("the of", 5)).toEqual([]);
  });

  it("renvoie [] sur un index vide", () => {
    expect(new SearchIndex().search("kafka", 5)).toEqual([]);
  });

  it("respecte limit", () => {
    expect(corpus().search("spring", 2)).toHaveLength(2);
  });

  it("pondère le titre : un terme dans le titre bat une seule occurrence dans le texte", () => {
    const index = new SearchIndex();
    index.add("x", { title: "kafka", url: "u", text: "alpha beta gamma delta" });
    index.add("y", { title: "other", url: "u", text: "kafka alpha beta gamma delta" });
    expect(index.search("kafka", 5).map(h => h.docId)).toEqual(["x", "y"]);
  });

  it("produit un extrait qui contient le terme sans couper de mot", () => {
    const words = Array.from({ length: 200 }, (_, i) => `alpha${i}`);
    words.splice(100, 0, "needle");
    const index = new SearchIndex();
    index.add("long", { title: "Long", url: "u", text: words.join(" ") });
    const snippet = index.search("needle", 1)[0].snippet;
    expect(snippet).toContain("needle");
    expect(snippet.length).toBeLessThanOrEqual(260);
    for (const word of snippet.replace(/…/g, "").split(/\s+/).filter(Boolean)) {
      expect(word).toMatch(/^(alpha\d+|needle)$/);
    }
  });

  it("donne un extrait de début de page quand le terme n'est que dans le titre", () => {
    const index = new SearchIndex();
    index.add("t", { title: "Kafka", url: "u", text: "intro text only" });
    expect(index.search("kafka", 1)[0].snippet).toContain("intro text only");
  });
});

describe("SearchIndex.add", () => {
  it("remplace une entrée existante au lieu de la dupliquer", () => {
    const index = new SearchIndex();
    index.add("p", { title: "P", url: "u", text: "oldterm here" });
    index.add("p", { title: "P", url: "u", text: "newterm here" });
    expect(index.size).toBe(1);
    expect(index.search("oldterm", 5)).toEqual([]);
    expect(index.search("newterm", 5)).toHaveLength(1);
  });

  it("évince la plus ancienne page au dépassement du budget", () => {
    const index = new SearchIndex({ maxChars: 100 });
    index.add("a", { title: "A", url: "u", text: "firstterm " + "x".repeat(50) });
    index.add("b", { title: "B", url: "u", text: "secondterm " + "y".repeat(50) });
    expect(index.size).toBe(1);
    expect(index.search("firstterm", 5)).toEqual([]);
    expect(index.search("secondterm", 5)).toHaveLength(1);
  });

  it("tronque une page seule plus grande que le budget", () => {
    const index = new SearchIndex({ maxChars: 50 });
    index.add("big", { title: "Big", url: "u", text: "headterm " + "word ".repeat(100) });
    expect(index.size).toBe(1);
    expect(index.search("headterm", 5)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/search-index.test.ts`
Expected: FAIL (`Cannot find module '../src/services/search-index.js'`).

- [ ] **Step 3: Write minimal implementation**

Create `src/services/search-index.ts`:

```ts
/**
 * In-memory BM25 full-text index over documentation pages already read by the server.
 * Pure module: no network, no dependency.
 */

export interface SearchHit {
  docId: string;
  title: string;
  url: string;
  score: number;
  snippet: string;
}

interface IndexedDoc {
  title: string;
  url: string;
  text: string;
  tf: Map<string, number>;
  length: number;
}

const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 3;
const DEFAULT_MAX_CHARS = 8_000_000;
const SNIPPET_BEFORE = 80;
const SNIPPET_AFTER = 120;
const FALLBACK_SNIPPET = 200;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "with", "what", "when", "which", "you", "your",
]);

const keep = (token: string): boolean => token.length > 1 && !STOPWORDS.has(token);

/** Lowercased tokens; dotted/dashed keys (spring.datasource.url) are kept whole and also split. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.toLowerCase().matchAll(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g)) {
    const token = match[0];
    if (keep(token)) tokens.push(token);
    if (/[.-]/.test(token)) {
      for (const part of token.split(/[.-]/)) {
        if (keep(part)) tokens.push(part);
      }
    }
  }
  return tokens;
}

export class SearchIndex {
  private readonly maxChars: number;
  private readonly docs = new Map<string, IndexedDoc>();
  private readonly df = new Map<string, number>();
  private totalLength = 0;
  private totalChars = 0;

  constructor(opts: { maxChars?: number } = {}) {
    this.maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  }

  get size(): number {
    return this.docs.size;
  }

  add(docId: string, doc: { title: string; url: string; text: string }): void {
    this.remove(docId);
    const text = doc.text.length > this.maxChars ? doc.text.slice(0, this.maxChars) : doc.text;
    const tf = new Map<string, number>();
    let length = 0;
    for (const token of tokenize(text)) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
      length += 1;
    }
    for (const token of tokenize(doc.title)) {
      tf.set(token, (tf.get(token) ?? 0) + TITLE_WEIGHT);
      length += TITLE_WEIGHT;
    }
    for (const token of tf.keys()) {
      this.df.set(token, (this.df.get(token) ?? 0) + 1);
    }
    this.docs.set(docId, { title: doc.title, url: doc.url, text, tf, length });
    this.totalLength += length;
    this.totalChars += text.length;

    // Evict the oldest pages until the budget holds (the page just added is always last)
    while (this.totalChars > this.maxChars && this.docs.size > 1) {
      const oldest = this.docs.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
  }

  search(query: string, limit: number): SearchHit[] {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0 || this.docs.size === 0) return [];

    const n = this.docs.size;
    const avgLength = this.totalLength / n || 1;
    const idf = new Map<string, number>();
    for (const term of terms) {
      const df = this.df.get(term) ?? 0;
      idf.set(term, Math.log(1 + (n - df + 0.5) / (df + 0.5)));
    }

    const scored: Array<{ docId: string; score: number }> = [];
    for (const [docId, doc] of this.docs) {
      let score = 0;
      for (const term of terms) {
        const tf = doc.tf.get(term);
        if (!tf) continue;
        score += (idf.get(term) as number) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.length / avgLength));
      }
      if (score > 0) scored.push({ docId, score });
    }
    scored.sort((x, y) => y.score - x.score || x.docId.localeCompare(y.docId));

    const byIdf = [...terms].sort((x, y) => (idf.get(y) as number) - (idf.get(x) as number));
    return scored.slice(0, limit).map(({ docId, score }) => {
      const doc = this.docs.get(docId) as IndexedDoc;
      return { docId, title: doc.title, url: doc.url, score, snippet: makeSnippet(doc.text, byIdf) };
    });
  }

  private remove(docId: string): void {
    const doc = this.docs.get(docId);
    if (!doc) return;
    for (const token of doc.tf.keys()) {
      const next = (this.df.get(token) ?? 1) - 1;
      if (next <= 0) this.df.delete(token);
      else this.df.set(token, next);
    }
    this.totalLength -= doc.length;
    this.totalChars -= doc.text.length;
    this.docs.delete(docId);
  }
}

/** ~200 characters around the best term, trimmed to whole words. */
function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  for (const term of terms) {
    const at = lower.indexOf(term);
    if (at < 0) continue;
    let start = Math.max(0, at - SNIPPET_BEFORE);
    let end = Math.min(text.length, at + SNIPPET_AFTER);
    if (start > 0) {
      const space = text.slice(start, at).search(/\s/);
      if (space >= 0) start += space + 1;
    }
    if (end < text.length) {
      const space = text.slice(at, end).search(/\s\S*$/);
      if (space >= 0) end = at + space;
    }
    const body = text.slice(start, end).replace(/\s+/g, " ").trim();
    return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
  }
  return text.slice(0, FALLBACK_SNIPPET).replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/search-index.test.ts`
Expected: PASS (tous les tests). Si l'extrait coupe un mot ou dépasse 260 caractères, corriger `makeSnippet`, pas le test.

- [ ] **Step 5: Commit**

```bash
git add src/services/search-index.ts tests/search-index.test.ts
git commit -m "feat(search): index BM25 en mémoire pour la recherche plein texte (#52)"
```

---

### Task 2: Alimentation de l'index et `docType="content"`

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts` (constructeur l.~23, `getProjectMarkdown` l.~84-120, `getGuide` l.~238-241, `getSpringReference` l.~319-335, `searchSpringDocs` l.~476-525)
- Modify: `src/tools/index.ts:19-24`
- Modify: `src/index.ts` (`formatSearchResults`, l.~485-500)
- Modify: `tests/doctype.test.ts`, `tests/error-propagation.test.ts`
- Regenerate: `docker/tools.json`
- Test: `tests/fulltext-search.test.ts`

**Interfaces:**
- Consumes: `SearchIndex`, `SearchHit` (Task 1).
- Produces: `new SpringBootDocsServiceOptimized(config?, cache?, searchIndex?)` ; `searchSpringDocs(query, docType, limit)` accepte `docType = "content"` ; résultats `content` de forme `{ type: "content", title, url, description: <extrait>, score }` ; note `{ type: "note", title: "Content index is empty", description: "..." }`.

- [ ] **Step 1: Write the failing test**

Create `tests/fulltext-search.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { SearchIndex } from "../src/services/search-index.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

const PROJECT_HTML = `<html><body><main><h1>Spring Batch</h1>
<p>Chunk-oriented processing with a configurable retry policy and skip limit.</p></main></body></html>`;

function make(index = new SearchIndex()) {
  const service = new SpringBootDocsServiceOptimized(undefined, new CacheService(), index);
  return { service, index };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, PROJECT_HTML));
});
afterEach(() => vi.restoreAllMocks());

describe("recherche plein texte (#52)", () => {
  it("à froid, docType=content renvoie une note d'index vide sans appel réseau", async () => {
    const { service } = make();
    const results = await service.searchSpringDocs("retry policy", "content", 10);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("note");
    expect(results[0].description).toMatch(/read a page first/i);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("trouve par son contenu une page lue juste avant", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    const results = await service.searchSpringDocs("retry policy", "content", 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: "content", url: "https://spring.io/projects/spring-batch" });
    expect(results[0].description).toMatch(/retry policy/i);
  });

  it("une requête de stopwords renvoie une liste vide, sans note si l'index est alimenté", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    expect(await service.searchSpringDocs("the of", "content", 10)).toEqual([]);
  });

  it("all fusionne titres et contenu sans doublon d'URL", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    vi.spyOn(service as any, "searchSpringProjects").mockResolvedValue([
      { type: "project", title: "Batch", url: "https://spring.io/projects/spring-batch", description: "d" },
    ]);
    vi.spyOn(service as any, "getAllSpringGuides").mockResolvedValue([]);
    vi.spyOn(service as any, "searchInReference").mockResolvedValue([]);
    const results = await service.searchSpringDocs("retry", "all", 10);
    expect(results.filter(r => r.url === "https://spring.io/projects/spring-batch")).toHaveLength(1);
    expect(results[0].type).toBe("project");
  });

  it("ne met pas en cache les résultats content", async () => {
    const { service } = make();
    expect(await service.searchSpringDocs("retry", "content", 10)).toHaveLength(1); // note d'index vide
    mockedFetch.mockClear();
    await service.getSpringProject("spring-batch");
    const results = await service.searchSpringDocs("retry", "content", 10);
    expect(results[0].type).toBe("content");
  });

  it("une exception de l'index ne casse pas la lecture d'une page", async () => {
    const index = new SearchIndex();
    vi.spyOn(index, "add").mockImplementation(() => { throw new Error("boom"); });
    const { service } = make(index);
    await expect(service.getSpringProject("spring-batch")).resolves.toContain("Spring Batch");
  });

  it("limit : le contenu ne prend que les places laissées libres ou la moitié", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    vi.spyOn(service as any, "searchSpringProjects").mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({ type: "project", title: `p${i}`, url: `https://x/${i}`, description: "" })));
    vi.spyOn(service as any, "getAllSpringGuides").mockResolvedValue([]);
    vi.spyOn(service as any, "searchInReference").mockResolvedValue([]);
    const results = await service.searchSpringDocs("retry", "all", 4);
    expect(results.map(r => r.type)).toEqual(["project", "project", "project", "content"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fulltext-search.test.ts`
Expected: FAIL (`Invalid docType "content"` ou constructeur sans 3e paramètre).

- [ ] **Step 3: Implement**

3a. `src/services/springboot-docs-optimized.ts`, en tête :

```ts
import { SearchIndex } from './search-index.js';
```

Constructeur et champ :

```ts
  private searchIndex: SearchIndex;

  constructor(
    projectsConfig: SpringProjectsConfig = springProjectsConfig,
    cache: CacheService = new CacheService(),
    searchIndex: SearchIndex = new SearchIndex()
  ) {
    this.projectsConfig = projectsConfig;
    this.cache = cache;
    this.searchIndex = searchIndex;
  }

  /** Feeds the full-text index with a page already fetched; never breaks the read path. */
  private indexPage(docId: string, title: string, url: string, text: string): void {
    try {
      this.searchIndex.add(docId, { title, url, text });
    } catch (error) {
      console.error(`Content index failure for ${docId}:`, error instanceof Error ? error.message : error);
    }
  }
```

3b. `getProjectMarkdown`, juste avant `const entry = { markdown, url };` :

```ts
      this.indexPage(`project:${slug}`, projectName, url, markdown);
```

3c. `getGuide`, après `const result = this.processHtmlGuide(...)` et avant `setLongTerm` :

```ts
      this.indexPage(`guide:${name}`, `Guide: ${name}`, sourceUrl, result);
```

3d. `getSpringReference`, après `const entry = { markdown, url };` :

```ts
      this.indexPage(
        `reference:${projectId}:${normalizedVersion ?? 'current'}:${section}:${subsection ?? 'main'}`,
        this.referenceTitle(projectId, section, subsection),
        url,
        markdown
      );
```

3e. `searchSpringDocs` : remplacer le corps par la version scindée ci-dessous (la logique des sources de titres est déplacée telle quelle dans `searchTitleSources`).

```ts
  async searchSpringDocs(query: string, docType: string = 'all', limit: number = 10): Promise<any[]> {
    const allowedDocTypes = ['guides', 'reference', 'projects', 'content', 'all'];
    if (!allowedDocTypes.includes(docType)) {
      throw new Error(`Invalid docType "${docType}". Allowed: ${allowedDocTypes.join(', ')}`);
    }
    const cacheKey = `docs:${query}:${docType}:${limit}`;
    // Only the title sources are cached: content hits depend on the current state of the index
    const titles = this.cache.get<any[]>(cacheKey) ?? await this.searchTitleSources(query, docType, limit, cacheKey);
    if (docType !== 'all' && docType !== 'content') {
      return titles.slice(0, limit);
    }
    return this.mergeContentResults(titles, query, docType, limit);
  }

  private mergeContentResults(titles: any[], query: string, docType: string, limit: number): any[] {
    const seen = new Set(titles.map(result => result.url));
    let content: any[] = [];
    try {
      content = this.searchIndex.search(query, limit)
        .filter(hit => !seen.has(hit.url))
        .map(hit => ({ type: 'content', title: hit.title, url: hit.url, description: hit.snippet, score: hit.score }));
    } catch (error) {
      console.error('Content search failed:', error instanceof Error ? error.message : error);
    }
    // Content takes the slots titles leave free, and at most half of them otherwise
    const contentSlots = Math.min(content.length, Math.max(Math.floor(limit / 2), limit - titles.length));
    const merged = [...titles.slice(0, limit - contentSlots), ...content.slice(0, contentSlots)];
    if (this.searchIndex.size === 0) {
      merged.push({
        type: 'note',
        title: 'Content index is empty',
        description: 'Full-text search covers pages already read: read a page first (get_spring_project, get_spring_reference or get_spring_guide), then search again.'
      });
    }
    return merged;
  }

  private async searchTitleSources(query: string, docType: string, limit: number, cacheKey: string): Promise<any[]> {
    const results: any[] = [];
    const sources: Array<[string, () => Promise<any[]>]> = [];
    // ... corps existant inchangé : sources guides / projects / reference (en ajoutant la
    // condition docType === 'all' || docType === '<x>', 'content' ne déclenche aucune source),
    // allSettled, erreur si toutes les sources échouent, cache.set si aucun échec ...
    return results.slice(0, limit);
  }
```

Dans `searchTitleSources`, reprendre à l'identique le code existant (de `const sources...` à `return results.slice(0, limit)`), sans le `cacheKey`/`cached` du début (déjà traités par l'appelant). Pour `docType === 'content'`, `sources` est vide : le contrôle `sources.length > 0 && failures.length === sources.length` ne lève rien et `this.cache.set(cacheKey, results)` stocke `[]` (inoffensif).

3f. `src/tools/index.ts:19-24` :

```ts
            docType: {
              type: "string",
              enum: ["guides", "reference", "projects", "content", "all"],
              description: "Type de documentation à rechercher. `content` = recherche plein texte (classement BM25) dans les pages déjà lues par le serveur (get_spring_project, get_spring_reference, get_spring_guide) ; inclus dans `all`.",
              default: "all",
            },
```

3g. `src/index.ts`, `formatSearchResults` : traiter la note avant le gabarit général.

```ts
      .map((result, index) => {
        if (result.type === "note") {
          return `${index + 1}. **${result.title}**
   ${result.description}

`;
        }
        return `${index + 1}. **${result.title}**
```

- [ ] **Step 4: Régénérer `docker/tools.json` et corriger les tests existants**

Run: `npm run build && npm run docker:tools`

Mettre à jour `tests/doctype.test.ts` : le message attendu devient `/Invalid docType "api".*guides, reference, projects, content, all/` et l'enum `["guides", "reference", "projects", "content", "all"]`. Dans le test « ordre guides, projects, reference » et dans `tests/error-propagation.test.ts` (appels `searchSpringDocs("boot", "all", 10)`), l'index est vide : la note d'index vide est ajoutée en fin de liste. Filtrer dans ces assertions avec `.filter((r: any) => r.type !== "note")` avant de comparer titres ou longueurs ; ne pas affaiblir les autres vérifications.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: tout PASS (build + vitest, y compris `docker-tools.test.ts`). Lire la sortie réelle ; corriger les assertions de `fulltext-search.test.ts` si leur forme (et non le comportement) est en cause.

- [ ] **Step 6: Commit**

```bash
git add src tests docker/tools.json
git commit -m "feat(search): docType content, recherche plein texte BM25 sur les pages lues (#52)"
```

---

### Task 3: Documentation

**Files:**
- Modify: `CLAUDE.md` (liste des composants / Services Architecture)
- Modify: `README.md` (description de `search_spring_docs`)

- [ ] **Step 1: CLAUDE.md** : ajouter dans « Services Architecture », après `src/services/diagnosis.ts` :

```
- `src/services/search-index.ts`: in-memory BM25 index (`SearchIndex`) fed by pages the docs service already fetched; powers `docType="content"` of `search_spring_docs` (never cached, empty on a cold server)
```

- [ ] **Step 2: README.md** : `grep -n "search_spring_docs" README.md`, puis à l'endroit de la description du tool, ajouter une ligne : « `docType=content` : recherche plein texte (BM25) dans les pages déjà lues par le serveur ; vide tant qu'aucune page n'a été lue. » Ne modifier aucun compteur de tools.

- [ ] **Step 3: Vérifier et committer**

Run: `npm test`
Expected: PASS.

```bash
git add CLAUDE.md README.md
git commit -m "docs: recherche plein texte (docType content) (#52)"
```

---

## Self-Review

- Couverture de la spec : module (Task 1), alimentation projets/référence/guides, interface, dédoublonnage, note à froid, non-cache, enum + `tools.json` (Task 2), docs (Task 3). Migration hors périmètre, notée.
- Écart assumé par rapport à la spec : répartition des places (le contenu prend les places libres, au plus la moitié sinon) pour ne pas être écrasé par les titres ; la note d'index vide s'ajoute hors `limit`.
- Cohérence des noms : `SearchIndex`, `SearchHit`, `tokenize`, `indexPage`, `mergeContentResults`, `searchTitleSources`.
