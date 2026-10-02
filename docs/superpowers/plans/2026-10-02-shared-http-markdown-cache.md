# Shared http / markdown / cache Implementation Plan (#27)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer la duplication de `fetchWithRetry`, de la config Turndown et du cleanup de cache entre `SpringBootDocsServiceOptimized` et `AdvancedFeaturesService`.

**Architecture:** Deux modules (`http.ts`, `markdown.ts`) portent le code partagé. `CacheService` démarre lui-même son cleanup (`unref`). Les services reçoivent le cache par constructeur (défaut `new CacheService()`), `src/index.ts` en crée un seul pour les deux. Les méthodes privées `fetchWithRetry` des services restent comme délégués minces.

**Tech Stack:** TypeScript (Node16, ES2022), node-fetch, turndown, vitest 3.

**Spec:** design approuvé dans le chat (bounded), pas de fichier de spec. Backlog : `IMPROVE.md` #27.

## Global Constraints

- Aucun changement de comportement observable des 12 tools ni de leurs schémas.
- Imports relatifs avec extension `.js` (module Node16).
- `extractIntelligentContent` n'est PAS touché (c'est #25).
- Commentaires en anglais, comme le code existant.
- Pas de ligne d'attribution Claude dans les commits (CLAUDE.md global de l'utilisateur).

## Review Focus

- Deux services construits sans argument ont des caches **indépendants** (isolation des tests existants).
- Deux services construits avec le même `CacheService` voient les entrées l'un de l'autre.
- Le timer de cleanup ne retient pas le process (`unref`) : le serveur doit pouvoir s'arrêter.
- `service.fetchWithRetry(url, timeout, retries)` garde sa signature (utilisée par `tests/fetch-retry.test.ts`).

---

### Task 1: `http.ts` et `markdown.ts`

**Files:**
- Create: `src/services/http.ts`, `src/services/markdown.ts`
- Modify: `src/services/springboot-docs-optimized.ts`, `src/services/advanced-features.ts`

**Interfaces:**
- Produces: `fetchWithRetry(url: string, timeout?: number, retries?: number): Promise<FetchResult>`, `interface FetchResult { ok; status; text(); json() }`, `const turndownService: TurndownService`.

- [ ] **Step 1: Créer `src/services/http.ts`** en déplaçant le corps de `fetchWithRetry` tel quel :

```ts
import fetch from 'node-fetch';
import { USER_AGENT } from '../version.js';

export interface FetchResult {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<any>;
}

export const REQUEST_TIMEOUT = 10000;
export const MAX_RETRIES = 3;

export async function fetchWithRetry(url: string, timeout = REQUEST_TIMEOUT, retries = MAX_RETRIES): Promise<FetchResult> {
  // body: exact copy of the current private method (springboot-docs-optimized.ts:580-623)
}
```

Copier le corps de la boucle `for` et le `throw new Error('All retry attempts failed')` sans modification.

- [ ] **Step 2: Créer `src/services/markdown.ts`** :

```ts
import TurndownService from 'turndown';

export const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
```

- [ ] **Step 3: Dans les deux services**, supprimer l'`interface FetchResult` locale, les imports `node-fetch`, `USER_AGENT`, `TurndownService`, le champ/constructeur `turndownService`, `REQUEST_TIMEOUT`, `MAX_RETRIES`. Importer `{ fetchWithRetry, FetchResult, REQUEST_TIMEOUT, MAX_RETRIES }` depuis `./http.js` et `{ turndownService }` depuis `./markdown.js`. Remplacer `this.turndownService` par `turndownService`. Remplacer la méthode privée par :

```ts
  private fetchWithRetry(url: string, timeout?: number, retries?: number): Promise<FetchResult> {
    return fetchWithRetry(url, timeout, retries);
  }
```

(`REQUEST_TIMEOUT`/`MAX_RETRIES` ne sont à importer que s'ils sont encore utilisés.)

- [ ] **Step 4: Vérifier** : `npm test` → build OK, 40 tests verts (dont `fetch-retry.test.ts`).

- [ ] **Step 5: Commit** : `git add src && git commit -m "refactor: extraire fetchWithRetry et la config Turndown dans http.ts et markdown.ts"`

### Task 2: cache partagé avec cleanup intégré

**Files:**
- Modify: `src/services/cache.ts`, `src/services/springboot-docs-optimized.ts`, `src/services/advanced-features.ts`, `src/index.ts`
- Test: `tests/shared-cache.test.ts`

**Interfaces:**
- Consumes: Task 1 (services déjà allégés).
- Produces: `new SpringBootDocsServiceOptimized(projectsConfig?, cache?)`, `new AdvancedFeaturesService(cache?)`, `CacheService` avec cleanup horaire `unref`.

- [ ] **Step 1: Écrire le test qui échoue** `tests/shared-cache.test.ts` :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { CacheService } from "../src/services/cache.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";

afterEach(() => vi.restoreAllMocks());

describe("cache partagé (#27)", () => {
  it("partage les entrées entre services construits avec le même cache", () => {
    const cache = new CacheService();
    const docs = new SpringBootDocsServiceOptimized(undefined, cache) as any;
    const advanced = new AdvancedFeaturesService(cache) as any;
    expect(docs.cache).toBe(cache);
    expect(advanced.cache).toBe(cache);
  });

  it("isole les caches quand aucun n'est fourni", () => {
    const a = new AdvancedFeaturesService() as any;
    const b = new AdvancedFeaturesService() as any;
    expect(a.cache).not.toBe(b.cache);
  });

  it("démarre un cleanup qui ne retient pas le process", () => {
    const unref = vi.fn();
    const spy = vi.spyOn(globalThis, "setInterval").mockReturnValue({ unref } as any);
    new CacheService();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Lancer** `npx vitest run tests/shared-cache.test.ts` → FAIL (constructeurs sans paramètre cache, pas de timer dans `CacheService`).

- [ ] **Step 3: Implémenter.** `cache.ts` : ajouter

```ts
  constructor() {
    // Drop expired entries every hour; unref so the timer never keeps the process alive
    setInterval(() => this.cleanup(), 60 * 60 * 1000).unref();
  }
```

Services : constructeurs `constructor(projectsConfig = springProjectsConfig, cache: CacheService = new CacheService())` et `constructor(cache: CacheService = new CacheService())`, supprimer leurs `setInterval`. `src/index.ts` : 

```ts
    const cache = new CacheService();
    this.docsService = new SpringBootDocsServiceOptimized(undefined, cache);
    this.advancedService = new AdvancedFeaturesService(cache);
```

avec `import { CacheService } from './services/cache.js';`.

- [ ] **Step 4: Vérifier** : `npm test` → tout vert (≥ 43 tests).

- [ ] **Step 5: Commit** : `git add src tests && git commit -m "refactor: cache partagé injecté dans les services, cleanup intégré à CacheService"`

### Task 3: backlog

- [ ] **Step 1:** après vérification réelle de `npm test`, cocher #27 dans `IMPROVE.md` (` — Fait le 2026-10-02`, mention que `extractIntelligentContent` reste dupliqué = #25) et committer.
