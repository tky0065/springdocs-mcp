# spring_cache_stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer les statistiques du cache partagé et une purge optionnelle via un 15e tool MCP, `spring_cache_stats` (IMPROVE.md #49).

**Architecture:** `CacheService` gagne `maxEntries` dans `getStats()`, une méthode `purge(mode)` qui renvoie le nombre d'entrées supprimées, et `statsReport(purge)` qui produit le markdown. `src/index.ts` garde une référence au cache partagé et route le tool vers `statsReport`. Schéma dans `src/tools/index.ts`, validé par `validateToolArguments` (enum fermé).

**Tech Stack:** TypeScript (Node16), vitest 3, MCP SDK 1.x.

**Spec:** design approuvé dans la conversation (bounded, pas de spec écrite) : un seul tool, paramètre optionnel `purge` = `none` (défaut) / `expired` / `all`.

## Global Constraints

- Hors périmètre : budget du cache en octets, stats hits/misses.
- Sans paramètre, le tool est en lecture seule.
- Pas de ligne d'attribution Claude dans les commits ni les PR (règle du CLAUDE.md global de l'utilisateur).
- Commits en français ou anglais selon l'historique (`feat(...)`, `docs`, `test`).
- `docker/tools.json` est généré : `npm run build && npm run docker:tools`.

## Review Focus

- `purge: "all"` sur cache vide : renvoie 0 supprimée, pas d'erreur.
- `purge` invalide (`"everything"`, nombre) : rejeté par la validation, cache intact.
- `purge: "expired"` ne doit pas supprimer les entrées encore valides.
- `statsReport` ne doit pas compter deux fois les expirées quand on purge (stats affichées après purge).
- Le tool n'appelle jamais le réseau (test stdio sans réseau).

---

### Task 1: CacheService : stats, purge, rapport

**Files:**
- Modify: `src/services/cache.ts:73-91`
- Test: `tests/cache-stats.test.ts` (créer)

**Interfaces:**
- Produces: `getStats(): { size: number; expired: number; maxEntries: number }`, `purge(mode: "expired" | "all"): number`, `statsReport(purge?: "none" | "expired" | "all"): string`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "../src/services/cache.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function filled() {
  const cache = new CacheService();
  cache.set("short", "a", 1000);
  cache.set("long", "b", 60 * 60 * 1000);
  vi.advanceTimersByTime(2000); // "short" expire
  return cache;
}

describe("CacheService stats et purge (#49)", () => {
  it("getStats expose la capacité max", () => {
    expect(new CacheService().getStats()).toEqual({ size: 0, expired: 0, maxEntries: 500 });
  });

  it("purge('expired') ne retire que les entrées expirées", () => {
    const cache = filled();
    expect(cache.purge("expired")).toBe(1);
    expect(cache.getStats()).toMatchObject({ size: 1, expired: 0 });
    expect(cache.get("long")).toBe("b");
  });

  it("purge('all') vide tout et renvoie le nombre supprimé", () => {
    const cache = filled();
    expect(cache.purge("all")).toBe(2);
    expect(cache.getStats().size).toBe(0);
  });

  it("purge('all') sur cache vide renvoie 0", () => {
    expect(new CacheService().purge("all")).toBe(0);
  });

  it("statsReport sans purge est en lecture seule", () => {
    const cache = filled();
    const text = cache.statsReport();
    expect(text).toContain("2 / 500");
    expect(text).toMatch(/expired.*1/i);
    expect(text).not.toMatch(/removed/i);
    expect(cache.getStats().size).toBe(2);
  });

  it("statsReport avec purge indique les entrées supprimées et les stats après purge", () => {
    const cache = filled();
    const text = cache.statsReport("expired");
    expect(text).toMatch(/removed.*1/i);
    expect(text).toContain("1 / 500");
    expect(text).toMatch(/expired.*0/i);
  });
});
```

- [ ] **Step 2: Lancer et constater l'échec**

Run: `npx vitest run tests/cache-stats.test.ts`
Expected: FAIL (`purge is not a function`, `maxEntries` absent).

- [ ] **Step 3: Implémenter** (dans `cache.ts`, remplacer `getStats` et ajouter après `clear`)

```ts
  getStats(): { size: number; expired: number; maxEntries: number } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
    }

    return { size: this.cache.size, expired, maxEntries: this.MAX_ENTRIES };
  }

  /**
   * Remove expired entries or everything; returns how many entries were removed
   */
  purge(mode: "expired" | "all"): number {
    const before = this.cache.size;
    if (mode === "all") {
      this.clear();
    } else {
      this.cleanup();
    }
    return before - this.cache.size;
  }

  /**
   * Markdown report of the cache state, optionally purging first
   */
  statsReport(purge: "none" | "expired" | "all" = "none"): string {
    const removed = purge === "none" ? null : this.purge(purge);
    const { size, expired, maxEntries } = this.getStats();
    const lines = [
      "# Cache statistics",
      "",
      `- Entries: ${size} / ${maxEntries}`,
      `- Expired (awaiting cleanup): ${expired}`,
    ];
    if (removed !== null) {
      lines.push(`- Removed by purge (${purge}): ${removed}`);
    }
    return lines.join("\n");
  }
```

- [ ] **Step 4: Relancer, constater le succès**

Run: `npx vitest run tests/cache-stats.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/cache.ts tests/cache-stats.test.ts
git commit -m "feat(cache): stats avec capacité max, purge et rapport markdown (#49)"
```

### Task 2: Tool MCP `spring_cache_stats` + synchro + compteurs

**Files:**
- Modify: `src/tools/index.ts` (ajouter l'entrée en fin de tableau, avant `];` ligne 368)
- Modify: `src/index.ts` (champ `cache`, `case`, `handleCacheStats`)
- Modify: `docker/tools.json` (régénéré)
- Modify: `tests/stdio.test.ts:75,80`, `tests/migration-guide.test.ts:157-159`, `tests/validation.test.ts:55` (14 → 15)
- Modify: `README.md:8,25`, `CLAUDE.md:48,63`, `docker/README.md:71,90-96`, `docs/index.html:7,10,14,466,719,830` + nouvelle carte après `get_release_notes`
- Test: `tests/cache-stats.test.ts` (ajouter), `tests/stdio.test.ts`

**Interfaces:**
- Consumes: `CacheService.statsReport(purge)` (Task 1)
- Produces: tool `spring_cache_stats`, argument `purge?: "none" | "expired" | "all"`

- [ ] **Step 1: Tests qui échouent** (ajouter à `tests/cache-stats.test.ts` ; imports `ToolDefinitions` et `validateToolArguments` en tête de fichier)

```ts
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";

describe("tool spring_cache_stats (#49)", () => {
  it("est défini avec un enum fermé pour purge", () => {
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "spring_cache_stats") as any;
    expect(tool.inputSchema.properties.purge.enum).toEqual(["none", "expired", "all"]);
    expect(tool.inputSchema.required ?? []).toEqual([]);
  });

  it("accepte l'absence d'argument et les trois modes", () => {
    expect(() => validateToolArguments("spring_cache_stats", {})).not.toThrow();
    for (const purge of ["none", "expired", "all"]) {
      expect(validateToolArguments("spring_cache_stats", { purge })).toEqual({ purge });
    }
  });

  it("rejette une purge invalide", () => {
    expect(() => validateToolArguments("spring_cache_stats", { purge: "everything" })).toThrow();
    expect(() => validateToolArguments("spring_cache_stats", { purge: 1 })).toThrow();
  });
});
```

Dans `tests/stdio.test.ts`, ajouter après le test de liste :

```ts
  it("spring_cache_stats répond sans réseau", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const { result } = await client.request("tools/call", { name: "spring_cache_stats", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Entries: 0 / 500");
  });
```

Passer les trois « 14 » des tests en « 15 » (`toHaveLength(15)`, titres « 15 tools »).

- [ ] **Step 2: Constater l'échec**

Run: `npm test`
Expected: FAIL (tool inconnu, longueurs 15 ≠ 14, landing/docker non synchronisés).

- [ ] **Step 3: Implémenter**

`src/tools/index.ts`, dernière entrée du tableau :

```ts
      {
        name: "spring_cache_stats",
        description: "Affiche les statistiques du cache du serveur (entrées, expirées, capacité) et permet de purger les entrées expirées ou tout le cache",
        inputSchema: {
          type: "object",
          properties: {
            purge: {
              type: "string",
              enum: ["none", "expired", "all"],
              description: "Purge à effectuer avant d'afficher les statistiques : aucune (lecture seule), entrées expirées, ou tout le cache",
              default: "none",
            },
          },
          required: [],
        },
      },
```

`src/index.ts` : ajouter le champ `private cache: CacheService;`, remplacer `const cache = new CacheService();` par `this.cache = new CacheService();` (et utiliser `this.cache` aux deux lignes suivantes), ajouter le `case` avant `default` :

```ts
          case "spring_cache_stats":
            result = this.handleCacheStats(args);
            break;
```

et la méthode :

```ts
  private handleCacheStats(args: any) {
    const { purge = "none" } = args;

    return {
      content: [
        {
          type: "text",
          text: this.cache.statsReport(purge),
        },
      ],
    };
  }
```

Docs : compteurs 14 → 15 dans les fichiers listés ; `docker/README.md` : ligne de tool `- \`spring_cache_stats\` - Cache statistics and optional purge` et titre « Advanced Tools (7 Tools) » ; `CLAUDE.md` : « Handles the 7 advanced tools (…, `spring_cache_stats`) » ; `docs/index.html` : copie du bloc `<div class="tool">` de `get_release_notes` pour `spring_cache_stats` (texte : « Show cache statistics (entries, expired, capacity) and optionally purge expired entries or the whole cache. »), badge `New`.

- [ ] **Step 4: Régénérer et vérifier**

Run: `npm run build && npm run docker:tools && npm test`
Expected: tous les tests PASS, `docker/tools.json` mis à jour (diff = le nouveau tool).

- [ ] **Step 5: Commit**

```bash
git add src tests docker README.md CLAUDE.md docs/index.html
git commit -m "feat: tool spring_cache_stats (stats et purge du cache) (#49)"
```
