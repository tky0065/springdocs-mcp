import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { ToolDefinitions } from "../src/tools/index.js";

const html = readFileSync(new URL("../docs/index.html", import.meta.url), "utf-8");
const $ = cheerio.load(html);

describe("landing docs/index.html (#45)", () => {
  it("déclare la langue du document", () => {
    expect($("html").attr("lang")).toBeTruthy();
  });

  it("a une meta description non vide", () => {
    expect(($('meta[name="description"]').attr("content") ?? "").trim().length).toBeGreaterThan(50);
  });

  it("a exactement un <main> et un lien d'évitement qui le cible", () => {
    expect($("main").length).toBe(1);
    const id = $("main").attr("id");
    expect(id).toBeTruthy();
    expect($("body a[href]").first().attr("href")).toBe(`#${id}`);
  });

  it("respecte prefers-reduced-motion", () => {
    expect(html).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("affiche autant de cartes de tools que de tools définis", () => {
    const names = ToolDefinitions.getToolList().map((t: { name: string }) => t.name);
    const shown = $(".tool h3")
      .map((_, el) => $(el).clone().children().remove().end().text().trim())
      .get();
    expect([...shown].sort()).toEqual([...names].sort());
  });

  it("ne mentionne plus 12 tools", () => {
    expect(html).not.toMatch(/\b12 (powerful|available)? ?tools/i);
    expect(html).not.toMatch(/All 12/);
  });
});

describe("landing : faits dérivés de la source de vérité (groupe I)", () => {
  const names = ToolDefinitions.getToolList().map((t: { name: string }) => t.name);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

  it("annonce le nombre réel de tools partout", () => {
    const counts = [...html.matchAll(/\b(\d+) (?:powerful |available )?tools\b/gi)].map((m) => Number(m[1]));
    expect(counts.length).toBeGreaterThan(0);
    for (const c of counts) expect(c).toBe(names.length);
  });

  it("les titres de section (N) correspondent au nombre de cartes", () => {
    const original = Number(/Enhanced Original Tools \((\d+)\)/.exec(html)?.[1]);
    const advanced = Number(/Advanced New Tools \((\d+)\)/.exec(html)?.[1]);
    expect(original + advanced).toBe($(".tool").length);
    const idx = html.indexOf("Advanced New Tools");
    expect((html.slice(idx).match(/class="tool"/g) ?? []).length).toBe(advanced);
  });

  it("la bannière, le badge et le pied affichent la version de package.json", () => {
    expect($(".version-badge").text().trim()).toBe(`v${pkg.version}`);
    expect($(".update-banner").text()).toContain(`v${pkg.version}`);
    expect($("footer").text()).toContain(`v${pkg.version}`);
  });

  it("déclare un favicon inline (pas de 404 sur favicon.ico)", () => {
    expect($('link[rel="icon"]').attr("href") ?? "").toMatch(/^data:image\/svg\+xml,/);
  });
});
