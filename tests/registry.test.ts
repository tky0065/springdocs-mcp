import { describe, expect, it } from "vitest";
import { SpringProjectsConfig, springProjectsConfig } from "../src/services/spring-projects-config.js";
import { ToolDefinitions } from "../src/tools/index.js";

const EXPECTED: Array<[string, string, string | undefined, string]> = [
  ["security", "servlet", undefined, "https://docs.spring.io/spring-security/reference/servlet/index.html"],
  ["security", "authentication", undefined, "https://docs.spring.io/spring-security/reference/servlet/authentication/index.html"],
  ["security", "testing", undefined, "https://docs.spring.io/spring-security/reference/servlet/test/index.html"],
  ["security", "servlet", "architecture", "https://docs.spring.io/spring-security/reference/servlet/architecture.html"],
  ["batch", "job", undefined, "https://docs.spring.io/spring-batch/reference/job.html"],
  ["batch", "step", "chunk-oriented-processing", "https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing.html"],
  ["integration", "channel", undefined, "https://docs.spring.io/spring-integration/reference/channel.html"],
  ["kafka", "retrytopic", undefined, "https://docs.spring.io/spring-kafka/reference/retrytopic.html"],
  ["modulith", "events", undefined, "https://docs.spring.io/spring-modulith/reference/events.html"],
  ["data-jpa", "jpa", "query-methods", "https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html"],
  ["data-jpa", "repositories", "core-concepts", "https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html"],
  ["cloud-gateway", "spring-cloud-gateway-server-webflux", undefined, "https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux.html"],
  ["cloud-config", "server", "environment-repository", "https://docs.spring.io/spring-cloud-config/reference/server/environment-repository.html"],
];

describe("registre de projets (#32)", () => {
  it.each(EXPECTED)("%s/%s/%s -> URL vérifiée", (project, section, subsection, url) => {
    expect(springProjectsConfig.buildReferenceUrl(project, section, subsection)).toBe(url);
  });

  it("n'inclut aucune version dans les URLs de référence", () => {
    for (const project of springProjectsConfig.getAllProjects()) {
      for (const section of project.referenceSections ?? []) {
        expect(springProjectsConfig.buildReferenceUrl(project.id, section)).not.toMatch(/\/\d+\.\d+(\.\d+)?\//);
      }
    }
  });

  it("refuse une section inconnue en listant les sections disponibles", () => {
    expect(springProjectsConfig.validateSection("kafka", "nope")).toBe(false);
    expect(springProjectsConfig.validateSection("kafka", "retrytopic")).toBe(true);
  });

  it("l'enum project du schéma get_spring_reference égale les ids du registre", () => {
    const tool = (ToolDefinitions.getToolList() as any[]).find((t) => t.name === "get_spring_reference");
    const schemaIds: string[] = tool.inputSchema.properties.project.enum;
    expect([...schemaIds].sort()).toEqual([...springProjectsConfig.getAllProjectIds()].sort());
    expect(schemaIds).toEqual(["boot", "ai", "framework", "security", "data-jpa", "batch", "integration", "kafka", "modulith", "cloud-gateway", "cloud-config"]);
  });

  it("ne renseigne pas latestVersion pour les nouveaux projets", () => {
    for (const id of ["security", "batch", "integration", "kafka", "modulith", "data-jpa", "cloud-gateway", "cloud-config"]) {
      expect(springProjectsConfig.getProject(id).latestVersion).toBeUndefined();
    }
  });

  it("un registre construit avec un Map vide ne connaît aucun projet", () => {
    expect(() => new SpringProjectsConfig(new Map()).getProject("boot")).toThrow(/Unknown Spring project/);
  });
});
