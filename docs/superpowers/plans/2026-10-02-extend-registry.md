# Extension du registre de projets Implementation Plan (#32)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 8 projets Spring au registre (`security`, `batch`, `integration`, `kafka`, `modulith`, `data-jpa`, `cloud-gateway`, `cloud-config`) pour `get_spring_reference`, avec des URLs **vérifiées sur le réseau**.

**Architecture:** Entrées de config dans `SPRING_PROJECTS` (le code est déjà générique via `referenceLayout`). `latestVersion` devient optionnel. L'enum `project` du schéma suit le registre, avec un test de cohérence.

**Tech Stack:** TypeScript (Node16), vitest 3.

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #32.

## Global Constraints

- **Aucune URL inventée** : chaque section listée doit répondre 200 (vérifier avec `curl -s -o /dev/null -L -w '%{http_code}' -A springdocs-mcp-probe <url>` avant de commiter ; retirer toute section en 404 et le signaler dans le rapport).
- Ids exacts : `security`, `batch`, `integration`, `kafka`, `modulith`, `data-jpa`, `cloud-gateway`, `cloud-config` (en plus de `boot`, `ai`, `framework`). L'enum du schéma = les 11 ids, dans cet ordre : `boot, ai, framework, security, data-jpa, batch, integration, kafka, modulith, cloud-gateway, cloud-config`.
- `latestVersion` devient **optionnel** (`latestVersion?: string`) ; ne PAS le renseigner pour les nouvelles entrées. Les entrées existantes gardent leur valeur. `buildApiUrl` doit continuer à compiler (il lève déjà une erreur si `apiPath` est absent ; ne pas ajouter d'`apiPath` aux nouvelles entrées).
- Les URLs de référence sont **sans version** (comme #16). `hasVersionedDocs` des nouvelles entrées : tester **une** URL versionnée réelle par site (trouver un numéro de version publié dans le sélecteur de version de la page d'index ou dans ses liens `<a href>`), `true` si elle répond 200, sinon `false` ; consigner l'URL testée en commentaire de l'entrée.
- `cacheStrategy: 'long'` pour tous les nouveaux projets. `scopes` : 3 à 6 mots-clés pertinents par projet (minuscules).
- Ne pas toucher aux entrées `boot`/`ai`/`framework` (hors typage de `latestVersion`), ni `buildReferenceUrl`, ni `validateSection`.
- Imports `.js`, commentaires en anglais, pas d'attribution Claude dans le commit. `docker/tools.json` régénéré (`npm run build && npm run docker:tools`).

## Review Focus

- Chaque nouvel id produit, via `buildReferenceUrl`, l'URL réelle vérifiée (table ci-dessous).
- Les ids de l'enum du schéma et ceux du registre sont identiques (test de cohérence dans les deux sens).
- Une section hors liste est refusée avec la liste des sections disponibles (comportement existant de `validateSection`).
- `tests/reference-url.test.ts` reste vert (il référence `project.latestVersion`, maintenant optionnel).
- Limite documentée : en layout `directory` (security), un `subsection` qui est lui-même un dossier n'est pas atteignable ; les sections de haut niveau sont donc exposées via `referencePaths`.

---

### Task 1: nouvelles entrées + schéma + tests

**Files:**
- Modify: `src/services/spring-projects-config.ts`, `src/tools/index.ts` (enum + description de `project` dans `get_spring_reference`), `docker/tools.json` (régénéré), `tests/reference-url.test.ts` si nécessaire (typage de `latestVersion`)
- Test: `tests/registry.test.ts` (nouveau)

**Interfaces:**
- Produces: `SpringProjectConfig.latestVersion?: string` ; 8 nouvelles entrées de `SPRING_PROJECTS`.

URLs de référence **déjà vérifiées en 200** le 2026-10-02 (à reprendre telles quelles dans les tests) :

| id | layout / base | sections → URL attendue |
|---|---|---|
| security | `directory`, base `https://docs.spring.io/spring-security` | `servlet` → `.../reference/servlet/index.html` ; `reactive` → `.../reference/reactive/index.html` ; `features` → `.../reference/features/index.html` ; `migration` → `.../reference/migration/index.html` ; via `referencePaths` : `authentication` → `reference/servlet/authentication`, `authorization` → `reference/servlet/authorization`, `oauth2` → `reference/servlet/oauth2`, `exploits` → `reference/servlet/exploits`, `integrations` → `reference/servlet/integrations`, `testing` → `reference/servlet/test` (chacune `.../index.html`) ; subsection : `servlet` + `architecture` → `.../reference/servlet/architecture.html` |
| batch | `flat`, base `https://docs.spring.io/spring-batch/reference` | `spring-batch-architecture`, `whatsnew`, `domain`, `job`, `step`, `readersAndWriters`, `processor`, `scalability`, `repeat`, `retry`, `testing`, `common-patterns` → `<base>/<section>.html` ; subsection : `step` + `chunk-oriented-processing` → `<base>/step/chunk-oriented-processing.html` |
| integration | `flat`, base `https://docs.spring.io/spring-integration/reference` | `overview`, `message`, `channel`, `endpoint`, `router`, `transformer`, `dsl`, `http`, `jms`, `amqp`, `kafka`, `testing`, `whats-new` |
| kafka | `flat`, base `https://docs.spring.io/spring-kafka/reference` | `introduction`, `quick-tour`, `kafka`, `retrytopic`, `streams`, `testing`, `whats-new` |
| modulith | `flat`, base `https://docs.spring.io/spring-modulith/reference` | `fundamentals`, `events`, `testing`, `verification`, `documentation`, `appendix` |
| data-jpa | `flat`, base `https://docs.spring.io/spring-data/jpa/reference` | `jpa`, `auditing` ; `repositories` n'existe qu'avec une subsection (`repositories` + `core-concepts` → `<base>/repositories/core-concepts.html`) ; subsections : `jpa` + `query-methods`, `jpa` + `transactions`, `jpa` + `specifications` |
| cloud-gateway | `flat`, base `https://docs.spring.io/spring-cloud-gateway/reference` | `spring-cloud-gateway-server-webflux`, `spring-cloud-gateway-server-webmvc`, `appendix` |
| cloud-config | `flat`, base `https://docs.spring.io/spring-cloud-config/reference` | `quickstart`, `server`, `client` ; subsection : `server` + `environment-repository` → `<base>/server/environment-repository.html` |

`displayName` : `Spring Security`, `Spring Batch`, `Spring Integration`, `Spring for Apache Kafka`, `Spring Modulith`, `Spring Data JPA`, `Spring Cloud Gateway`, `Spring Cloud Config`. `baseDocUrl` : la racine du site (ex. `https://docs.spring.io/spring-security`). Le commentaire de fin du registre (« Future projects can be added here ») est mis à jour (retirer les ids ajoutés).

- [ ] **Step 1: Écrire les tests qui échouent** `tests/registry.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { SpringProjectsConfig, springProjectsConfig } from "../src/services/spring-projects-config.js";
import { ToolDefinitions } from "../src/tools/index.js";

const EXPECTED: Array<[string, string, string | undefined, string]> = [
  ["security", "servlet", undefined, "https://docs.spring.io/spring-security/reference/servlet/index.html"],
  ["security", "authentication", undefined, "https://docs.spring.io/spring-security/reference/servlet/authentication/index.html"],
  ["security", "testing", undefined, "https://docs.spring.io/spring-security/reference/servlet/test/index.html"],
  ["security", "servlet", "architecture", "https://docs.spring.io/spring-security/reference/servlet/architecture.html"],
  ["batch", "job", undefined, "https://docs.spring.io/spring-batch/reference/job.html"],
  ["batch", "step", "chunk-oriented-processing", "https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing.html"],
  ["integration", "channel", undefined, "https://docs.spring.io/spring-integration/reference/channel.html"],
  ["kafka", "retrytopic", undefined, "https://docs.spring.io/spring-kafka/reference/retrytopic.html"],
  ["modulith", "events", undefined, "https://docs.spring.io/spring-modulith/reference/events.html"],
  ["data-jpa", "jpa", "query-methods", "https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html"],
  ["data-jpa", "repositories", "core-concepts", "https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html"],
  ["cloud-gateway", "spring-cloud-gateway-server-webflux", undefined, "https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux.html"],
  ["cloud-config", "server", "environment-repository", "https://docs.spring.io/spring-cloud-config/reference/server/environment-repository.html"],
];

describe("registre de projets (#32)", () => {
  it.each(EXPECTED)("%s/%s/%s -> URL vérifiée", (project, section, subsection, url) => {
    expect(springProjectsConfig.buildReferenceUrl(project, section, subsection)).toBe(url);
  });

  it("n'inclut aucune version dans les URLs de référence", () => {
    for (const project of springProjectsConfig.getAllProjects()) {
      for (const section of project.referenceSections ?? []) {
        expect(springProjectsConfig.buildReferenceUrl(project.id, section)).not.toMatch(/\/\d+\.\d+(\.\d+)?\//);
      }
    }
  });

  it("refuse une section inconnue en listant les sections disponibles", () => {
    expect(springProjectsConfig.validateSection("kafka", "nope")).toBe(false);
    expect(springProjectsConfig.validateSection("kafka", "retrytopic")).toBe(true);
  });

  it("l'enum project du schéma get_spring_reference égale les ids du registre", () => {
    const tool = (ToolDefinitions.getToolList() as any[]).find((t) => t.name === "get_spring_reference");
    const schemaIds: string[] = tool.inputSchema.properties.project.enum;
    expect([...schemaIds].sort()).toEqual([...springProjectsConfig.getAllProjectIds()].sort());
    expect(schemaIds).toEqual(["boot", "ai", "framework", "security", "data-jpa", "batch", "integration", "kafka", "modulith", "cloud-gateway", "cloud-config"]);
  });

  it("ne renseigne pas latestVersion pour les nouveaux projets", () => {
    for (const id of ["security", "batch", "integration", "kafka", "modulith", "data-jpa", "cloud-gateway", "cloud-config"]) {
      expect(springProjectsConfig.getProject(id).latestVersion).toBeUndefined();
    }
  });

  it("un registre construit avec un Map vide ne connaît aucun projet", () => {
    expect(() => new SpringProjectsConfig(new Map()).getProject("boot")).toThrow(/Unknown Spring project/);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/registry.test.ts` → FAIL (projets inconnus, enum à 3 valeurs).

- [ ] **Step 3: Implémenter** les 8 entrées (voir la table), `latestVersion?: string` (corriger le commentaire de doc du champ : « Latest known stable version (optional, informational) »), l'enum et la description de `project` dans `src/tools/index.ts`, puis **vérifier en ligne** chaque section de chaque nouveau projet (`curl` ci-dessus, en parallèle) et résoudre `hasVersionedDocs` (une URL versionnée testée par site). Retirer toute section en 404.

- [ ] **Step 4: Régénérer et vérifier** : `npm run build && npm run docker:tools && npm test` → tout vert (dont `docker-tools.test.ts`, `reference-url.test.ts`). Si `tests/reference-url.test.ts` ne compile plus à cause de `latestVersion` optionnel, l'adapter minimalement (ex. `...(project.latestVersion ? [expect(url).not.toContain(project.latestVersion)] : [])` ou une garde `if`) et le signaler.

- [ ] **Step 5: Commit** : `git add src tests docker && git commit -m "feat: étendre le registre avec Security, Data JPA, Batch, Integration, Kafka, Modulith et Cloud (Gateway, Config)"`

### Task 2: backlog

- [ ] Après vérification réelle de `npm test`, cocher #32 dans `IMPROVE.md` (` — Fait le 2026-10-02`, avec la note : `data`/`cloud` = `data-jpa`, `cloud-gateway`, `cloud-config`).
