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
