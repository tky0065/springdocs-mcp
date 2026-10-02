# Paramètre `version` pour get_spring_reference Implementation Plan (#34)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre `get_spring_reference` sur une version précise de la doc (`version: "3.4"`), pour les 11 projets du registre.

**Architecture:** Un champ de config `versionInsertAfter` (préfixe de l'URL courante après lequel on insère `<version>/`) + `buildReferenceUrl(..., version?)` + `normalizeVersion` (validation stricte avant tout appel réseau). Le service passe la version à l'URL, à la clé de cache et au message d'erreur 404.

**Tech Stack:** TypeScript (Node16), vitest 3.

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #34.

## Global Constraints

- Périmètre : **`get_spring_reference` uniquement**. Ne PAS toucher aux `/docs/current/` des recherches (`searchSpringDocs`, `searchConcepts`, `getAllSpringGuides`…) ni à `advanced-features.ts`.
- Formats acceptés : `major.minor` (`3.4`) ou `major.minor.patch` (`3.4.2`, le patch est ignoré → `3.4`). `current`, chaîne vide ou absent = doc courante (URL strictement identique à aujourd'hui). Regex : `^\d+\.\d+(\.\d+)?$`. Tout autre format → `Error('Invalid version "<v>": expected a version like "3.4" or "3.4.2", or "current"')`, **avant** tout appel réseau.
- Un projet sans `versionInsertAfter` ou avec `hasVersionedDocs: false` + version demandée → `Error('Project "<id>" does not support versioned documentation')`. Après cette tâche aucun des 11 projets n'est dans ce cas ; `ai` passe à `hasVersionedDocs: true` (vérifié : `…/spring-ai/reference/1.1/api/chatclient.html` répond 200).
- Valeurs de `versionInsertAfter` (préfixe de l'URL courante, **doit** être un préfixe de `buildReferenceUrl` sans version) : `boot` → `https://docs.spring.io/spring-boot/` ; `ai` → `https://docs.spring.io/spring-ai/reference/` ; `framework` → `https://docs.spring.io/spring-framework/reference/` ; `security` → `https://docs.spring.io/spring-security/reference/` ; `data-jpa` → `https://docs.spring.io/spring-data/jpa/reference/` ; `batch` → `https://docs.spring.io/spring-batch/reference/` ; `integration` → `https://docs.spring.io/spring-integration/reference/` ; `kafka` → `https://docs.spring.io/spring-kafka/reference/` ; `modulith` → `https://docs.spring.io/spring-modulith/reference/` ; `cloud-gateway` → `https://docs.spring.io/spring-cloud-gateway/reference/` ; `cloud-config` → `https://docs.spring.io/spring-cloud-config/reference/`.
- Paramètre de tool : `version`, `type: "string"`, `maxLength: 20`, sans enum ni default, sur `get_spring_reference` seulement.
- Clé de cache : inchangée sans version ; avec version `reference:${projectId}:${section}:${subsection||'main'}:v${normalizedVersion}`.
- 404 avec version donnée → `Reference not found for <displayName> version <normalizedVersion> (this version may not be published at the current documentation site; omit 'version' for the latest or try a more recent one)`. 404 sans version : message actuel inchangé.
- Signatures : `buildReferenceUrl(projectId, section, subsection?, version?)` ; `getSpringReference(projectId, section, subsection?, offset = 0, version?)` (paramètre ajouté en dernier, appels existants inchangés).
- Imports `.js`, commentaires en anglais, pas d'attribution Claude dans les commits. `docker/tools.json` régénéré (`npm run build && npm run docker:tools`).

## Review Focus

- Sans `version`, toutes les URLs et clés de cache existantes sont **identiques** à avant (les tests existants passent sans modification).
- `3.4.2` et `3.4` produisent la même URL et la même clé ; `current` ≡ absent.
- Versions invalides (`3.4-SNAPSHOT`, `../x`, `3.x`, `3`, `v3.4`, `3.4.2.1`, ` 3.4`) rejetées sans appel réseau ; pas d'injection possible dans l'URL.
- Boot : la version va **avant** `reference/` (`…/spring-boot/3.4/reference/web/index.html`, `…/spring-boot/3.4/how-to/deployment/index.html`) ; les 10 autres : **après** `reference/`.
- Le message 404 dédié n'apparaît que quand `version` est fournie.

URLs versionnées déjà vérifiées en 200 le 2026-10-02 (à reprendre dans les tests ; l'implémenteur les re-vérifie avec `curl -s -o /dev/null -L -w '%{http_code}' -A springdocs-mcp-probe`) :

| projet / section / subsection / version | URL attendue |
|---|---|
| boot / web / – / 3.4 | `https://docs.spring.io/spring-boot/3.4/reference/web/index.html` |
| boot / deployment / – / 3.4 | `https://docs.spring.io/spring-boot/3.4/how-to/deployment/index.html` |
| boot / application-properties / – / 3.4 | `https://docs.spring.io/spring-boot/3.4/appendix/application-properties/index.html` |
| boot / native-image / – / 3.4 | `https://docs.spring.io/spring-boot/3.4/reference/packaging/native-image/index.html` |
| framework / core / – / 6.2 | `https://docs.spring.io/spring-framework/reference/6.2/core.html` |
| framework / core / beans / 6.2 | `https://docs.spring.io/spring-framework/reference/6.2/core/beans.html` |
| ai / chatclient / – / 1.1 | `https://docs.spring.io/spring-ai/reference/1.1/api/chatclient.html` |
| security / servlet / – / 6.5 | `https://docs.spring.io/spring-security/reference/6.5/servlet/index.html` |
| security / servlet / architecture / 6.5 | `https://docs.spring.io/spring-security/reference/6.5/servlet/architecture.html` |
| security / authentication / – / 6.5 | `https://docs.spring.io/spring-security/reference/6.5/servlet/authentication/index.html` |
| batch / job / – / 5.2 | `https://docs.spring.io/spring-batch/reference/5.2/job.html` |
| kafka / retrytopic / – / 3.2 | `https://docs.spring.io/spring-kafka/reference/3.2/retrytopic.html` |
| integration / channel / – / 6.4 | `https://docs.spring.io/spring-integration/reference/6.4/channel.html` |
| modulith / events / – / 1.3 | `https://docs.spring.io/spring-modulith/reference/1.3/events.html` |
| data-jpa / jpa / query-methods / 3.5 | `https://docs.spring.io/spring-data/jpa/reference/3.5/jpa/query-methods.html` |
| cloud-config / server / – / 4.2 | `https://docs.spring.io/spring-cloud-config/reference/4.2/server.html` |
| cloud-gateway / spring-cloud-gateway-server-webflux / – / 4.3 | `https://docs.spring.io/spring-cloud-gateway/reference/4.3/spring-cloud-gateway-server-webflux.html` (non encore sondée : si 404, remplacer par `…/4.3/appendix.html` ou la page d'index `…/4.3/index.html` déjà vérifiée en #32 et le signaler) |

---

### Task 1: configuration — `normalizeVersion`, `versionInsertAfter`, `buildReferenceUrl(version?)`

**Files:**
- Modify: `src/services/spring-projects-config.ts` (interface `SpringProjectConfig`, les 11 entrées, `buildReferenceUrl`), `src/services/url.ts` (`normalizeVersion`)
- Test: `tests/versioned-urls.test.ts` (nouveau)

**Interfaces:**
- Produces: `export function normalizeVersion(version?: string): string | undefined` dans `url.ts` (renvoie `undefined` pour absent/vide/`current`, `major.minor` sinon, lève sur format invalide) ; `SpringProjectConfig.versionInsertAfter?: string` ; `buildReferenceUrl(projectId: string, section: string, subsection?: string, version?: string): string` (la `version` passée est déjà normalisée ou brute : `buildReferenceUrl` appelle `normalizeVersion` lui-même).

- [ ] **Step 1: Écrire les tests qui échouent** `tests/versioned-urls.test.ts` : (a) un `it.each` sur la table ci-dessus (colonnes projet, section, subsection, version, URL) contre `springProjectsConfig.buildReferenceUrl` ; (b) `normalizeVersion` : `"3.4"`→`"3.4"`, `"3.4.2"`→`"3.4"`, `"current"`/`""`/`undefined`→`undefined`, et `it.each(["3.4-SNAPSHOT","../x","3.x","3","v3.4","3.4.2.1"," 3.4","3.4 ","3.4/../x","%2e"])` → `toThrow(/Invalid version/)` ; (c) sans version, `buildReferenceUrl("boot","web")` vaut `https://docs.spring.io/spring-boot/reference/web/index.html` et `("framework","core","beans")` vaut `https://docs.spring.io/spring-framework/reference/core/beans.html` (non-régression) ; (d) `3.4.2` et `3.4` donnent la même URL ; (e) un registre construit avec une entrée `hasVersionedDocs: false` lève `does not support versioned documentation` quand une version est demandée ; (f) pour chacun des 11 projets, `versionInsertAfter` est un préfixe de l'URL sans version de sa première section (garde contre une dérive de config).

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/versioned-urls.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** : `normalizeVersion` dans `src/services/url.ts` (exporté) ; champ `versionInsertAfter?: string` (JSDoc : « prefix of the unversioned reference URL after which "<version>/" is inserted ») sur l'interface ; renseigner les 11 entrées (valeurs ci-dessus) ; passer `ai` à `hasVersionedDocs: true` (retirer le commentaire obsolète) ; dans `buildReferenceUrl`, après avoir construit l'URL courante : si `normalizeVersion(version)` est défini → vérifier `project.hasVersionedDocs && project.versionInsertAfter` (sinon erreur) et `url.startsWith(prefix)` (sinon erreur interne explicite), puis `prefix + normalized + '/' + url.slice(prefix.length)`.

- [ ] **Step 4: Vérifier** : `npm test` → tout vert (aucun test existant modifié).

- [ ] **Step 5: Commit** : `git add src tests && git commit -m "feat: construire des URLs de référence versionnées (versionInsertAfter, normalizeVersion)"`

### Task 2: service, schéma, handler, cache, erreur 404

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts` (`getSpringReference`), `src/tools/index.ts` (schéma de `get_spring_reference`), `src/index.ts` (`handleGetReference`), `docker/tools.json` (régénéré)
- Test: `tests/reference-version.test.ts` (nouveau)

**Interfaces:**
- Consumes: `normalizeVersion`, `buildReferenceUrl(..., version?)` (Task 1).
- Produces: `getSpringReference(projectId, section, subsection?, offset = 0, version?)`.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/reference-version.test.ts` (gabarit : `tests/reference-url.test.ts` — mock `node-fetch`, `fakeResponse`) :
  1. avec `version: "3.4.2"` sur `boot/web`, `fetch` est appelé avec `https://docs.spring.io/spring-boot/3.4/reference/web/index.html` ;
  2. sans version, l'URL est exactement l'actuelle (`https://docs.spring.io/spring-boot/reference/web/index.html`) ;
  3. deux versions différentes (`3.3` puis `3.4`) du même `boot/web` → deux `fetch` (caches distincts) ; deux appels identiques `3.4` → un seul `fetch` ; version absente puis `3.4` → deux `fetch` ;
  4. `fetch` mocké en 404 avec `version: "3.0"` → rejet avec `Reference not found for Spring Boot version 3.0` ; 404 sans version → message actuel inchangé (`Reference section not found: Spring Boot / web`) ;
  5. `version: "3.4-SNAPSHOT"` → rejet `Invalid version`, `fetch` jamais appelé ;
  6. le tool : `validateToolArguments("get_spring_reference", { section: "web", version: "3.4" })` renvoie `version: "3.4"` ; une `version` de 21 caractères est refusée (maxLength) ; le handler (ou le service) reçoit bien la version : au minimum, vérifier par un test d'intégration léger sur `handleGetReference` si le gabarit des tests existants le permet, sinon par inspection du code dans le rapport.

- [ ] **Step 2: Vérifier l'échec** : `npm run build && npx vitest run tests/reference-version.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** : `getSpringReference` calcule `const normalizedVersion = normalizeVersion(version)` **avant** tout accès cache/réseau (donc une version invalide lève immédiatement) ; clé de cache selon les contraintes globales ; `buildReferenceUrl(projectId, safeSection, safeSubsection, normalizedVersion)` ; sur `!response.ok` : message dédié si `normalizedVersion` sinon message actuel. Schéma : ajouter `version: { type: "string", maxLength: 20, description: "Version de la documentation (ex: '3.4' ou '3.4.2' ; le patch est ignoré). Omis ou 'current' = dernière version. Les anciennes versions peuvent ne pas être publiées." }` à `get_spring_reference`. `handleGetReference` lit `version` et le passe en dernier argument. Régénérer : `npm run build && npm run docker:tools`.

- [ ] **Step 4: Vérifier** : `npm test` → tout vert (dont `docker-tools.test.ts`, `validation.test.ts`, `reference-url.test.ts`, `pagination.test.ts`, `registry.test.ts`).

- [ ] **Step 5: Commit** : `git add src tests docker && git commit -m "feat: ajouter le paramètre version à get_spring_reference (cache par version, message dédié si non publiée)"`

### Task 3: backlog

- [ ] Après vérification réelle de `npm test`, cocher #34 dans `IMPROVE.md` (` — Fait le 2026-10-02`, avec : périmètre `get_spring_reference` seulement ; les recherches restent sur la doc courante = candidat backlog ; `ai` corrigé en `hasVersionedDocs: true`).
