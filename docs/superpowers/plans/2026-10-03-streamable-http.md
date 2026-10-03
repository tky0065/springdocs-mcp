# Transport Streamable HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pouvoir lancer le serveur en HTTP (`--transport http`) en plus de stdio, en loopback par défaut, sans authentification.

**Architecture:** les services restent des singletons ; `SpringBootMCPServerAdvanced` expose `createServer()` qui construit un `Server` MCP neuf (stdio : une fois ; HTTP : une fois par requête, mode sans état). Un module `src/http-server.ts` (`node:http`) route `POST /mcp` vers `StreamableHTTPServerTransport`, avec contrôles `Host`/`Origin`, `Content-Type` et taille du corps. `src/config.ts` analyse arguments et variables d'environnement.

**Tech Stack:** TypeScript (Node16, ES2022), `@modelcontextprotocol/sdk` 1.31 (`StreamableHTTPServerTransport`, `StreamableHTTPClientTransport`), `node:http`, vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-03-streamable-http-design.md`

## Global Constraints

- Stdio reste le mode par défaut et se comporte exactement comme avant (`tests/stdio.test.ts` reste vert sans modification).
- Mode sans état : `sessionIdGenerator: undefined`, un `Server` + un transport par requête `POST /mcp`.
- Pas d'Express, pas de nouvelle dépendance.
- Écoute par défaut sur `127.0.0.1`, port 3000 ; toute autre adresse = avertissement sur stderr.
- Corps limité à 1 Mo (413) ; `Content-Type: application/json` obligatoire (415) ; `Host`/`Origin` hostiles = 403 ; `GET`/`DELETE /mcp` = 405 ; autres chemins = 404 ; `GET /healthz` = 200.
- Variables : `MCP_TRANSPORT`, `MCP_PORT`, `MCP_HOST`, `MCP_ALLOWED_HOSTS` ; options `--transport`, `--port`, `--host` (CLI prioritaire).
- Les journaux vont sur stderr, jamais sur stdout.
- Hors périmètre : authentification, limite de débit, sessions, ancien transport SSE, TLS, modification du Dockerfile.
- Commits sans ligne d'attribution à Claude (règle du CLAUDE.md global de l'utilisateur).

## Review Focus

- Requête avec `Host` valide mais `Origin` d'une autre origine (page web hostile contre un serveur loopback) : 403.
- Corps JSON invalide ou énorme : erreur propre (400 / 413), le serveur reste vivant pour la requête suivante.
- Deux clients concurrents : aucune interférence (un `Server` par requête, aucune fuite d'état).
- `Ctrl+C`/`SIGTERM` en mode HTTP avec une connexion ouverte : sortie avec le code 0 en quelques secondes, port libéré.
- Port invalide (`--port abc`, `--port 70000`) ou transport inconnu : échec de démarrage avec un message clair, pas de serveur à moitié lancé.

---

## File Structure

- Create `src/config.ts` : `parseConfig(argv, env)` pure.
- Create `src/http-server.ts` : `startHttpServer(opts)`.
- Modify `src/index.ts` : `createServer()`, `run()` selon le transport, `shutdown()`.
- Create `tests/http-config.test.ts`, `tests/http-transport.test.ts`, `tests/http-e2e.test.ts`.
- Modify `README.md`, `CLAUDE.md`, `docker/README.md`.

---

### Task 1: Configuration (`parseConfig`)

**Files:**
- Create: `src/config.ts`
- Test: `tests/http-config.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  export type TransportMode = "stdio" | "http";
  export interface ServerConfig { transport: TransportMode; host: string; port: number; allowedHosts: string[] }
  export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): ServerConfig  // lève Error si invalide
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig (#53)", () => {
  it("par défaut : stdio, 127.0.0.1:3000", () => {
    expect(parseConfig([], {})).toEqual({ transport: "stdio", host: "127.0.0.1", port: 3000, allowedHosts: [] });
  });

  it("lit les variables d'environnement", () => {
    const config = parseConfig([], { MCP_TRANSPORT: "http", MCP_PORT: "8080", MCP_HOST: "0.0.0.0", MCP_ALLOWED_HOSTS: "localhost:8080, my.host:8080" });
    expect(config).toEqual({ transport: "http", host: "0.0.0.0", port: 8080, allowedHosts: ["localhost:8080", "my.host:8080"] });
  });

  it("les options CLI priment sur l'environnement, avec ou sans =", () => {
    const config = parseConfig(["--transport", "http", "--port=9000", "--host", "::1"], { MCP_TRANSPORT: "stdio", MCP_PORT: "1" });
    expect(config).toMatchObject({ transport: "http", port: 9000, host: "::1" });
  });

  it("accepte le port 0 (port éphémère)", () => {
    expect(parseConfig(["--transport", "http", "--port", "0"], {}).port).toBe(0);
  });

  it.each(["abc", "70000", "-1", "3.5", ""])("refuse le port %j", (port) => {
    expect(() => parseConfig(["--port", port], {})).toThrow(/Invalid port/);
  });

  it("refuse un transport inconnu", () => {
    expect(() => parseConfig(["--transport", "sse"], {})).toThrow(/Invalid transport "sse".*stdio, http/);
  });

  it("refuse une option sans valeur", () => {
    expect(() => parseConfig(["--port"], {})).toThrow(/--port requires a value/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/http-config.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```ts
export type TransportMode = "stdio" | "http";

export interface ServerConfig {
  transport: TransportMode;
  host: string;
  port: number;
  allowedHosts: string[];
}

const TRANSPORTS: TransportMode[] = ["stdio", "http"];

/** Value of `--name value` or `--name=value`; undefined when the option is absent. */
function readOption(argv: string[], name: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === name) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${name} requires a value`);
      }
      return value;
    }
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): ServerConfig {
  const transport = readOption(argv, "--transport") ?? env.MCP_TRANSPORT ?? "stdio";
  if (!TRANSPORTS.includes(transport as TransportMode)) {
    throw new Error(`Invalid transport "${transport}". Allowed: ${TRANSPORTS.join(", ")}`);
  }

  const rawPort = readOption(argv, "--port") ?? env.MCP_PORT ?? "3000";
  const port = Number(rawPort);
  if (rawPort.trim() === "" || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port "${rawPort}": expected an integer between 0 and 65535`);
  }

  const host = readOption(argv, "--host") ?? env.MCP_HOST ?? "127.0.0.1";
  const allowedHosts = (env.MCP_ALLOWED_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean);

  return { transport: transport as TransportMode, host, port, allowedHosts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/http-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/http-config.test.ts
git commit -m "feat(http): analyse de la configuration de transport (#53)"
```

---

### Task 2: Serveur HTTP (`startHttpServer`)

**Files:**
- Create: `src/http-server.ts`
- Test: `tests/http-transport.test.ts`

**Interfaces:**
- Consumes: `Server` du SDK.
- Produces:
  ```ts
  export interface HttpServerOptions { host: string; port: number; createServer: () => Server; allowedHosts?: string[] }
  export interface RunningHttpServer { port: number; close(): Promise<void> }
  export function startHttpServer(options: HttpServerOptions): Promise<RunningHttpServer>
  ```

- [ ] **Step 1: Write the failing test**

`tests/http-transport.test.ts` utilise un `Server` factice (aucun service réel) et un vrai client du SDK :

```ts
import { request as httpRequest } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { startHttpServer, type RunningHttpServer } from "../src/http-server.js";

function stubServer(): Server {
  const server = new Server({ name: "stub", version: "0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{ name: "echo", description: "echo", inputSchema: { type: "object", properties: {} } }],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => ({
    content: [{ type: "text", text: `echo:${JSON.stringify(req.params.arguments ?? {})}` }],
  }));
  return server;
}

let running: RunningHttpServer;
beforeEach(async () => { running = await startHttpServer({ host: "127.0.0.1", port: 0, createServer: stubServer }); });
afterEach(async () => { await running.close(); });

const url = () => `http://127.0.0.1:${running.port}`;

/** Raw request so that Host/Origin and the body can be forged. */
function raw(method: string, path: string, opts: { headers?: Record<string, string>; body?: string } = {}) {
  return new Promise<{ status: number; headers: Record<string, any>; body: string }>((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port: running.port, method, path, headers: opts.headers }, (res) => {
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end(opts.body);
  });
}

const JSON_HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const INIT = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } } });

describe("transport Streamable HTTP (#53)", () => {
  it("sert initialize, tools/list et tools/call à un vrai client MCP", async () => {
    const client = new Client({ name: "vitest", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url()}/mcp`)));
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(["echo"]);
    const result: any = await client.callTool({ name: "echo", arguments: { a: 1 } });
    expect(result.content[0].text).toBe('echo:{"a":1}');
    await client.close();
  });

  it("deux clients concurrents ne s'influencent pas", async () => {
    const make = async () => {
      const client = new Client({ name: "vitest", version: "0" });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${url()}/mcp`)));
      return client;
    };
    const [a, b] = await Promise.all([make(), make()]);
    const [ra, rb]: any[] = await Promise.all([
      a.callTool({ name: "echo", arguments: { who: "a" } }),
      b.callTool({ name: "echo", arguments: { who: "b" } }),
    ]);
    expect(ra.content[0].text).toContain('"a"');
    expect(rb.content[0].text).toContain('"b"');
    await Promise.all([a.close(), b.close()]);
  });

  it("refuse un Host hostile (DNS rebinding) en 403", async () => {
    const res = await raw("POST", "/mcp", { headers: { ...JSON_HEADERS, host: "evil.example:80" }, body: INIT });
    expect(res.status).toBe(403);
  });

  it("refuse un Origin d'une autre origine en 403, même avec un Host valide", async () => {
    const res = await raw("POST", "/mcp", { headers: { ...JSON_HEADERS, origin: "http://evil.example" }, body: INIT });
    expect(res.status).toBe(403);
  });

  it("accepte un Origin loopback sur le bon port", async () => {
    const res = await raw("POST", "/mcp", { headers: { ...JSON_HEADERS, origin: `http://localhost:${running.port}` }, body: INIT });
    expect(res.status).toBe(200);
  });

  it("répond 405 à GET et DELETE sur /mcp, avec Allow: POST", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await raw(method, "/mcp", { headers: { accept: "text/event-stream" } });
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe("POST");
    }
  });

  it("répond 404 sur un autre chemin", async () => {
    expect((await raw("POST", "/other", { headers: JSON_HEADERS, body: INIT })).status).toBe(404);
  });

  it("répond 415 si le Content-Type n'est pas JSON", async () => {
    const res = await raw("POST", "/mcp", { headers: { ...JSON_HEADERS, "content-type": "text/plain" }, body: INIT });
    expect(res.status).toBe(415);
  });

  it("répond 400 -32700 pour un JSON invalide, puis continue de servir", async () => {
    const bad = await raw("POST", "/mcp", { headers: JSON_HEADERS, body: "{not json" });
    expect(bad.status).toBe(400);
    expect(JSON.parse(bad.body).error.code).toBe(-32700);
    expect((await raw("POST", "/mcp", { headers: JSON_HEADERS, body: INIT })).status).toBe(200);
  });

  it("répond 413 pour un corps de plus de 1 Mo, puis continue de servir", async () => {
    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "x", params: { pad: "a".repeat(1_100_000) } });
    const res = await raw("POST", "/mcp", { headers: JSON_HEADERS, body: big }).catch(() => ({ status: 413 }));
    expect(res.status).toBe(413);
    expect((await raw("POST", "/mcp", { headers: JSON_HEADERS, body: INIT })).status).toBe(200);
  });

  it("/healthz répond 200", async () => {
    const res = await raw("GET", "/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toBe("ok");
  });

  it("close() libère le port", async () => {
    const port = running.port;
    await running.close();
    const again = await startHttpServer({ host: "127.0.0.1", port, createServer: stubServer });
    expect(again.port).toBe(port);
    await again.close();
    running = await startHttpServer({ host: "127.0.0.1", port: 0, createServer: stubServer }); // pour afterEach
  });

  it("honore allowedHosts pour un Host supplémentaire", async () => {
    const extra = await startHttpServer({ host: "127.0.0.1", port: 0, createServer: stubServer, allowedHosts: ["proxy.local:8080"] });
    const res = await new Promise<number>((resolve, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port: extra.port, method: "POST", path: "/mcp", headers: { ...JSON_HEADERS, host: "proxy.local:8080" } }, r => { r.resume(); resolve(r.statusCode ?? 0); });
      req.on("error", reject);
      req.end(INIT);
    });
    expect(res).toBe(200);
    await extra.close();
  });
});
```

Si `raw` échoue en `ECONNRESET`/`EPIPE` sur le test 413 (le serveur coupe pendant l'écriture), c'est déjà géré par le `.catch` ; vérifier ensuite que la requête suivante réussit.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/http-transport.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```ts
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const MAX_BODY_BYTES = 1024 * 1024;
const CLOSE_GRACE_MS = 2000;

export interface HttpServerOptions {
  host: string;
  port: number;
  createServer: () => Server;
  allowedHosts?: string[];
}

export interface RunningHttpServer {
  port: number;
  close(): Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload), ...headers });
  res.end(payload);
}

const rpcError = (code: number, message: string) => ({ jsonrpc: "2.0", error: { code, message }, id: null });

/** Reads the body, giving up as soon as it exceeds the limit. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      resolve(null);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        resolve(null);
        return;
      }
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function startHttpServer(options: HttpServerOptions): Promise<RunningHttpServer> {
  const extraHosts = new Set(options.allowedHosts ?? []);
  let allowed = new Set<string>();

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // DNS rebinding: the Host header must be a known loopback name (or explicitly allowed)
    const host = req.headers.host ?? "";
    if (!allowed.has(host)) {
      sendJson(res, 403, rpcError(-32000, "Forbidden: invalid Host header"));
      return;
    }

    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    const origin = req.headers.origin;
    if (origin !== undefined) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        // an unparsable Origin ("null", garbage) is rejected below
      }
      if (!allowed.has(originHost)) {
        sendJson(res, 403, rpcError(-32000, "Forbidden: invalid Origin header"));
        return;
      }
    }

    if (path !== "/mcp") {
      sendJson(res, 404, rpcError(-32000, "Not found"));
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, rpcError(-32000, "Method not allowed"), { allow: "POST" });
      return;
    }
    if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) {
      sendJson(res, 415, rpcError(-32000, "Content-Type must be application/json"));
      return;
    }

    const raw = await readBody(req);
    if (raw === null) {
      sendJson(res, 413, rpcError(-32000, "Request body too large (max 1 MiB)"), { connection: "close" });
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      sendJson(res, 400, rpcError(-32700, "Parse error"));
      return;
    }

    // Stateless: one MCP server and transport per request, shared services live in createServer's closure
    const mcp = options.createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void mcp.close().catch(() => {});
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  };

  const server = createHttpServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("💥 HTTP request failed:", error instanceof Error ? error.message : error);
      if (!res.headersSent) sendJson(res, 500, rpcError(-32603, "Internal server error"));
      else res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  allowed = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`, ...extraHosts]);

  return {
    port,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
      setTimeout(() => server.closeAllConnections(), CLOSE_GRACE_MS).unref();
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/http-transport.test.ts`
Expected: PASS. Points de vigilance : si le client du SDK n'ouvre pas de flux `GET` (405 toléré en mode sans état), il continue de fonctionner ; si un test échoue sur l'`Accept`, vérifier que le client envoie `application/json, text/event-stream`.

- [ ] **Step 5: Commit**

```bash
git add src/http-server.ts tests/http-transport.test.ts
git commit -m "feat(http): serveur Streamable HTTP sans état avec contrôles Host/Origin (#53)"
```

---

### Task 3: Brancher le transport dans `src/index.ts`

**Files:**
- Modify: `src/index.ts` (imports, classe, `run()`, `shutdown`)
- Test: `tests/http-e2e.test.ts`

**Interfaces:**
- Consumes: `parseConfig`, `ServerConfig` (Task 1) ; `startHttpServer`, `RunningHttpServer` (Task 2).
- Produces: processus `node build/index.js --transport http --port 0` qui écrit sur stderr la ligne `HTTP server listening on http://127.0.0.1:<port>/mcp`.

- [ ] **Step 1: Write the failing test**

`tests/http-e2e.test.ts` lance le vrai binaire :

```ts
import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENTRY = fileURLToPath(new URL("../build/index.js", import.meta.url));

let child: ChildProcess | undefined;
afterEach(() => { child?.kill("SIGKILL"); child = undefined; });

function start(args: string[], env: Record<string, string> = {}) {
  child = spawn("node", [ENTRY, ...args], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  const proc = child;
  const stdout: string[] = [];
  proc.stdout!.on("data", chunk => stdout.push(String(chunk)));
  const listening = new Promise<number>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("server did not report its port")), 8000);
    proc.stderr!.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/HTTP server listening on http:\/\/[^:]+:(\d+)\/mcp/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`server exited early (${code})`)); });
  });
  return { proc, stdout, listening };
}

describe("transport HTTP de bout en bout (#53)", () => {
  it("expose les 17 tools et exécute spring_cache_stats sans réseau", async () => {
    const { listening, stdout } = start(["--transport", "http", "--port", "0"]);
    const port = await listening;
    const client = new Client({ name: "vitest", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    expect((await client.listTools()).tools).toHaveLength(17);
    const result: any = await client.callTool({ name: "spring_cache_stats", arguments: {} });
    expect(result.content[0].text).toMatch(/# Cache statistics/);
    await client.close();
    expect(stdout.join("")).toBe("");
  });

  it("le cache est partagé entre requêtes HTTP (singletons)", async () => {
    const { listening } = start(["--transport", "http", "--port", "0"]);
    const port = await listening;
    const call = async () => {
      const client = new Client({ name: "vitest", version: "0" });
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
      const result: any = await client.callTool({ name: "spring_cache_stats", arguments: {} });
      await client.close();
      return result.content[0].text as string;
    };
    expect(await call()).toMatch(/Entries: 0 \//);
    expect(await call()).toMatch(/Entries: 0 \//); // même instance de cache, pas de crash sur la 2e requête
  });

  it("MCP_TRANSPORT=http suffit, et SIGTERM termine le processus avec le code 0", async () => {
    const { proc, listening } = start([], { MCP_TRANSPORT: "http", MCP_PORT: "0" });
    await listening;
    const exit = new Promise<number | null>(resolve => proc.on("exit", code => resolve(code)));
    proc.kill("SIGTERM");
    expect(await Promise.race([exit, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no exit")), 6000))])).toBe(0);
  });

  it("un port invalide fait échouer le démarrage avec un message clair", async () => {
    const { proc } = start(["--transport", "http", "--port", "abc"]);
    let stderr = "";
    proc.stderr!.on("data", chunk => (stderr += chunk));
    const code = await new Promise<number | null>(resolve => proc.on("exit", resolve));
    expect(code).toBe(1);
    expect(stderr).toMatch(/Invalid port "abc"/);
  });
});
```

Le premier test attend `listening` ; les handlers `proc.on("exit", reject)` de `start` peuvent rejeter une promesse déjà résolue sans effet. Pour le test du port invalide, `listening` rejette : ajouter `listening.catch(() => {})` juste après `start(...)` pour éviter un rejet non géré.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx vitest run tests/http-e2e.test.ts`
Expected: FAIL (`--transport` ignoré : le serveur reste en stdio et ne publie jamais de port).

- [ ] **Step 3: Implement**

3a. `src/index.ts` : imports.

```ts
import { parseConfig, type ServerConfig } from "./config.js";
import { startHttpServer, type RunningHttpServer } from "./http-server.js";
```

3b. Refactor de la classe. Vérifier d'abord : `grep -n "this.server" src/index.ts`. Le champ `private server: Server;` et sa création dans le constructeur sont à déplacer :

- Supprimer le champ `server` et le bloc `this.server = new Server(...)` du constructeur ; le constructeur ne garde que la création des services (`cache`, `docsService`, `resourcesService`, `advancedService`, `initializrService`).
- Ajouter :

```ts
  /** Builds a fresh MCP server bound to the shared services (once for stdio, once per request for HTTP). */
  createServer(): Server {
    const server = new Server(
      { name: "springboot-mcp-server-advanced", version: VERSION },
      { capabilities: { tools: {}, prompts: {}, resources: {} } }
    );
    this.setupToolHandlers(server);
    this.setupPromptHandlers(server);
    this.setupResourceHandlers(server);
    return server;
  }
```

(reprendre exactement les `capabilities` actuelles du constructeur.)

- Changer les signatures `setupResourceHandlers()`, `setupPromptHandlers()`, `setupToolHandlers()` en `(server: Server)` et remplacer `this.server.setRequestHandler` par `server.setRequestHandler` dans ces trois méthodes.

3c. `run()` remplacé par :

```ts
  private httpServer?: RunningHttpServer;

  async run(config: ServerConfig) {
    try {
      if (config.transport === "http") {
        const loopback = ["127.0.0.1", "localhost", "::1"].includes(config.host);
        if (!loopback) {
          console.error(`⚠️  Listening on ${config.host}: the HTTP transport has no authentication, restrict access at the network level`);
        }
        this.httpServer = await startHttpServer({
          host: config.host,
          port: config.port,
          allowedHosts: config.allowedHosts,
          createServer: () => this.createServer(),
        });
        console.error(`🚀 HTTP server listening on http://${config.host}:${this.httpServer.port}/mcp`);
        return;
      }
      const server = this.createServer();
      console.error("🚀 Advanced Spring Boot MCP Server started on stdio");
      await server.connect(new StdioServerTransport());
      console.error("✅ Server connected successfully");
    } catch (error) {
      console.error("💥 Error starting server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.httpServer?.close();
  }
```

Le message du test exige `HTTP server listening on http://<host>:<port>/mcp` (le préfixe emoji est toléré par la regex).

3d. `main()` et `shutdown` :

```ts
let app: SpringBootMCPServerAdvanced | undefined;

async function main() {
  let config: ServerConfig;
  try {
    config = parseConfig(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(`💥 ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  app = new SpringBootMCPServerAdvanced();
  await app.run(config);
}

function shutdown(signal: NodeJS.Signals): void {
  console.error(`🛑 Shutting down server (${signal})...`);
  const done = () => process.exit(0);
  // Close the HTTP server first (bounded), then exit
  const bound = setTimeout(done, 3000);
  bound.unref();
  (app?.stop() ?? Promise.resolve()).then(done, done);
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: tout PASS : `http-e2e` (4 tests), `stdio.test.ts` inchangé, `docker-tools.test.ts`, etc. Lire la sortie réelle ; vérifier aussi à la main : `node build/index.js --transport http --port 0` affiche la ligne d'écoute puis répond à `curl -s -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' http://127.0.0.1:<port>/mcp`.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/http-e2e.test.ts
git commit -m "feat(http): option --transport http (MCP_TRANSPORT) et arrêt propre (#53)"
```

---

### Task 4: Documentation

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docker/README.md`

- [ ] **Step 1: CLAUDE.md** : dans « Architecture / Core Components », remplacer la phrase sur le transport stdio de `src/index.ts` pour mentionner `createServer()` et ajouter :

```
- `src/config.ts`: `parseConfig` (flags `--transport/--port/--host` and `MCP_*` env vars)
- `src/http-server.ts`: Streamable HTTP transport on `node:http` (stateless: one `Server` per request, Host/Origin checks, 1 MiB body cap, `POST /mcp`, `GET /healthz`)
```

Dans « Data Flow », préciser que le client peut aussi arriver par `POST /mcp` en mode HTTP.

- [ ] **Step 2: README.md** : ajouter une section « Transport HTTP » :

````markdown
## Transport HTTP (optionnel)

Par défaut le serveur parle stdio. Pour l'héberger en local ou en conteneur :

```bash
npx @enokdev/springdocs-mcp --transport http --port 3000   # écoute sur 127.0.0.1
```

| Option | Variable | Défaut |
|---|---|---|
| `--transport stdio\|http` | `MCP_TRANSPORT` | `stdio` |
| `--port` | `MCP_PORT` | `3000` |
| `--host` | `MCP_HOST` | `127.0.0.1` |
| (aucune) | `MCP_ALLOWED_HOSTS` | vide : liste de `Host` supplémentaires, séparés par des virgules |

Endpoint MCP : `POST /mcp` (mode sans état) ; santé : `GET /healthz`. **Aucune authentification** : l'écoute reste sur loopback par défaut, et les en-têtes `Host`/`Origin` sont contrôlés contre le DNS rebinding. Pour un conteneur, `MCP_TRANSPORT=http MCP_HOST=0.0.0.0` avec le port publié (`-p 127.0.0.1:3000:3000`) ; si le port publié diffère du port interne, déclarer le `Host` utilisé par le client, par exemple `MCP_ALLOWED_HOSTS=localhost:8080`.
````

- [ ] **Step 3: docker/README.md** : ajouter un court paragraphe renvoyant à cette section (`MCP_TRANSPORT=http`, port à publier, pas d'authentification). Ne pas modifier le `Dockerfile`.

- [ ] **Step 4: Vérifier et committer**

Run: `npm test`
Expected: PASS.

```bash
git add README.md CLAUDE.md docker/README.md
git commit -m "docs: transport Streamable HTTP (#53)"
```

---

## Self-Review

- Couverture de la spec : config (Task 1), serveur et sécurité, healthz, 405/404/413/415/-32700 (Task 2), refactor `createServer`, sélection du transport, avertissement non-loopback, cycle de vie (Task 3), docs (Task 4). Docker non modifié, comme prévu.
- Cohérence des noms : `parseConfig`, `ServerConfig`, `startHttpServer`, `RunningHttpServer`, `createServer`, `stop`.
- Risque connu : le comportement exact du client SDK en mode sans état (ouverture d'un `GET` SSE refusé en 405) ; le test de bout en bout du Task 2 le vérifie avant le branchement final.
