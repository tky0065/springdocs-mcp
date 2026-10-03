import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { fetchWithRetry } from "../src/services/http.js";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const TOKEN = "ghp_secrettoken123";
const authOf = (call: unknown[]) => (call[1] as any).headers.Authorization;
const messageOf = (outcome: { ok: boolean; error?: unknown }) => (outcome.error as Error).message;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("GITHUB_TOKEN", TOKEN);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GITHUB_TOKEN", () => {
  it("est envoyé sur api.github.com", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "{}"));
    await settle(fetchWithRetry("https://api.github.com/repos/x/y/releases"));
    expect(authOf(mockedFetch.mock.calls[0])).toBe(`Bearer ${TOKEN}`);
  });

  it("n'est jamais envoyé sur un autre hôte, même autorisé", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "ok"));
    for (const url of ["https://docs.spring.io/a", "https://github.com/a", "https://raw.githubusercontent.com/a"]) {
      await settle(fetchWithRetry(url));
    }
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    for (const call of mockedFetch.mock.calls) expect(authOf(call)).toBeUndefined();
  });

  it("n'est pas suivi après une redirection hors api.github.com", async () => {
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(302, "", { location: "https://raw.githubusercontent.com/x" }))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    await settle(fetchWithRetry("https://api.github.com/repos/x/y"));
    expect(authOf(mockedFetch.mock.calls[0])).toBe(`Bearer ${TOKEN}`);
    expect(authOf(mockedFetch.mock.calls[1])).toBeUndefined();
  });

  it("est absent quand la variable est vide", async () => {
    vi.stubEnv("GITHUB_TOKEN", "  ");
    mockedFetch.mockResolvedValue(fakeResponse(200, "{}"));
    await settle(fetchWithRetry("https://api.github.com/repos/x/y"));
    expect(authOf(mockedFetch.mock.calls[0])).toBeUndefined();
  });

  it("n'apparaît dans aucun log ni message d'erreur", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(500, "boom"));
    const outcome = await settle(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5.0"));
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify((console.error as any).mock.calls)).not.toContain(TOKEN);
    expect(messageOf(outcome as any)).not.toContain(TOKEN);
  });
});

describe("limite de débit GitHub", () => {
  it("ne dort pas sur une limite de débit : échec immédiat et message clair", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    mockedFetch.mockResolvedValue(fakeResponse(429, "", { "retry-after": "3600", "x-ratelimit-remaining": "0" }));
    const outcome = await settle(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5.0"));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(false);
    const message = messageOf(outcome as any);
    expect(message).toMatch(/rate limit/i);
    expect(message).toContain("GITHUB_TOKEN");
    expect(message).toMatch(/3600 seconds/);
  });

  it("avec un jeton, le message ne suggère pas d'en définir un", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(403, "", { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1790000000" }));
    const outcome = await settle(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5.0"));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const message = messageOf(outcome as any);
    expect(message).toMatch(/rate limit/i);
    expect(message).not.toContain(TOKEN);
    expect(message).not.toMatch(/set GITHUB_TOKEN/i);
  });

  it("compare_spring_versions remonte aussi le message de limite de débit", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(403, "", { "retry-after": "60" }));
    const outcome = await settle(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0"));
    expect(messageOf(outcome as any)).toMatch(/rate limit/i);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("hors GitHub, le comportement 429 + Retry-After reste inchangé", async () => {
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(429, "", { "retry-after": "2" }))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    const outcome = await settle(fetchWithRetry("https://docs.spring.io/x"));
    expect(outcome.ok).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});
