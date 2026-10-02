import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

function bigHtml(): string {
  let body = "";
  for (let s = 0; s < 4; s++) {
    body += `<h2>Section ${s}</h2>`;
    for (let p = 0; p < 10; p++) body += `<p>${`mot${s}${p} `.repeat(30).trim()}.</p>`;
  }
  return `<main><h1>Intro</h1>${body}</main>`;
}

const cases = [
  {
    name: "getSpringReference",
    link: "For complete reference, visit:",
    title: /^# Spring Boot Reference: web/,
    call: (s: SpringBootDocsServiceOptimized, offset?: number) => s.getSpringReference("boot", "web", undefined, offset),
  },
  {
    name: "getSpringProject",
    link: "For complete project info, visit:",
    title: /^# spring-boot\n/,
    call: (s: SpringBootDocsServiceOptimized, offset?: number) => s.getSpringProject("spring-boot", offset),
  },
];

describe.each(cases)("pagination $name (#24)", ({ link, title, call }) => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async () => fakeResponse(200, bigHtml()));
  });
  afterEach(() => vi.restoreAllMocks());

  it("première page : pied de pagination et lien, sans ...", async () => {
    const text = await call(new SpringBootDocsServiceOptimized());
    expect(text).toContain("Partie 0–");
    expect(text).toMatch(/Pour la suite, rappeler avec offset=\d+/);
    expect(text).toContain(link);
    expect(text).not.toContain("...");
  });

  it("enchaîne les pages sans second fetch jusqu'à la dernière", async () => {
    const service = new SpringBootDocsServiceOptimized();
    let text = await call(service);
    let pages = 1;
    while (true) {
      const m = text.match(/Pour la suite, rappeler avec offset=(\d+)/);
      if (!m) break;
      text = await call(service, Number(m[1]));
      expect(text).toMatch(title);
      pages++;
      expect(pages).toBeLessThan(50);
    }
    expect(pages).toBeGreaterThan(1);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(text).not.toContain("Pour la suite");
    expect(text).not.toContain("...");
    expect(text).toContain(link);
  });

  it("offset hors borne : message clair sans exception", async () => {
    const text = await call(new SpringBootDocsServiceOptimized(), 1_000_000_000);
    expect(text).toContain("No content at offset 1000000000 (total: ");
  });

  it("petit document : ni Partie ni ...", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, "<main><h1>Petit</h1><p>contenu</p></main>"));
    const text = await call(new SpringBootDocsServiceOptimized());
    expect(text).not.toContain("Partie");
    expect(text).not.toContain("...");
    expect(text).toContain(link);
  });
});
