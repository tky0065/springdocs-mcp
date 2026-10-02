# MCP resources : design

IMPROVE.md #47. Date : 2026-10-02.

## Objectif

Servir la documentation Spring déjà récupérée par le serveur sous forme de **resources MCP**, pour que les clients puissent l'attacher à une conversation sans appeler un tool. Les resources renvoient le markdown **complet** (pas de pagination), contrairement aux tools.

## Décisions validées

- `resources/list` énumère les 11 projets du registre ; `resources/templates/list` expose deux templates ; `resources/read` renvoie le document complet.
- Approche A : un module `src/resources.ts` qui s'appuie sur `SpringBootDocsServiceOptimized` ; réutilisation du cache, de la validation d'URL et du parsing existants.

## URIs

| Resource | URI | Source |
|---|---|---|
| Projet | `spring://project/<slug>`, `<slug>` = `^[a-z0-9][a-z0-9-]*$` | `https://spring.io/projects/<slug>` (via `getSpringProject`) |
| Guide | `spring://guide/<id>`, `<id>` = `^[A-Za-z0-9][A-Za-z0-9._-]*$` sans `..` | `getGuide(id, "full")` |

- Analyse par regex stricte sur la chaîne brute (pas de `new URL`) ; tout ce qui n'est pas exactement l'une de ces deux formes est rejeté : autre schéma, `?`, `#`, segment en trop, chaîne vide, `..`.
- `resources/list` : pour chacun des 11 projets du registre (`springProjectsConfig.getAllProjects()`), `spring://project/spring-<id>` (vérifié sur le réseau : les 11 pages `spring.io/projects/spring-<id>` répondent 200 après redirection), `name` = nom d'affichage, `mimeType` = `text/markdown`, `description` courte.
- `resources/templates/list` : `spring://project/{name}` (tout projet de spring.io) et `spring://guide/{id}`. Les guides ne sont pas énumérables (`getAllSpringGuides` renvoie 0 guide : bug connu du backlog).

## Composants

- `src/services/springboot-docs-optimized.ts` : extraction de `getProjectMarkdown(projectName): Promise<{ markdown: string; url: string }>` (fetch, parsing, cache `project:<name>` en `setLongTerm`, sécurité `assertSafeSegment`) ; `getSpringProject` l'appelle puis pagine avec `formatPage`. Comportement des tools inchangé.
- `src/resources.ts` : `class ResourcesService { constructor(docs) ; listResources() ; listTemplates() ; readResource(uri) }` ; `parseResourceUri(uri)` pure et testable.
- `src/index.ts` : `capabilities.resources = {}` (ni `subscribe` ni `listChanged`) ; handlers `ListResourcesRequestSchema`, `ListResourceTemplatesRequestSchema`, `ReadResourceRequestSchema`.

## Lecture et erreurs

- `readResource` renvoie `{ contents: [{ uri, mimeType: "text/markdown", text }] }` ; `text` = `# <titre>` + markdown complet + `Source: <url>`.
- URI invalide → `McpError(InvalidParams)` avec un message disant les formes acceptées.
- Échec de récupération (réseau, 404, page vide) → `McpError(InternalError)` avec le message d'origine ; rien n'est mis en cache en cas d'échec (comportement existant de `getSpringProject`/`getGuide`).
- Plafond de taille : celui de `fetchWithRetry` (5 MiB) s'applique tel quel.

## Tests

- Unitaires (`node-fetch` mocké, comme `tests/release-notes.test.ts`) : liste (11 projets, URI bien formées, uniques), templates, lecture d'un projet et d'un guide, URI invalides (`spring://project/../x`, `spring://project/spring-boot?x=1`, `spring://project/spring-boot#a`, `spring://other/x`, `http://spring.io`, `spring://project/`, `spring://guide/a/b`), cache partagé avec les tools (un seul fetch entre `getSpringProject` et `readResource`), `getSpringProject` toujours paginé après le refactor.
- Stdio sans réseau : capacité `resources` annoncée, `resources/list` = 11, `resources/templates/list` = 2, `resources/read` d'une URI invalide = `-32602`.

## Hors périmètre

Resources `reference` et `release-notes`, souscriptions, pagination des resources, énumération des guides (dépend du bug `getAllSpringGuides`).

## Docs

Mention des resources dans `README.md`, `CLAUDE.md`, `docker/README.md`. Le nombre de tools reste 16 ; `docker/tools.json` inchangé.
