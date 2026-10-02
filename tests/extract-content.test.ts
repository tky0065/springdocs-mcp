import { describe, expect, it } from "vitest";
import { DETAIL_LIMITS, extractContent } from "../src/services/markdown.js";

const fences = (text: string) => text.split("\n").filter((l) => l.trim().startsWith("```")).length;

describe("extractContent (#25)", () => {
  it("rend un document sous la limite tel quel", () => {
    const doc = "# Titre\n\ntexte\n";
    expect(extractContent(doc, "summary")).toEqual({ content: doc, truncated: false });
  });

  it("utilise medium pour un niveau inconnu", () => {
    const doc = "a\n".repeat(3000); // 6000 caractères
    const { content } = extractContent(doc, "nope");
    expect(content.length).toBeLessThanOrEqual(DETAIL_LIMITS.medium + 4);
  });

  it("garde les lignes vides entre paragraphes", () => {
    const doc = ("paragraphe un\n\nparagraphe deux\n\n").repeat(200);
    const { content, truncated } = extractContent(doc, "summary");
    expect(truncated).toBe(true);
    expect(content).toContain("paragraphe un\n\nparagraphe deux\n\n");
  });

  it("ne supprime plus un gros bloc de code : il est coupé et refermé", () => {
    const code = Array.from({ length: 200 }, (_, i) => `line${i} = ${i};`).join("\n");
    const doc = `# Guide\n\n\`\`\`java\n${code}\n\`\`\`\n\nfin`;
    const { content, truncated } = extractContent(doc, "summary");
    expect(truncated).toBe(true);
    expect(content).toContain("```java\nline0 = 0;");
    expect(fences(content) % 2).toBe(0);
    expect(content.length).toBeLessThanOrEqual(DETAIL_LIMITS.summary + 4);
  });

  it("produit du markdown bien formé pour un bloc non fermé en source", () => {
    const doc = `# Guide\n\n\`\`\`xml\n${"<a/>\n".repeat(1000)}`;
    const { content } = extractContent(doc, "summary");
    expect(fences(content) % 2).toBe(0);
  });

  it("ne coupe jamais une ligne en deux", () => {
    const doc = Array.from({ length: 400 }, (_, i) => `ligne numéro ${i}`).join("\n");
    const { content } = extractContent(doc, "summary");
    for (const line of content.split("\n")) expect(doc.split("\n")).toContain(line);
  });

  it("rend un guide de 20000 caractères en entier en full", () => {
    const doc = "x".repeat(99) + "\n";
    const big = doc.repeat(200); // 20000 caractères
    expect(extractContent(big, "full")).toEqual({ content: big, truncated: false });
  });

  it("marque truncated même quand la fermeture rend la sortie plus longue", () => {
    const doc = "```\n" + "y\n".repeat(DETAIL_LIMITS.summary / 2);
    expect(extractContent(doc, "summary").truncated).toBe(true);
  });
});

describe("extractContent, première ligne trop longue (#25)", () => {
  it("coupe dur la première ligne au lieu de rendre un contenu vide", () => {
    const doc = "x".repeat(5000) + "\nsuite";
    const { content, truncated } = extractContent(doc, "summary");
    expect(content.length).toBeGreaterThan(0);
    expect(content.length).toBeLessThanOrEqual(DETAIL_LIMITS.summary + 4);
    expect(truncated).toBe(true);
  });
});
