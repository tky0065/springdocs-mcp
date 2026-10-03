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
  /** Address actually bound, as `ip:port` (`[ip]:port` for IPv6), not the configured host name. */
  address: string;
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

  const bound = typeof address === "object" && address
    ? `${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`
    : `${options.host}:${port}`;

  return {
    port,
    address: bound,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
      setTimeout(() => server.closeAllConnections(), CLOSE_GRACE_MS).unref();
    }),
  };
}
