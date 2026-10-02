# P2 Easy (bugs & sécu) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger IMPROVE.md #14, #15, #19, #20, #23.

**Architecture:** Un petit module `src/services/url.ts` (helpers purs `absoluteSpringUrl`, `assertSafeSegment`) utilisé par les deux services ; les autres correctifs sont locaux. TDD avec vitest (fetch mocké, aucun réseau).

**Tech Stack:** TypeScript (Node16/ES2022), vitest 3, node-fetch mocké, cheerio.

**Spec:** design validé dans la conversation du 2026-10-02 (pas de fichier de spec, chemin « bounded »).

## Global Constraints

- Node 18+ ; imports relatifs avec extension `.js`.
- Logs sur stderr uniquement (`console.error`), jamais stdout.
- Pas de ligne d'attribution Claude dans les commits (CLAUDE.md global).
- Hors périmètre : `subsection` ignoré (#16), `searchDocumentation(searchQuery, 3)` dans `diagnoseIssues` (candidat backlog).

## Review Focus

- `link` vide / `undefined` / `//cdn…` / sans `/` initial → jamais `spring.ioundefined`.
- `projectName` avec `../x`, `a?b`, `a#b`, `a/b` → erreur, aucun fetch émis.
- `docType` inconnu (`api`) → erreur explicite, pas `[]`.
- Deux diagnostics au même début de message mais `component`/`stackTrace` différents → pas de collision de cache.

---

### Task 1: #20 undici (indépendant, parallélisable)

**Files:** Modify `package-lock.json` (et `package.json` si nécessaire)

- [ ] `npm update undici` puis `npm ls undici` : version > 7.14.0.
- [ ] `npm audit` : plus d'alerte `undici` ; `npm test` vert.
- [ ] Commit : `fix: mettre à jour undici (alertes npm audit)`

### Task 2: helpers `url.ts` (#15, #19)

**Files:** Create `src/services/url.ts`, `tests/url.test.ts`

**Produces:** `absoluteSpringUrl(link: string | undefined): string | undefined`, `assertSafeSegment(value: string, label: string): string`

- [ ] **Test (échoue)** :

```ts
import { describe, expect, it } from "vitest";
import { absoluteSpringUrl, assertSafeSegment } from "../src/services/url.js";

describe("absoluteSpringUrl", () => {
  it("ignore les liens vides", () => {
    expect(absoluteSpringUrl(undefined)).toBeUndefined();
    expect(absoluteSpringUrl("  ")).toBeUndefined();
  });
  it("garde les URL absolues, préfixe et normalise les relatives", () => {
    expect(absoluteSpringUrl("https://x.io/a")).toBe("https://x.io/a");
    expect(absoluteSpringUrl("/projects/spring-boot")).toBe("https://spring.io/projects/spring-boot");
    expect(absoluteSpringUrl("projects/spring-boot")).toBe("https://spring.io/projects/spring-boot");
  });
});

describe("assertSafeSegment", () => {
  it("accepte les segments simples", () => {
    expect(assertSafeSegment("spring-boot", "projet")).toBe("spring-boot");
  });
  it.each(["../x", "a/b", "a?b", "a#b", "", "a b%2f"])("rejette %j", (v) => {
    expect(() => assertSafeSegment(v, "projet")).toThrow(/projet/);
  });
});
```

- [ ] Run `npx vitest run tests/url.test.ts` → FAIL (module absent).
- [ ] **Implémenter** :

```ts
const SAFE_SEGMENT = /^[\w.-]+$/;

export function absoluteSpringUrl(link: string | undefined): string | undefined {
  const trimmed = link?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://spring.io/${trimmed.replace(/^\/+/, '')}`;
}

export function assertSafeSegment(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`Invalid ${label}: "${value}" (allowed: letters, digits, ".", "_", "-")`);
  }
  return encodeURIComponent(value);
}
```

- [ ] Run → PASS. Commit : `feat: helpers d'URL sûrs (absoluteSpringUrl, assertSafeSegment)`

### Task 3: #15 utiliser `absoluteSpringUrl`

**Files:** Modify `src/services/springboot-docs-optimized.ts:147,241`, `src/services/advanced-features.ts:385,420`, `tests/url-usage.test.ts`

- [ ] **Test (échoue)** : mock fetch renvoyant une page avec une carte projet/guide sans `<a href>` et une avec `href="/projects/x"` ; `searchSpringProjects("x")` ne contient aucune URL `ioundefined`, l'entrée sans lien est absente, l'autre vaut `https://spring.io/projects/x`. Même cas pour `getAllSpringGuides` et les deux méthodes de `advanced-features.ts` (fixtures inline, selon le pattern de `tests/error-propagation.test.ts`).
- [ ] Run → FAIL.
- [ ] Remplacer chaque `link?.startsWith('http') ? link : \`https://spring.io${link}\`` par `const url = absoluteSpringUrl(link); if (!url) return;` (dans le callback `.each`, `return;` saute l'entrée) ; importer depuis `./url.js`.
- [ ] Run → PASS. Commit : `fix: ignorer les entrées sans lien au lieu de produire spring.ioundefined`

### Task 4: #19 valider projectName / section / subsection

**Files:** Modify `src/services/springboot-docs-optimized.ts:164-197,319-362`, `tests/url-safety.test.ts`

- [ ] **Test (échoue)** : pour `getSpringProject` avec `"../x"`, `"a?b"`, `"a/b"` → rejet et `mockedFetch` jamais appelé. Idem `getSpringReference("boot", "../x")` et `("boot", "intro", "a#b")`. `getSpringProject("Spring Boot")` reste accepté (espaces → `-` conservé).
- [ ] Run → FAIL.
- [ ] Dans `getSpringProject` : `const slug = assertSafeSegment(projectName.toLowerCase().replace(/\s+/g, '-'), 'project name')` avant tout fetch, utilisé aux deux sites (`:174`, `:191`). Dans `getSpringReference` : `assertSafeSegment(section, 'section')` et, si présent, `assertSafeSegment(subsection, 'subsection')` au début, avant la clé de cache. Les erreurs sont propagées (comportement #9).
- [ ] Run → PASS. Commit : `fix: valider et encoder projectName, section et subsection avant de les mettre dans l'URL`

### Task 5: #14 aligner `docType`

**Files:** Modify `src/tools/index.ts:20`, `src/services/springboot-docs-optimized.ts:464-490`, `tests/doctype.test.ts`

- [ ] **Test (échoue)** : `searchSpringDocs("x", "api", 5)` rejette avec un message contenant `docType` et la liste des valeurs ; `"projects"` fonctionne ; le schéma du tool `search_spring_docs` a `enum` = `["guides","reference","projects","all"]`.
- [ ] Run → FAIL.
- [ ] Enum → `["guides", "reference", "projects", "all"]`. Au début de `searchSpringDocs` : si `docType` ∉ cette liste → `throw new Error(\`Invalid docType "${docType}". Allowed: guides, reference, projects, all\`)`.
- [ ] Mettre à jour `docker/tools.json` si `npm run` du script de génération existe pour ce tool (sinon éditer l'enum à la main) ; run → PASS. Commit : `fix: aligner l'enum docType sur les sources réellement recherchées`

### Task 6: #23 clé de cache de diagnostic

**Files:** Modify `src/services/advanced-features.ts:319`, `tests/diagnosis-cache.test.ts`

- [ ] **Test (échoue)** : deux appels `diagnoseIssues("Same long error message ...>50 chars", "web")` puis `(…, "data")` → le second résultat contient `**Component:** data` (pas servi depuis le cache du premier).
- [ ] Run → FAIL.
- [ ] `import { createHash } from 'node:crypto'` ; `const digest = createHash('sha256').update(JSON.stringify([errorMessage, component ?? '', stackTrace ?? ''])).digest('hex'); const cacheKey = \`diagnosis:${digest}\`;`
- [ ] Run → PASS. Commit : `fix: clé de cache de diagnose_spring_issues complète et hachée`

### Task 7: Vérification finale

- [ ] `npm run build && npm test` : tout vert (lire la sortie réelle) ; `npm audit` relu.
- [ ] Cocher #14, #15, #19, #20, #23 dans IMPROVE.md (`- [x]` + ` — Fait le 2026-10-02`), ajouter l'écart `diagnoseIssues`/`searchDocumentation(…, 3)` aux candidats backlog.
