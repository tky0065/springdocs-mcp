# Tool get_release_notes multi-projets Implementation Plan (#33)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le 13e tool `get_release_notes` : notes de release GitHub d'un projet du registre (version précise ou dernière stable), avec un filtre `focus`.

**Architecture:** Deux champs de registre (`githubRepo`, `githubTagPrefix`) ; une fonction pure `filterReleaseBody` ; une méthode `AdvancedFeaturesService.getReleaseNotes` qui appelle l'endpoint exact `releases/tags/<tag>` (ou `releases/latest`), met en cache la release brute et applique le filtre à la lecture ; schéma + handler + docs.

**Tech Stack:** TypeScript (Node16), vitest 3, API REST GitHub (non authentifiée).

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #33.

## Global Constraints

- **Tool** : nom `get_release_notes`. Paramètres : `project` (string, enum des 11 ids du registre dans l'ordre `boot, ai, framework, security, data-jpa, batch, integration, kafka, modulith, cloud-gateway, cloud-config`, défaut `boot`), `version` (string, `maxLength: 50`, optionnel), `focus` (string, enum `all, breaking-changes, new-features, deprecations`, défaut `all`). `required: []`. Descriptions du schéma en français, comme les tools voisins.
- **Registre** (valeurs relevées sur l'API GitHub réelle le 2026-10-02, tags réels : boot `v4.1.1`, ai `v2.0.1`, framework `v7.0.9`, security `7.1.1`, data-jpa `4.1.1`, batch `v6.0.5`, integration `v7.1.1`, kafka `v4.1.1`, modulith `2.1.1`, cloud-gateway `v5.0.3`, cloud-config `v5.0.5`) :
  `boot` → `spring-projects/spring-boot`, `'v'` ; `ai` → `spring-projects/spring-ai`, `'v'` ; `framework` → `spring-projects/spring-framework`, `'v'` ; `security` → `spring-projects/spring-security`, `''` ; `data-jpa` → `spring-projects/spring-data-jpa`, `''` ; `batch` → `spring-projects/spring-batch`, `'v'` ; `integration` → `spring-projects/spring-integration`, `'v'` ; `kafka` → `spring-projects/spring-kafka`, `'v'` ; `modulith` → `spring-projects/spring-modulith`, `''` ; `cloud-gateway` → `spring-cloud/spring-cloud-gateway`, `'v'` ; `cloud-config` → `spring-cloud/spring-cloud-config`, `'v'`. Champs **optionnels** dans l'interface (`githubRepo?: string; githubTagPrefix?: string`) pour ne pas casser les registres de test construits à la main.
- **URL** : `https://api.github.com/repos/<githubRepo>/releases/tags/<encodeURIComponent(prefix + version)>` ; sans version : `https://api.github.com/repos/<githubRepo>/releases/latest`. Les en-têtes de `fetchWithRetry` (Accept `text/html,…,*/*;q=0.8`) fonctionnent avec l'API GitHub (vérifié : 200 `application/json`) : ne PAS les modifier.
- **Version** : le `v` initial est ignoré (`v3.5.0` ≡ `3.5.0`) ; `latest`, vide ou absent = dernière version stable. Regex après retrait du `v` : `^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$` (accepte `4.2.0-M2`, `3.5.0-RC1`). Sinon `Error('Invalid version "<v>": expected a release version like "3.5.0" or "4.2.0-M2"')`, **avant** tout appel réseau.
- **Filtre `filterReleaseBody(body, focus)`** (pure, `src/services/release-notes.ts`, retourne une string, `''` si rien) : `all` → corps entier ; `new-features` → la section dont le titre (ligne `#…`) contient `new features` (insensible à la casse), jusqu'au titre suivant de niveau ≤ ; `breaking-changes` → les lignes non-titre correspondant à `/breaking|remov(e|ed|al)|incompatib|no longer|migrat/i` ; `deprecations` → les lignes non-titre correspondant à `/deprecat/i`. Corps `null`/`undefined`/vide → `''`.
- **Cache** : clé `release:${projectId}:${version||'latest'}` ; valeur = release brute `{ tag, name, publishedAt, url, prerelease, body }` ; `setLongTerm` pour une version précise, `set` (TTL par défaut 30 min) pour « latest » ; **jamais** de cache d'échec ; le filtre `focus` s'applique à la lecture (donc `focus` n'entre pas dans la clé).
- **Erreurs propagées** (throw, pas de texte de succès) : 404 → `Release not found: <displayName> <version> (tag "<tag>"). See https://github.com/<repo>/releases` (sans version : `No release found for <displayName>`) ; 403 ou 429 → `GitHub API rate limit reached (60 requests/hour without authentication). Try again later.` ; autre statut non-ok → `Failed to fetch release data: <status>` ; projet inconnu → l'erreur existante du registre ; projet sans `githubRepo` → `Release notes are not available for <displayName>`.
- **Sortie** (string markdown) : `# <displayName> <name ou tag>` ; `**Released:** <YYYY-MM-DD>` (UTC, `published_at.slice(0, 10)`, `unknown` si absent) ; `**Pre-release:** yes` seulement si `prerelease` ; `**Release notes:** <html_url>` ; `**Focus:** <focus>` ; puis le contenu filtré borné par `extractContent(filtered, 'full').content` ; si le filtre ne renvoie rien : `No <focus label> entries found in these release notes. See the full notes: <html_url>`. Corps `null` géré (pas d'exception).
- `compare_spring_versions` n'est PAS modifié. Imports `.js`, commentaires en anglais, pas d'attribution Claude dans les commits. `docker/tools.json` régénéré (`npm run build && npm run docker:tools`).
- **Compteur de tools : 12 → 13** dans `tests/stdio.test.ts` (titre + `toHaveLength`), `tests/validation.test.ts` (titre du test de validation : ajouter `get_release_notes` à la liste vérifiée si le test l'énumère), `test-docker.sh` (messages et attente), `test-enhanced.sh` (commentaire d'en-tête), `CLAUDE.md` (« 12 tools » ×2 ; services : les outils avancés passent de 5 à 6), `DOCKER.md` (4 occurrences). `CHANGELOG.md` historique inchangé. Ajouter `get_release_notes` à la liste des tools du `README.md` si une telle liste existe (grep `compare_spring_versions`), sans réécrire le reste.

## Review Focus

- URL exacte appelée pour chaque projet : `boot` + `3.5.0` → `…/spring-projects/spring-boot/releases/tags/v3.5.0` ; `security` + `v6.5.0` → `…/spring-security/releases/tags/6.5.0` ; sans version → `…/releases/latest`.
- Deux appels avec des `focus` différents sur la même version → **un seul** `fetch`.
- 404 / 403 / 429 rejettent et ne sont pas mis en cache (un nouvel appel refait un `fetch`).
- Corps de release `null` : pas d'exception.
- Versions invalides (`../x`, `3.5`, `3.5.0/../x`, `v`, `3.5.0 `) rejetées sans appel réseau.
- Le tool passe la validation (`validateToolArguments("get_release_notes", {})` fonctionne avec les défauts) et `tools/list` renvoie 13 tools.

---

### Task 1: registre (`githubRepo`, `githubTagPrefix`) et `filterReleaseBody`

**Files:**
- Modify: `src/services/spring-projects-config.ts`
- Create: `src/services/release-notes.ts`
- Test: `tests/release-notes-filter.test.ts` (nouveau), `tests/registry.test.ts` (ajouter un test paramétré des 11 couples repo/préfixe)

**Interfaces:**
- Produces: `SpringProjectConfig.githubRepo?: string`, `SpringProjectConfig.githubTagPrefix?: string` ; `export type ReleaseFocus = 'all' | 'breaking-changes' | 'new-features' | 'deprecations'` et `export function filterReleaseBody(body: string | null | undefined, focus: ReleaseFocus): string` dans `src/services/release-notes.ts` ; `export function normalizeReleaseVersion(version?: string): string | undefined` dans le même fichier (retire le `v`, `undefined` pour absent/vide/`latest`, lève sur format invalide selon la regex ci-dessus).

- [ ] **Step 1: Écrire les tests qui échouent.** `tests/release-notes-filter.test.ts` avec un corps de release réaliste :

```ts
const BODY = [
  "## :star: New Features",
  "",
  "* Add support for virtual threads in the web server #12345",
  "* Improve startup time #12346",
  "",
  "## :lady_beetle: Bug Fixes",
  "",
  "* Fix NPE in actuator endpoint #12347",
  "* Remove deprecated `server.foo` property #12348",
  "* Deprecate `spring.bar.enabled` in favor of `spring.bar.mode` #12349",
  "* Binding is no longer case sensitive #12350",
  "",
  "## :hammer: Dependency Upgrades",
  "",
  "* Upgrade to Jackson 2.19 #12351",
].join("\n");
```

Cas : `all` rend `BODY` tel quel ; `new-features` contient les deux items « virtual threads » et « startup time » et **aucun** item de Bug Fixes ni de Dependency Upgrades, ni le titre suivant ; `breaking-changes` contient « Remove deprecated », « no longer case sensitive » (et pas « Fix NPE ») ; `deprecations` contient « Remove deprecated » et « Deprecate `spring.bar.enabled` » (et pas « virtual threads ») ; les lignes de titre ne sont jamais renvoyées par `breaking-changes`/`deprecations` ; un corps sans « New Features » → `''` pour `new-features` ; `null`/`undefined`/`''` → `''` pour tous les focus ; `normalizeReleaseVersion` : `"v3.5.0"`→`"3.5.0"`, `"3.5.0"`→`"3.5.0"`, `"4.2.0-M2"`→`"4.2.0-M2"`, `"3.5.0-RC1"`→`"3.5.0-RC1"`, `"latest"`/`""`/`undefined`→`undefined`, et `it.each(["../x","3.5","3.5.0/../x","v"," 3.5.0","3.5.0 ","3.5.0\n","3.x.0","3.5.0-","%2e%2e"])` → `toThrow(/Invalid version/)`. `tests/registry.test.ts` : `it.each` sur les 11 couples `[id, githubRepo, githubTagPrefix]` de la section Global Constraints.

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/release-notes-filter.test.ts tests/registry.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** : champs de registre sur les 11 entrées (commentaire de l'interface : « GitHub repository (owner/name) hosting the releases » et « Prefix of the release tag, e.g. "v" for v3.5.0 »), et `src/services/release-notes.ts`.

- [ ] **Step 4: Vérifier** : `npm test` → tout vert.

- [ ] **Step 5: Commit** : `git add src tests && git commit -m "feat: repo GitHub et préfixe de tag dans le registre, filtre des notes de release"`

### Task 2: service, schéma, handler, docs

**Files:**
- Modify: `src/services/advanced-features.ts` (méthode `getReleaseNotes`, constructeur `(cache = new CacheService(), projectsConfig = springProjectsConfig)`), `src/tools/index.ts`, `src/index.ts` (cas `get_release_notes` + `handleGetReleaseNotes`), `docker/tools.json` (régénéré), `tests/stdio.test.ts`, `tests/validation.test.ts`, `test-docker.sh`, `test-enhanced.sh`, `CLAUDE.md`, `DOCKER.md`, `README.md` (liste de tools si présente)
- Test: `tests/release-notes.test.ts` (nouveau)

**Interfaces:**
- Consumes: Task 1 (`filterReleaseBody`, `normalizeReleaseVersion`, champs de registre), `extractContent` (`markdown.ts`), `fetchWithRetry` (via le délégué privé existant du service).
- Produces: `AdvancedFeaturesService.getReleaseNotes(project: string, version?: string, focus: ReleaseFocus = 'all'): Promise<string>`.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/release-notes.test.ts` (gabarit : `tests/error-propagation.test.ts` — mock `node-fetch`, `fakeResponse`, `AdvancedFeaturesService`). Cas, avec un JSON de release `{ tag_name: "v3.5.0", name: "v3.5.0", published_at: "2025-05-22T10:00:00Z", html_url: "https://github.com/spring-projects/spring-boot/releases/tag/v3.5.0", prerelease: false, body: BODY }` (réutiliser le corps du test du filtre, copié) :
  1. `boot` + `3.5.0` → `fetch` appelé avec l'URL exacte `https://api.github.com/repos/spring-projects/spring-boot/releases/tags/v3.5.0` ; la sortie contient `# Spring Boot v3.5.0`, `**Released:** 2025-05-22`, le lien `html_url`, `**Focus:** all` et le corps ;
  2. `security` + `v6.5.0` → URL `…/spring-projects/spring-security/releases/tags/6.5.0` ;
  3. sans version → URL `…/releases/latest` ;
  4. `breaking-changes` sur le corps de test → contient « no longer case sensitive », pas « virtual threads » ; `focus: new-features` → contient « virtual threads » ;
  5. deux appels `focus` différents, même version → `fetch` appelé **une seule fois** ;
  6. 404 → rejet `Release not found: Spring Boot 9.9.9` ; 403 → rejet `rate limit` ; 429 (avec fake timers et `settle` si nécessaire, cf. `tests/fetch-retry.test.ts`) → rejet `rate limit` ; 500 → rejet `Failed to fetch release data` ; après un échec, un nouvel appel refait un `fetch` (pas de cache d'échec) ;
  7. `body: null` → pas d'exception, sortie valide ; `focus: breaking-changes` sans correspondance → contient `No breaking-changes entries found` et l'URL de la release ;
  8. `prerelease: true` → la sortie contient `**Pre-release:** yes` ;
  9. versions invalides (`../x`, `3.5`) → rejet `Invalid version` et `fetch` jamais appelé ; projet inconnu → rejet `Unknown Spring project` ;
  10. un registre de test où le projet n'a pas de `githubRepo` → rejet `Release notes are not available` ;
  11. `validateToolArguments("get_release_notes", {})` renvoie `{ project: "boot", focus: "all" }` si les défauts sont appliqués par la validation, sinon `{}` (vérifier le comportement existant de `src/validation.ts` et adapter l'assertion : le but est que `{}` soit accepté et qu'un `project` hors enum soit refusé) ;
  12. **stdio** : `tools/list` renvoie 13 tools et contient `get_release_notes` (mettre à jour `tests/stdio.test.ts`).

- [ ] **Step 2: Vérifier l'échec** : `npm run build && npx vitest run tests/release-notes.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** selon les Global Constraints : méthode `getReleaseNotes`, schéma (`get_release_notes`, description française du type « Récupère les notes de release GitHub d'un projet Spring (version précise ou dernière), avec filtre sur les changements majeurs, nouveautés ou dépréciations »), cas du `switch` et `handleGetReleaseNotes` dans `src/index.ts` (lire `project = "boot"`, `version`, `focus = "all"` des args validés), injection du `projectsConfig` dans `AdvancedFeaturesService` (valeur par défaut = `springProjectsConfig`, `src/index.ts` peut continuer à appeler `new AdvancedFeaturesService(cache)`). Mettre à jour les compteurs et docs listés. Régénérer `docker/tools.json`.

- [ ] **Step 4: Vérifier** : `npm run build && npm run docker:tools && npm test` → tout vert (dont `docker-tools.test.ts`, `stdio.test.ts`, `validation.test.ts`). Vérifier `grep -rnI "12 tools" . --exclude-dir=node_modules --exclude-dir=build --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=docs` : seules les occurrences historiques de `CHANGELOG.md` et `IMPROVE.md` peuvent rester.

- [ ] **Step 5: Commit** : `git add src tests docker CLAUDE.md DOCKER.md README.md test-docker.sh test-enhanced.sh && git commit -m "feat: ajouter le tool get_release_notes (notes de release GitHub multi-projets avec filtre focus)"`

### Task 3: backlog

- [ ] Après vérification réelle de `npm test`, cocher #33 dans `IMPROVE.md` (` — Fait le 2026-10-02`, avec : 13e tool ; filtre par mots-clés = limite assumée, le vrai guide de migration = #35 ; pas de `GITHUB_TOKEN` : limite 60 req/h non authentifiée, mise en cache).
