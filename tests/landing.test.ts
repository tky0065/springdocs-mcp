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
