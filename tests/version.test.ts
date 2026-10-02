import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { USER_AGENT, VERSION } from "../src/version.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("version", () => {
  it("is read from package.json", () => {
    expect(VERSION).toBe(pkg.version);
  });

  it("derives the User-Agent from it", () => {
    expect(USER_AGENT).toBe(`Spring-Docs-MCP/${pkg.version}`);
  });
});
