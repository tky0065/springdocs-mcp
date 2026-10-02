import { describe, expect, it } from "vitest";
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";

describe("validateToolArguments (#18)", () => {
  it("traite des arguments absents comme un objet vide, donc signale les paramètres requis", () => {
    expect(() => validateToolArguments("get_spring_guide", undefined)).toThrow(/'guideId'.*required/i);
    expect(() => validateToolArguments("search_spring_docs", null)).toThrow(/'query'.*required/i);
  });

  it("accepte l'absence d'arguments quand rien n'est requis", () => {
    expect(validateToolArguments("get_all_spring_guides", undefined)).toEqual({});
  });

  it("refuse des arguments qui ne sont pas un objet", () => {
    expect(() => validateToolArguments("search_spring_docs", "boot")).toThrow(/must be an object/);
    expect(() => validateToolArguments("search_spring_docs", ["boot"])).toThrow(/must be an object/);
  });

  it("refuse un type incorrect en nommant le champ", () => {
    expect(() => validateToolArguments("search_spring_docs", { query: 42 })).toThrow(/'query'.*string/);
    expect(() => validateToolArguments("search_spring_docs", { query: "x", limit: "10" })).toThrow(/'limit'.*number/);
    expect(() => validateToolArguments("search_spring_docs", { query: "x", limit: Number.NaN })).toThrow(/'limit'/);
  });

  it("refuse une chaîne requise vide", () => {
    expect(() => validateToolArguments("search_spring_docs", { query: "" })).toThrow(/'query'/);
  });

  it("refuse une chaîne trop longue", () => {
    expect(() => validateToolArguments("search_spring_docs", { query: "a".repeat(201) })).toThrow(/'query'.*200/);
    expect(validateToolArguments("search_spring_docs", { query: "a".repeat(200) }).query).toHaveLength(200);
  });

  it("refuse une valeur hors enum en listant les valeurs permises", () => {
    expect(() => validateToolArguments("get_spring_guide", { guideId: "x", detail_level: "huge" }))
      .toThrow(/'detail_level'.*summary, medium, full/);
  });

  it("borne limit à [minimum, maximum] et à un entier", () => {
    expect(validateToolArguments("search_spring_docs", { query: "x", limit: 1000 }).limit).toBe(50);
    expect(validateToolArguments("search_spring_docs", { query: "x", limit: -5 }).limit).toBe(1);
    expect(validateToolArguments("search_spring_docs", { query: "x", limit: 3.7 }).limit).toBe(3);
    expect(validateToolArguments("search_spring_projects", { query: "x", limit: 1000 }).limit).toBe(20);
  });

  it("ignore les arguments inconnus et traite null comme absent", () => {
    expect(validateToolArguments("get_all_spring_guides", { category: null, evil: "x" })).toEqual({});
  });

  it("rejette un outil inconnu", () => {
    expect(() => validateToolArguments("nope", {})).toThrow(/Unknown tool: nope/);
  });

  it("valide chacun des 15 tools avec ses seuls paramètres requis", () => {
    for (const tool of ToolDefinitions.getToolList() as any[]) {
      const minimal = Object.fromEntries((tool.inputSchema.required ?? []).map((name: string) =>
        [name, tool.inputSchema.properties[name].enum?.[0] ?? "valeur"]));
      expect(() => validateToolArguments(tool.name, minimal), tool.name).not.toThrow();
    }
  });
});

describe("bornes déclarées dans les schémas de tools (#18)", () => {
  it("chaque paramètre string sans enum déclare un maxLength", () => {
    for (const tool of ToolDefinitions.getToolList() as any[]) {
      for (const [name, prop] of Object.entries<any>(tool.inputSchema.properties)) {
        if (prop.type === "string" && !prop.enum) {
          expect(prop.maxLength, `${tool.name}.${name}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
