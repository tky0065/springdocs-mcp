# Transport Streamable HTTP : design

IMPROVE.md #53 · 2026-10-03 · Classification : architecturale

## Objectif

Le serveur ne parle que stdio (`StdioServerTransport`, `src/index.ts`). Il doit pouvoir être hébergé à distance, par exemple en conteneur ou derrière un client web, via le transport Streamable HTTP du SDK `@modelcontextprotocol/sdk` 1.31. Stdio reste le mode par défaut, inchangé.

## Décisions validées

- **Usage visé** : local / conteneur, loopback. Pas d'authentification, pas de limite de débit (cohérent avec l'exclusion du scan).
- **Mode sans état (stateless)** : un `Server` MCP et un transport par requête `POST`. Tous les tools sont sans état et idempotents ; pas de sessions à expirer.
- **SSE** : on couvre le flux SSE que Streamable HTTP utilise pour répondre, pas l'ancien transport SSE à deux endpoints (déprécié dans la spec MCP).
- **Pas d'Express** : serveur `node:http` (`express` n'est pas une dépendance directe).

## Architecture

### Refactor de `src/index.ts`

Aujourd'hui `SpringBootMCPServerAdvanced` crée un `Server` et ses services dans le constructeur. On sépare :

- **Services partagés** (cache, `docsService`, `resourcesService`, `advancedService`, `initializrService`) : singletons, créés une fois.
- **`createMcpServer()`** : construit un `Server` avec capacités et handlers (tools, prompts, resources) branchés sur les services partagés. Appelé une fois en stdio, une fois par requête en HTTP.

Le comportement des handlers ne change pas.

### `src/http-server.ts`

- `startHttpServer({ host, port, createServer, allowedHosts }): Promise<{ close(): Promise<void>; port: number }>`.
- Route `POST /mcp` : crée un `StreamableHTTPServerTransport` en mode sans état (`sessionIdGenerator: undefined`), connecte un `Server` neuf, délègue la requête, ferme transport et serveur à la fin de la réponse.
- `GET /mcp` et `DELETE /mcp` : 405 avec `Allow: POST`. Autres chemins : 404.
- `GET /healthz` : 200 `ok` (healthcheck Docker), exempté du contrôle `Origin` mais pas du contrôle `Host`.
- Erreurs internes : réponse JSON-RPC d'erreur 500 sans fuite de pile ; détail sur stderr. Les journaux restent sur stderr.

### Sécurité (loopback)

- Écoute par défaut sur `127.0.0.1`. Toute autre adresse (`0.0.0.0`, etc.) n'est acceptée que par option explicite et émet un avertissement sur stderr.
- **DNS rebinding** : l'en-tête `Host` doit appartenir à la liste autorisée (`localhost`, `127.0.0.1`, `[::1]`, avec le port courant, plus `MCP_ALLOWED_HOSTS` séparé par des virgules). Si `Origin` est présent, son hôte doit aussi y appartenir. Sinon : 403.
- `Content-Type: application/json` obligatoire sur `POST` (415 sinon). Corps limité à 1 Mo (413 au-delà, lecture interrompue). JSON invalide : erreur JSON-RPC `-32700`.
- Pas de CORS : aucun en-tête `Access-Control-*`.

### Sélection du transport et configuration

- `--transport http` ou `MCP_TRANSPORT=http` (défaut `stdio`). Valeur inconnue : échec au démarrage avec un message clair.
- `--port` / `MCP_PORT` (défaut 3000, plage 1-65535, 0 autorisé pour les tests), `--host` / `MCP_HOST` (défaut `127.0.0.1`).
- Les arguments CLI priment sur les variables d'environnement. Analyse dans une fonction pure `parseConfig(argv, env)`, testable sans démarrer de serveur.

### Cycle de vie

Le `shutdown()` existant (SIGINT/SIGTERM) ferme d'abord le serveur HTTP (`close()` interrompt les connexions inactives, attente bornée à quelques secondes), puis sort avec le code 0. En stdio, comportement inchangé.

### Docker et docs

- Le `Dockerfile` n'est pas modifié (stdio par défaut ; la publication de port est une décision de déploiement).
- `README.md`, `CLAUDE.md`, `docker/README.md` : section « Transport HTTP » (options, sécurité, exemple `MCP_TRANSPORT=http MCP_HOST=0.0.0.0` pour un conteneur, avertissement d'exposition). `CLAUDE.md` : architecture mise à jour (`http-server.ts`, `createMcpServer`).

## Tests (vitest)

- `http-config.test.ts` : `parseConfig` (défauts, priorité CLI > env, port invalide, transport inconnu).
- `http-transport.test.ts` (port éphémère, client réel `StreamableHTTPClientTransport` du SDK) : `initialize` + `tools/list` (17 tools) + `tools/call spring_cache_stats` sans réseau ; deux clients concurrents sans interférence ; `Host` hostile → 403 ; `Origin` hostile → 403 ; `GET /mcp` → 405 ; corps > 1 Mo → 413 ; mauvais `Content-Type` → 415 ; JSON invalide → `-32700` ; `/healthz` → 200 ; `close()` libère le port.
- `stdio.test.ts` existant : non-régression stdio (doit rester vert sans modification).

## Hors périmètre

Authentification, jeton Bearer, limite de débit, sessions avec état et reprise de flux, ancien transport SSE, TLS (à déléguer à un reverse proxy), modification de l'image Docker.

## Critères de réussite

`npm test` vert, `node build/index.js` sans option se comporte comme avant (stdio), `node build/index.js --transport http --port 0` répond à un client MCP réel sur `127.0.0.1` et refuse un `Host`/`Origin` hostile.
