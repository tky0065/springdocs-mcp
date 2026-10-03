import { describe, expect, it } from "vitest";
import { extractContent, pageMarkdown, scanFences } from "../src/services/markdown.js";
import { filterReleaseBody } from "../src/services/release-notes.js";
import { selectSections } from "../src/services/boot-wiki.js";

describe("scanFences (scanner commun)", () => {
  it("suit l'état au début de chaque ligne et repère les lignes de fence", () => {
    const scan = scanFences(["a", "```java", "x", "```", "b"]);
    expect(scan.map((l) => l.inCode)).toEqual([false, false, true, true, false]);
    expect(scan.map((l) => l.isFence)).toEqual([false, true, false, true, false]);
  });

  it("gère ~~~ comme ```", () => {
    const scan = scanFences(["~~~", "x", "~~~", "y"]);
    expect(scan.map((l) => l.inCode)).toEqual([false, true, true, false]);
  });

  it("une fermeture doit avoir au moins la longueur de l'ouverture", () => {
    const scan = scanFences(["````md", "```", "texte", "````", "fin"]);
    expect(scan.map((l) => l.inCode)).toEqual([false, true, true, true, false]);
  });

  it("une fermeture doit avoir le même caractère et ne rien porter d'autre", () => {
    const scan = scanFences(["```", "~~~", "``` java", "```", "fin"]);
    expect(scan.map((l) => l.inCode)).toEqual([false, true, true, true, false]);
  });

  it("l'état est exposé pour rouvrir/fermer un bloc coupé", () => {
    const scan = scanFences(["````xml", "<a/>"]);
    expect(scan[1].fence).toEqual({ char: "`", length: 4 });
  });
});

describe("extractContent avec fence de 4+ backticks", () => {
  it("referme avec une fence de même longueur", () => {
    const body = Array.from({ length: 600 }, (_, i) => `l${i}`).join("\n");
    const doc = "# T\n\n````md\n```java\nfoo\n```\n" + body + "\n````\nfin";
    const { content, truncated } = extractContent(doc, "summary");
    expect(truncated).toBe(true);
    expect(content.endsWith("\n````")).toBe(true);
  });

  it("une fence interne plus courte ne ferme pas le bloc externe", () => {
    const doc = "````md\n```\n" + "z\n".repeat(2000);
    const { content } = extractContent(doc, "summary");
    expect(content.endsWith("\n````")).toBe(true);
  });

  it("première ligne trop longue ouvrant une fence : fermeture de même longueur", () => {
    const doc = "````" + "x".repeat(5000) + "\nsuite";
    const { content } = extractContent(doc, "summary");
    expect(content.endsWith("\n````")).toBe(true);
  });
});

describe("pageMarkdown avec fence de 4+ backticks", () => {
  it("referme puis rouvre avec la même fence", () => {
    const doc = "````md\n```\n" + Array.from({ length: 200 }, (_, i) => `ligne ${i}`).join("\n") + "\n````\n";
    const first = pageMarkdown(doc, 0, 300);
    expect(first.content.endsWith("\n````")).toBe(true);
    const second = pageMarkdown(doc, first.nextOffset!, 300);
    expect(second.content.startsWith("````\n")).toBe(true);
  });
});

describe("filterReleaseBody et blocs de code", () => {
  it("new-features ignore un faux titre dans un bloc de code", () => {
    const body = "## New Features\n\n```bash\n# commentaire\nmvn x\n```\n\n* B\n\n## Bug Fixes\n\n* C";
    const out = filterReleaseBody(body, "new-features");
    expect(out).toContain("mvn x");
    expect(out).toContain("* B");
    expect(out).not.toContain("* C");
  });

  it("new-features : fence de 4 backticks contenant ``` et un titre", () => {
    const body = "## New Features\n\n````md\n```\n## Not a heading\n```\n````\n\n* B\n\n## Bug Fixes\n\n* C";
    const out = filterReleaseBody(body, "new-features");
    expect(out).toContain("* B");
    expect(out).not.toContain("* C");
  });

  it("deprecations garde une ligne de code qui ressemble à un titre", () => {
    const body = "```bash\n# deprecated flag\n```";
    expect(filterReleaseBody(body, "deprecations")).toBe("# deprecated flag");
  });
});

describe("selectSections avec fences longues", () => {
  it("ignore un titre dans un bloc ````", () => {
    const md = "## A\n\n````md\n```\n## Fake\n```\n````\n\n## B\n\ntexte";
    expect(() => selectSections(md, "fake", "G")).toThrow(/No section matching/);
  });
});
