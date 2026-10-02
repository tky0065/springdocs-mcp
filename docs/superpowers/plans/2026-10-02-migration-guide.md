# Tool get_migration_guide (Spring Boot) Implementation Plan (#35)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le 14e tool `get_migration_guide` : guide de migration ou release notes d'upgrade de Spring Boot pour une version cible, lus dans le wiki GitHub, avec filtre `section` et pagination `offset`.

**Architecture:** Module pur `src/services/boot-wiki.ts` (URL de page, extraction HTML → markdown avec contrôle du `<title>`, sélection de sections) + méthode `SpringBootDocsServiceOptimized.getMigrationGuide` (cache `{markdown, url, title}`, `pageMarkdown` de #24) + schéma, handler, docs.

**Tech Stack:** TypeScript (Node16), cheerio, turndown, vitest 3.

**Spec:** design approuvé dans le chat (bounded, périmètre Boot seul). Backlog : `IMPROVE.md` #35.

## Global Constraints

- **Faits vérifiés par sonde réseau le 2026-10-02** : pages wiki existantes `Spring-Boot-<x.y>-Migration-Guide` pour `2.0`, `3.0`, `4.0` ; `Spring-Boot-<x.y>-Release-Notes` pour toutes les mineures `2.0` à `4.2` ; pas de guide 1.5/5.0 ni de « 2.7 Migration Guide ». URL : `https://github.com/spring-projects/spring-boot/wiki/<Page>`. **Une page absente répond par un 302 vers l'accueil du wiki, suivi par node-fetch : 200 avec le contenu de l'accueil** (`<title>` = `Home · spring-projects/spring-boot Wiki · GitHub`). Le wiki Boot n'est PAS servi en raw (404). Une page fait ~1 Mo de HTML (plafond de 5 MiB OK).
- **Détection de page absente par le `<title>`** : le titre de la page (texte avant ` · spring-projects`) doit être **exactement** `Spring Boot <x.y> Migration Guide` / `Spring Boot <x.y> Release Notes`. Sinon → `Error('Spring Boot wiki page not found: <PageName> (<url>)')`, rien en cache.
- **Extraction** : cheerio, sélecteur `#wiki-body .markdown-body` (premier) ; avant conversion, retirer `a.anchor`, `svg`, `.octicon` et tout lien d'ancre vide pour qu'aucun `[](#…)` ne subsiste ; conversion avec le `turndownService` partagé (`markdown.ts`). Contenu introuvable → `Error('Unable to extract content from <url>')`.
- **Paramètres du tool** `get_migration_guide` : `version` (string, `maxLength: 20`, **requis**), `document` (string, enum `auto, migration-guide, release-notes`, défaut `auto`), `section` (string, `maxLength: 50`, optionnel), `offset` (number, `minimum: 0`, `maximum: 10000000`, défaut 0). `required: ["version"]`. Descriptions en français, comme les tools voisins.
- **Version** : `normalizeVersion` de `src/services/url.ts` (existant, #34) : `3.4.2` → `3.4`. Si le résultat est `undefined` (`current`, vide) → `Error('A target Spring Boot version is required (e.g. "3.0", "3.4" or "4.0")')`. Format invalide → l'erreur `Invalid version …` existante. Validé **avant** tout appel réseau.
- **`document: auto`** : `migration-guide` si la mineure normalisée finit par `.0`, sinon `release-notes`. `migration-guide` / `release-notes` forcent le type. Page absente avec `auto` sur `x.0` → même erreur `page not found` (le message peut suggérer `document: "release-notes"`).
- **`section`** : sélectionne tous les titres markdown (lignes `#…` hors blocs de code ```) dont le texte contient le mot-clé (insensible à la casse), chacun avec ses sous-sections jusqu'au titre suivant de niveau ≤ ; les correspondances imbriquées dans une plage déjà retenue sont ignorées ; plages jointes par `\n\n`. Aucune correspondance → `Error('No section matching "<section>" in <title>. Available sections: <titres séparés par ", ">')` (titres sans les `#`, 80 maximum puis `…`).
- **Cache** : clé `migration:${document}:${normalizedVersion}` avec `document` **résolu** (`migration-guide` ou `release-notes`, jamais `auto`) ; valeur `{ markdown, url, title }` ; `setLongTerm` ; `section` et `offset` appliqués à la lecture (aucun nouveau `fetch`) ; jamais de cache d'échec.
- **Sortie** : via le helper `formatPage` de `springboot-docs-optimized.ts` (#24) : titre `<title>` (+ ` (section: <section>)` si filtre), contenu paginé (`PAGE_SIZE` 4000), pied `Partie X–Y sur Z caractères. Pour la suite, rappeler avec offset=N.`, lien final `For the complete page, visit: <url>`. `offset` ≥ total : message `No content at offset …` existant.
- Erreurs réseau : `!response.ok` → `Failed to fetch Spring Boot wiki page: <status>` (propagée, non cachée). Aucun nouveau paramètre `project` (YAGNI).
- Imports `.js`, commentaires en anglais, pas d'attribution Claude dans les commits. `docker/tools.json` régénéré (`npm run build && npm run docker:tools`).
- **Compteur de tools : 13 → 14** dans `tests/stdio.test.ts` (titre + `toHaveLength` + présence de `get_migration_guide`), `tests/validation.test.ts` (titre et liste), `test-docker.sh`, `test-enhanced.sh`, `CLAUDE.md` (total ×2 ; outils **core** 7 → 8, la phrase sur les services), `DOCKER.md`, `README.md` (en-tête, ligne de tableau, description), `docker/server.yaml`, `docker/README.md`. `CHANGELOG.md` et `docs/index.html` NON modifiés.

## Review Focus

- Une page absente (HTML dont le titre est `Home`) est rejetée sans mise en cache, et le contenu de l'accueil n'est jamais renvoyé comme guide.
- `auto` : `3.0` → Migration Guide, `3.4` → Release Notes ; `document` explicite prioritaire.
- Aucune ancre `[](#…)` ni `<svg>` dans le markdown ; les titres sont lisibles (`## Jakarta EE`).
- `section: "jakarta"` ne renvoie que la section « Jakarta EE » et ses sous-sections ; un mot-clé inconnu liste les titres disponibles.
- Deux appels avec `section`/`offset` différents → **un seul** `fetch`.
- Versions invalides (`../x`, `3`, `3.x`, `v3.0`, ` 3.0`) rejetées sans réseau.
- `# commentaire` dans un bloc de code n'est pas pris pour un titre (suivi des fences).

---

### Task 1: module pur `boot-wiki.ts`

**Files:**
- Create: `src/services/boot-wiki.ts`, `tests/fixtures/boot-wiki-migration-guide.html`, `tests/fixtures/boot-wiki-home.html`
- Test: `tests/boot-wiki.test.ts` (nouveau)

**Interfaces:**
- Produces:

```ts
export type WikiDocument = 'migration-guide' | 'release-notes';
export function resolveWikiDocument(version: string, document: 'auto' | WikiDocument): WikiDocument; // version déjà normalisée "x.y"
export function wikiPageName(version: string, document: WikiDocument): string;   // "Spring-Boot-3.0-Migration-Guide"
export function wikiPageUrl(pageName: string): string;                              // https://github.com/spring-projects/spring-boot/wiki/<pageName>
export function expectedWikiTitle(version: string, document: WikiDocument): string; // "Spring Boot 3.0 Migration Guide"
export function extractWikiMarkdown(html: string, expectedTitle: string, url: string): { markdown: string; title: string };
export function selectSections(markdown: string, keyword: string, title: string): string;
```

- [ ] **Step 1: Préparer les fixtures** (lecture réseau autorisée, une fois) : télécharger `https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide` dans le dossier scratchpad, **observer** la structure réelle (balises de titres, ancres, `#wiki-body`, `.markdown-body`), puis écrire une fixture RÉDUITE `tests/fixtures/boot-wiki-migration-guide.html` (≤ 6 Ko) qui en reproduit fidèlement la structure : `<title>Spring Boot 3.0 Migration Guide · spring-projects/spring-boot Wiki · GitHub</title>`, une barre de navigation parasite avant `#wiki-body`, `<div id="wiki-body"><div class="markdown-body">` contenant un `<h1>`, des `<h2>`/`<h3>` avec leur ancre GitHub (`a.anchor` + `svg`) comme sur la vraie page, au moins les sections `Before You Start`, `Upgrade to Spring Boot 3` > `Jakarta EE` (avec une liste et un sous-titre `Jakarta EE Servlet`), `Web Application Changes`, un bloc `<pre><code>` contenant une ligne `# commentaire` et du texte parasite après `.markdown-body` (« Wiki pages », « Uh oh! »). Écrire `tests/fixtures/boot-wiki-home.html` : même chrome avec `<title>Home · spring-projects/spring-boot Wiki · GitHub</title>` et un `#wiki-body .markdown-body` d'accueil.

- [ ] **Step 2: Écrire les tests qui échouent** `tests/boot-wiki.test.ts` : `resolveWikiDocument` (`("3.0","auto")`→`migration-guide`, `("3.4","auto")`→`release-notes`, `("4.0","auto")`→`migration-guide`, forcés prioritaires) ; `wikiPageName`/`expectedWikiTitle`/`wikiPageUrl` pour les deux types ; `extractWikiMarkdown(fixture, "Spring Boot 3.0 Migration Guide", url)` → `title` correct, markdown contenant `## Before You Start` et `### Jakarta EE`, **sans** `](#`, sans `<svg`, sans « Uh oh! », sans la navigation ; avec la fixture d'accueil → `toThrow(/page not found/)` ; HTML sans `#wiki-body` → `toThrow(/Unable to extract content/)` ; `selectSections` : `"jakarta"` renvoie la section « Jakarta EE » **et** `Jakarta EE Servlet` mais pas `Web Application Changes` ; mot-clé en majuscules ; deux correspondances disjointes jointes par une ligne vide ; correspondance imbriquée non dupliquée ; `# commentaire` dans un bloc de code non traité comme titre et section contenant ce bloc rendue entière ; aucune correspondance → `toThrow(/No section matching "zzz".*Available sections: .*Jakarta EE/)`.

- [ ] **Step 3: Vérifier l'échec** : `npx vitest run tests/boot-wiki.test.ts` → FAIL.

- [ ] **Step 4: Implémenter** `src/services/boot-wiki.ts` selon les Global Constraints (cheerio + `turndownService` de `./markdown.js`).

- [ ] **Step 5: Vérifier** : `npm test` → tout vert.

- [ ] **Step 6: Commit** : `git add src tests && git commit -m "feat: lecture des pages du wiki Spring Boot (titre vérifié, sections filtrables)"`

### Task 2: service, schéma, handler, docs

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts` (méthode `getMigrationGuide`), `src/tools/index.ts`, `src/index.ts`, `docker/tools.json` (régénéré), et les fichiers de compteur listés dans les Global Constraints
- Test: `tests/migration-guide.test.ts` (nouveau)

**Interfaces:**
- Consumes: Task 1 (`resolveWikiDocument`, `wikiPageName`, `wikiPageUrl`, `expectedWikiTitle`, `extractWikiMarkdown`, `selectSections`), `normalizeVersion` (url.ts), `formatPage` et le cache `{markdown, url}` de #24.
- Produces: `SpringBootDocsServiceOptimized.getMigrationGuide(version: string, document: 'auto' | WikiDocument = 'auto', section?: string, offset = 0): Promise<string>`.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/migration-guide.test.ts` (gabarit : `tests/pagination.test.ts` et `tests/reference-version.test.ts` ; mock `node-fetch`, `fakeResponse` ; réutiliser les fixtures de la Task 1 via `fixture()` de `tests/helpers.ts`) :
  1. `getMigrationGuide("3.0")` → `fetch` appelé avec `https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide` ; sortie contenant le titre, `## Before You Start`, le lien `https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide` ;
  2. `("3.4")` → `…/Spring-Boot-3.4-Release-Notes` (réponse = la fixture avec son `<title>` remplacé par `Spring Boot 3.4 Release Notes · spring-projects/spring-boot Wiki · GitHub`) ; `("3.4.2")` ≡ `("3.4")` ; `("3.4","migration-guide")` → `…/Spring-Boot-3.4-Migration-Guide` ;
  3. réponse = fixture d'accueil (page absente) → rejet `page not found` ; un nouvel appel refait un `fetch` (rien en cache) ;
  4. `section: "jakarta"` → contient `Jakarta EE`, ne contient pas `Web Application Changes` ; section inconnue → rejet avec la liste des titres ;
  5. deux appels (`section: "jakarta"` puis sans section, puis avec `offset`) sur la même version → **un seul** `fetch` ;
  6. pagination : une fixture dont le markdown dépasse 4000 caractères (générer en répétant des paragraphes dans la fixture à l'exécution) → pied `Partie 0–` et `offset=` ; page suivante sans `fetch` ;
  7. versions invalides (`../x`, `3`, `3.x`, `v3.0`, ` 3.0`) et `current`/vide → rejet sans `fetch` ;
  8. `fetch` en 404 puis en 500 → rejet `Failed to fetch Spring Boot wiki page`, non caché ;
  9. validation du tool : `validateToolArguments("get_migration_guide", {})` rejette (version requise) ; `{ version: "3.0" }` accepté ; `document` hors enum refusé ; `section` de 51 caractères refusée ;
  10. **stdio** : `tools/list` renvoie 14 tools et contient `get_migration_guide` ; un appel avec `version: "../x"` renvoie `isError` + `Invalid version` sans réseau.

- [ ] **Step 2: Vérifier l'échec** : `npm run build && npx vitest run tests/migration-guide.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** : `getMigrationGuide` (version normalisée et document résolu AVANT cache/réseau ; cache, `fetchWithRetry`, `extractWikiMarkdown`, `selectSections`, `formatPage`), schéma (description : « Récupère le guide de migration ou les notes de version d'upgrade de Spring Boot pour une version cible, avec filtre par section (ex: jakarta) »), cas du `switch` + `handleGetMigrationGuide` (lire `version`, `document = "auto"`, `section`, `offset = 0` des args validés), régénérer `docker/tools.json`, mettre à jour les compteurs et docs.

- [ ] **Step 4: Vérifier** : `npm run build && npm run docker:tools && npm test` → tout vert (dont `docker-tools.test.ts`, `stdio.test.ts`, `validation.test.ts`). Contrôle : `grep -rnI "13 tools\|13 powerful\|13 Powerful\|All 13" . --exclude-dir=node_modules --exclude-dir=build --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=docs` ne doit plus rien renvoyer en dehors de `CHANGELOG.md` et `IMPROVE.md`.

- [ ] **Step 5: Commit** : `git add src tests docker CLAUDE.md DOCKER.md README.md test-docker.sh test-enhanced.sh && git commit -m "feat: ajouter le tool get_migration_guide (guides de migration et notes d'upgrade Spring Boot)"`

### Task 3: backlog

- [ ] Après vérification réelle de `npm test`, cocher #35 dans `IMPROVE.md` (` — Fait le 2026-10-02`, avec : Boot seul ; piège « page absente = accueil du wiki » traité par contrôle du `<title>` ; Framework/Batch/Security/AI = candidats backlog ; `docs/index.html` toujours sur 12).
