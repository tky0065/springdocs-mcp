import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { validateToolArguments } from "../src/validation.js";
import { fakeResponse, fixture } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const GUIDE = fixture("boot-wiki-migration-guide.html");
const HOME = fixture("boot-wiki-home.html");
const BASE = "https://github.com/spring-projects/spring-boot/wiki/";

const asReleaseNotes = (html: string, version: string) =>
  html.replace(/<title>[^<]*<\/title>/, `<title>Spring Boot ${version} Release Notes · spring-projects/spring-boot Wiki · GitHub</title>`);

/** Same page with enough extra paragraphs to exceed one 4000-character page. */
const bigGuide = () =>
  GUIDE.replace('<div class="markdown-body">', `<div class="markdown-body">${"<p>Paragraphe de remplissage pour la pagination.</p>".repeat(300)}`);

describe("get_migration_guide (#35)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE));
  });
  afterEach(() => vi.restoreAllMocks());

  it("3.0 -> Migration Guide du wiki", async () => {
    const out = await new SpringBootDocsServiceOptimized().getMigrationGuide("3.0");
    expect(mockedFetch.mock.calls[0][0]).toBe(`${BASE}Spring-Boot-3.0-Migration-Guide`);
    expect(out).toContain("Spring Boot 3.0 Migration Guide");
    expect(out).toContain("## Before You Start");
    expect(out).toContain(`${BASE}Spring-Boot-3.0-Migration-Guide`);
  });

  it("3.4 -> Release Notes ; 3.4.2 equivaut a 3.4 ; document explicite prioritaire", async () => {
    mockedFetch.mockImplementation(async (url: string) =>
      fakeResponse(200, url.endsWith("Migration-Guide") ? asMigration34() : asReleaseNotes(GUIDE, "3.4")));
    const service = new SpringBootDocsServiceOptimized();
    await service.getMigrationGuide("3.4");
    expect(mockedFetch.mock.calls[0][0]).toBe(`${BASE}Spring-Boot-3.4-Release-Notes`);
    await service.getMigrationGuide("3.4.2");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await service.getMigrationGuide("3.4", "migration-guide");
    expect(mockedFetch.mock.calls[1][0]).toBe(`${BASE}Spring-Boot-3.4-Migration-Guide`);
  });

  it("page absente (accueil du wiki) -> rejet, rien en cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, HOME));
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getMigrationGuide("3.1")).rejects.toThrow("page not found");
    await expect(service.getMigrationGuide("3.1")).rejects.toThrow("page not found");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("section filtre les titres ; section inconnue liste les titres", async () => {
    const service = new SpringBootDocsServiceOptimized();
    const out = await service.getMigrationGuide("3.0", "auto", "jakarta");
    expect(out).toContain("Jakarta EE");
    expect(out).toContain("(section: jakarta)");
    expect(out).not.toContain("Web Application Changes");
    await expect(service.getMigrationGuide("3.0", "auto", "zzz")).rejects.toThrow(/Available sections:.*Before You Start/);
  });

  it("section vide ou en espaces = aucun filtre", async () => {
    const service = new SpringBootDocsServiceOptimized();
    const out = await service.getMigrationGuide("3.0", "auto", "   ");
    expect(out).toContain("Web Application Changes");
    expect(out).not.toContain("(section:");
    const empty = await service.getMigrationGuide("3.0", "auto", "");
    expect(empty).toContain("Web Application Changes");
  });

  it("section et offset differents -> un seul fetch", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.getMigrationGuide("3.0", "auto", "jakarta");
    await service.getMigrationGuide("3.0");
    await service.getMigrationGuide("3.0", "auto", undefined, 10);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("pagination : pied Partie et page suivante sans fetch", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, bigGuide()));
    const service = new SpringBootDocsServiceOptimized();
    const first = await service.getMigrationGuide("3.0");
    expect(first).toContain("Partie 0–");
    const next = /offset=(\d+)/.exec(first)![1];
    const second = await service.getMigrationGuide("3.0", "auto", undefined, Number(next));
    expect(second).toContain(`Partie ${next}–`);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it.each(["../x", "3", "3.x", "v3.0", " 3.0", "current", ""])("version invalide %j -> rejet sans fetch", async (version) => {
    await expect(new SpringBootDocsServiceOptimized().getMigrationGuide(version)).rejects.toThrow();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each([404, 500])("HTTP %i -> rejet, non cache", async (status) => {
    mockedFetch.mockImplementation(async () => fakeResponse(status, "nope"));
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getMigrationGuide("3.0")).rejects.toThrow("Failed to fetch Spring Boot wiki page");
    mockedFetch.mockClear();
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE));
    await expect(service.getMigrationGuide("3.0")).resolves.toContain("Before You Start");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});

function asMigration34(): string {
  return GUIDE.replace(/<title>[^<]*<\/title>/, "<title>Spring Boot 3.4 Migration Guide · spring-projects/spring-boot Wiki · GitHub</title>");
}

describe("validation de get_migration_guide (#35)", () => {
  it("version requise, enum et bornes", () => {
    expect(() => validateToolArguments("get_migration_guide", {})).toThrow();
    expect(() => validateToolArguments("get_migration_guide", { version: "3.0" })).not.toThrow();
    expect(() => validateToolArguments("get_migration_guide", { version: "3.0", document: "nope" })).toThrow();
    expect(() => validateToolArguments("get_migration_guide", { version: "3.0", section: "x".repeat(51) })).toThrow();
  });
});

describe("get_migration_guide via stdio (#35)", () => {
  const ENTRY = fileURLToPath(new URL("../build/index.js", import.meta.url));

  function rpc(messages: object[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const child = spawn("node", [ENTRY], { stdio: ["pipe", "pipe", "ignore"] });
      const out: any[] = [];
      let buffer = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 8000);
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          out.push(JSON.parse(line));
          if (out.length === messages.filter((m: any) => m.id !== undefined).length) {
            clearTimeout(timer);
            child.kill();
            resolve(out);
          }
        }
      });
      for (const m of messages) child.stdin.write(JSON.stringify(m) + "\n");
    });
  }

  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } };
  const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };

  it("liste 17 tools dont get_migration_guide", async () => {
    const responses = await rpc([init, initialized, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }]);
    const list = responses.find((r) => r.id === 2).result.tools;
    expect(list).toHaveLength(17);
    expect(list.map((t: any) => t.name)).toContain("get_migration_guide");
  });

  it("version invalide -> isError sans reseau", async () => {
    const responses = await rpc([init, initialized,
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_migration_guide", arguments: { version: "../x" } } }]);
    const result = responses.find((r) => r.id === 2).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid version");
  });
});
