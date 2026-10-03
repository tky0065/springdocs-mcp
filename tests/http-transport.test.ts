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
