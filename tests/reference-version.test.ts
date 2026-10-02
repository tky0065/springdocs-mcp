import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { validateToolArguments } from "../src/validation.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const PAGE = "<main><h1>Web</h1><p>contenu</p></main>";

describe("get_spring_reference avec version (#34)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async () => fakeResponse(200, PAGE));
  });
  afterEach(() => vi.restoreAllMocks());

  it("version 3.4.2 -> URL versionnée 3.4", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.getSpringReference("boot", "web", undefined, 0, "3.4.2");
    expect(mockedFetch.mock.calls[0][0]).toBe("https://docs.spring.io/spring-boot/3.4/reference/web/index.html");
  });

  it("sans version, l'URL est inchangée", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.getSpringReference("boot", "web");
    expect(mockedFetch.mock.calls[0][0]).toBe("https://docs.spring.io/spring-boot/reference/web/index.html");
  });

  it("le cache est distinct par version", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.getSpringReference("boot", "web", undefined, 0, "3.3");
    await service.getSpringReference("boot", "web", undefined, 0, "3.4");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    await service.getSpringReference("boot", "web", undefined, 0, "3.4");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("version absente puis 3.4 -> deux fetch", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.getSpringReference("boot", "web");
    await service.getSpringReference("boot", "web", undefined, 0, "3.4");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("404 avec version -> message dédié", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "nope"));
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getSpringReference("boot", "web", undefined, 0, "3.0")).rejects.toThrow(
      "Reference not found for Spring Boot version 3.0",
    );
  });

  it("404 sans version -> message actuel", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "nope"));
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getSpringReference("boot", "web")).rejects.toThrow(
      "Reference section not found: Spring Boot / web",
    );
  });

  it("version invalide -> rejet sans appel réseau", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getSpringReference("boot", "web", undefined, 0, "3.4-SNAPSHOT")).rejects.toThrow("Invalid version");
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("schéma et handler de get_spring_reference (#34)", () => {
  it("le schéma accepte version et refuse plus de 20 caractères", () => {
    expect(validateToolArguments("get_spring_reference", { section: "web", version: "3.4" }).version).toBe("3.4");
    expect(() =>
      validateToolArguments("get_spring_reference", { section: "web", version: "1".repeat(21) }),
    ).toThrow(/too long/);
  });

  it("le handler transmet la version au service (version invalide rejetée via stdio, sans réseau)", async () => {
    const entry = fileURLToPath(new URL("../build/index.js", import.meta.url));
    const child = spawn("node", [entry], { stdio: ["pipe", "pipe", "ignore"] });
    try {
      const lines = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 8000);
        let buffer = "";
        child.stdout.on("data", (chunk) => {
          buffer += chunk;
          for (const line of buffer.split("\n")) {
            if (!line.trim()) continue;
            const message = JSON.parse(line);
            if (message.id === 2) { clearTimeout(timer); resolve(message); }
          }
        });
      });
      const send = (m: object) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
      send({ id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "vitest", version: "0" } } });
      send({ method: "notifications/initialized" });
      send({ id: 2, method: "tools/call", params: { name: "get_spring_reference", arguments: { section: "web", version: "3.4-SNAPSHOT" } } });
      const { result } = await lines;
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Invalid version/);
    } finally {
      child.kill();
    }
  });
});
