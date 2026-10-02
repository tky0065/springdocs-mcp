import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ToolDefinitions } from "../src/tools/index.js";
// @ts-expect-error module JS sans déclaration de types
import { buildDockerTools } from "../scripts/docker-tools.js";

describe("docker/tools.json (#29)", () => {
  it("est synchronisé avec les définitions de tools (régénérer avec: npm run build && npm run docker:tools)", () => {
    const committed = JSON.parse(readFileSync(new URL("../docker/tools.json", import.meta.url), "utf-8"));
    expect(committed).toEqual(buildDockerTools(ToolDefinitions.getToolList()));
  });
});
