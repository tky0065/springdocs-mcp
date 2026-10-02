import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageMarkdown } from "../src/services/markdown.js";

const strip = (c: string) => c.replace(/^```\n/, "").replace(/\n```$/, "");

function allPages(doc: string, size: number) {
  const pages = [];
  let offset = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const page = pageMarkdown(doc, offset, size);
    pages.push(page);
    if (page.nextOffset === null) return pages;
    expect(page.nextOffset).toBeGreaterThan(offset);
    offset = page.nextOffset;
  }
  throw new Error("pagination does not terminate");
}

describe("pageMarkdown (#24)", () => {
  it("rend un petit document en une page sans suite", () => {
    const doc = "# T\n\ntexte";
    expect(pageMarkdown(doc)).toEqual({ content: doc, start: 0, end: doc.length, nextOffset: null, total: doc.length });
  });

  it("enchaîner les pages reconstitue le document", () => {
    const doc = Array.from({ length: 300 }, (_, i) => (i % 20 === 0 ? `## Section ${i}` : `ligne ${i} avec du texte`)).join("\n");
    const pages = allPages(doc, 500);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.map((p) => doc.slice(p.start, p.end)).join("")).toBe(doc);
  });

  it("préfère couper juste avant un titre", () => {
    const body = "mot ".repeat(120).trim(); // ~479 caractères sur une ligne
    const doc = `${body}\n\n## Suite\n${body}\n`;
    const page = pageMarkdown(doc, 0, 600);
    expect(doc.slice(page.end).startsWith("## Suite")).toBe(true);
  });

  it("referme un bloc de code coupé et le rouvre sur la page suivante", () => {
    const code = Array.from({ length: 200 }, (_, i) => `int v${i} = ${i};`).join("\n");
    const doc = `\`\`\`java\n${code}\n\`\`\`\n`;
    const [first, second] = allPages(doc, 600);
    expect(first.content.endsWith("\n```")).toBe(true);
    expect(second.content.startsWith("```\n")).toBe(true);
  });

  it("ne coupe pas un bloc de code quand un titre précède dans la fenêtre", () => {
    const doc = `${"a\n".repeat(150)}## Code\n\`\`\`\n${"b\n".repeat(150)}\`\`\`\n`;
    const page = pageMarkdown(doc, 0, 600);
    expect(doc.slice(page.end).startsWith("## Code")).toBe(true);
  });

  it("termine même avec une ligne géante sans saut de ligne", () => {
    const doc = "x".repeat(2500);
    const pages = allPages(doc, 1000);
    expect(pages.map((p) => doc.slice(p.start, p.end)).join("")).toBe(doc);
  });

  it("rend une page vide sans suite quand l'offset dépasse la fin", () => {
    const doc = "abc";
    expect(pageMarkdown(doc, 10)).toEqual({ content: "", start: 10, end: 10, nextOffset: null, total: 3 });
  });

  it("utilise PAGE_SIZE par défaut", () => {
    const doc = "ligne\n".repeat(2000);
    const page = pageMarkdown(doc);
    expect(page.end - page.start).toBeLessThanOrEqual(PAGE_SIZE);
    expect(strip(page.content).length).toBeLessThanOrEqual(PAGE_SIZE);
  });
});
