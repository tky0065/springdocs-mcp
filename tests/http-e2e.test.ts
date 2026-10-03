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
      const match = buffer.match(/HTTP server listening on http:\/\/\S+:(\d+)\/mcp/);
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
    expect(await call()).toMatch(/Entries: 0\n- Memory/);
    expect(await call()).toMatch(/Entries: 0\n- Memory/); // même instance de cache, pas de crash sur la 2e requête
  });

  it("MCP_TRANSPORT=http suffit, et SIGTERM termine le processus avec le code 0", async () => {
    const { proc, listening } = start([], { MCP_TRANSPORT: "http", MCP_PORT: "0" });
    await listening;
    const exit = new Promise<number | null>(resolve => proc.on("exit", code => resolve(code)));
    proc.kill("SIGTERM");
    expect(await Promise.race([exit, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no exit")), 6000))])).toBe(0);
  });

  it("un port invalide fait échouer le démarrage avec un message clair", async () => {
    const { proc, listening } = start(["--transport", "http", "--port", "abc"]);
    listening.catch(() => {});
    let stderr = "";
    proc.stderr!.on("data", chunk => (stderr += chunk));
    const code = await new Promise<number | null>(resolve => proc.on("exit", resolve));
    expect(code).toBe(1);
    expect(stderr).toMatch(/Invalid port "abc"/);
  });
});
