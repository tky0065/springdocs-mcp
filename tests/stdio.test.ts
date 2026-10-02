import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const ENTRY = fileURLToPath(new URL("../build/index.js", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** Talks JSON-RPC to the real server over stdio. */
class Client {
  private nextId = 0;
  private buffer = "";
  private pending = new Map<number, (message: any) => void>();
  private process: ChildProcessWithoutNullStreams;

  constructor() {
    this.process = spawn("node", [ENTRY], { stdio: ["pipe", "pipe", "ignore"] });
    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let newline: number;
      while ((newline = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line); // throws if anything but JSON-RPC reaches stdout
        this.pending.get(message.id)?.(message);
      }
    });
  }

  request(method: string, params: unknown): Promise<any> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 8000);
      this.pending.set(id, (message) => { clearTimeout(timer); resolve(message); });
      this.process.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  notify(method: string) {
    this.process.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
  }

  async initialize(protocolVersion: string) {
    const response = await this.request("initialize", {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "vitest", version: "0" },
    });
    this.notify("notifications/initialized");
    return response;
  }

  close() {
    this.process.kill();
  }
}

let client: Client;

beforeAll(() => {
  if (!existsSync(ENTRY)) throw new Error("build/index.js is missing: run `npm test` (it builds first)");
});
afterEach(() => client?.close());

describe("MCP server over stdio", () => {
  it.each(["2024-11-05", "2025-06-18"])("negotiates protocol %s and announces the package version", async (protocol) => {
    client = new Client();
    const response = await client.initialize(protocol);

    expect(response.result.protocolVersion).toBe(protocol);
    expect(response.result.serverInfo.version).toBe(pkg.version);
  });

  it("lists the 16 tools with object input schemas", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const { result } = await client.request("tools/list", {});

    expect(result.tools).toHaveLength(16);
    for (const tool of result.tools) expect(tool.inputSchema.type).toBe("object");
  });

  it("spring_cache_stats répond sans réseau", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const { result } = await client.request("tools/call", { name: "spring_cache_stats", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Entries: 0 / 500");
  });

  it("reports invalid tool arguments as isError", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const { result } = await client.request("tools/call", { name: "search_spring_docs", arguments: {} });

    expect(result.isError).toBe(true);
  });

  it("reports an unknown tool as an error", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const response = await client.request("tools/call", { name: "nope", arguments: {} });

    expect(response.error ?? response.result?.isError).toBeTruthy();
  });
});

describe("validation des arguments via stdio (#18)", () => {
  it("nomme le paramètre manquant quand arguments est absent", async () => {
    client = new Client();
    await client.initialize("2024-11-05");
    const { result } = await client.request("tools/call", { name: "get_spring_guide" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/guideId/);
  });
});

describe("arrêt propre (#38)", () => {
  it.each(["SIGTERM", "SIGINT"] as const)("sort avec le code 0 sur %s sans polluer stdout", async (signal) => {
    const child = spawn("node", [ENTRY], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    // Wait until the server is up (it logs on stderr), then ask it to stop.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("server did not start")), 8000);
      child.stderr.once("data", () => { clearTimeout(timer); resolve(); });
    });

    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
      child.on("exit", (code, sig) => resolve({ code, signal: sig })));
    child.kill(signal);
    const result = await Promise.race([
      exit,
      new Promise<never>((_, reject) => setTimeout(() => { child.kill("SIGKILL"); reject(new Error("no exit after signal")); }, 5000)),
    ]);

    expect(result).toEqual({ code: 0, signal: null });
    expect(stderr).toContain(signal);
    for (const line of stdout.split("\n").filter(Boolean)) expect(() => JSON.parse(line)).not.toThrow();
  });
});
