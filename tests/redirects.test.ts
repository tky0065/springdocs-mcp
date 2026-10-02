import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { fetchWithRetry, ALLOWED_REDIRECT_HOSTS, MAX_RESPONSE_BYTES } from "../src/services/http.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse, fixture, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const START = "https://docs.spring.io/spring-boot/index.html";
const redirect = (location: string, status = 302) => fakeResponse(status, "", { location });
const errorOf = (outcome: { ok: boolean; error?: unknown }) => (outcome.ok ? "" : (outcome.error as Error).message);

describe("redirections suivies manuellement (#39)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exporte l'allowlist d'hôtes", () => {
    expect([...ALLOWED_REDIRECT_HOSTS].sort()).toEqual(
      ["api.github.com", "docs.spring.io", "github.com", "raw.githubusercontent.com", "spring.io"],
    );
  });

  it("désactive le suivi automatique de node-fetch et garde size", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "ok"));
    await fetchWithRetry(START);
    expect(mockedFetch).toHaveBeenCalledWith(START, expect.objectContaining({ redirect: "manual", size: MAX_RESPONSE_BYTES }));
  });

  it.each([301, 302, 303, 307, 308])("suit une redirection %i avec Location absolue", async (status) => {
    mockedFetch
      .mockResolvedValueOnce(redirect("https://spring.io/projects/spring-boot", status))
      .mockResolvedValueOnce(fakeResponse(200, "final"));
    const result = await fetchWithRetry(START);
    expect(await result.text()).toBe("final");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(mockedFetch.mock.calls[1][0]).toBe("https://spring.io/projects/spring-boot");
    expect(mockedFetch.mock.calls[1][1]).toEqual(expect.objectContaining({ redirect: "manual", size: MAX_RESPONSE_BYTES }));
  });

  it("résout une Location relative contre l'URL courante", async () => {
    mockedFetch
      .mockResolvedValueOnce(redirect("/spring-boot/reference/index.html"))
      .mockResolvedValueOnce(redirect("other.html"))
      .mockResolvedValueOnce(fakeResponse(200, "final"));
    const result = await fetchWithRetry(START);
    expect(await result.text()).toBe("final");
    expect(mockedFetch.mock.calls[1][0]).toBe("https://docs.spring.io/spring-boot/reference/index.html");
    expect(mockedFetch.mock.calls[2][0]).toBe("https://docs.spring.io/spring-boot/reference/other.html");
  });

  it("n'accepte que les hôtes exacts de l'allowlist (pas de sous-domaine ni de suffixe)", async () => {
    for (const bad of ["https://evil.example/x", "https://docs.spring.io.evil.example/x", "https://sub.spring.io/x"]) {
      mockedFetch.mockReset();
      mockedFetch.mockResolvedValueOnce(redirect(bad));
      const outcome = await settle(fetchWithRetry(START));
      expect(errorOf(outcome)).toMatch(/Redirect to disallowed host/);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    }
  });

  it("refuse une redirection vers http: (même hôte autorisé), sans retry", async () => {
    mockedFetch.mockResolvedValue(redirect("http://docs.spring.io/x"));
    const outcome = await settle(fetchWithRetry(START));
    expect(errorOf(outcome)).toMatch(/Redirect to disallowed protocol/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("autorise exactement 5 sauts mais refuse le 6e, sans retry", async () => {
    for (let i = 0; i < 5; i++) mockedFetch.mockResolvedValueOnce(redirect(`/hop${i}`));
    mockedFetch.mockResolvedValueOnce(fakeResponse(200, "ok"));
    expect((await fetchWithRetry(START)).ok).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(6);

    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async (url: string) => redirect(`${new URL(url).pathname}x`));
    const outcome = await settle(fetchWithRetry(START));
    expect(errorOf(outcome)).toMatch(/Too many redirects/);
    expect(mockedFetch).toHaveBeenCalledTimes(6);
  });

  it("détecte une boucle de redirections, sans retry", async () => {
    mockedFetch.mockImplementation(async (url: string) =>
      redirect(url.endsWith("/a") ? "/b" : "/a"));
    const outcome = await settle(fetchWithRetry("https://docs.spring.io/a"));
    expect(errorOf(outcome)).toMatch(/Redirect loop/);
    expect(mockedFetch.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("ne lit pas le corps d'une réponse 3xx suivie", async () => {
    const text = vi.fn(async () => "x");
    mockedFetch
      .mockResolvedValueOnce({ ...redirect("/next"), text })
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    await fetchWithRetry(START);
    expect(text).not.toHaveBeenCalled();
  });

  it("renvoie telle quelle une 3xx sans Location (ok=false)", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(302, "moved"));
    const result = await fetchWithRetry(START);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(302);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("rejette sans retry une réponse intermédiaire dépassant le plafond", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(302, "", { location: "/next", "content-length": String(MAX_RESPONSE_BYTES + 1) }));
    const outcome = await settle(fetchWithRetry(START));
    expect(errorOf(outcome)).toMatch(/exceeds the 5 MiB limit/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("garde le retry 5xx sur une étape de la chaîne", async () => {
    mockedFetch
      .mockResolvedValueOnce(redirect("/next"))
      .mockResolvedValueOnce(fakeResponse(503))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    const outcome = await settle(fetchWithRetry(START));
    expect(outcome.ok && await outcome.value.text()).toBe("ok");
  });

  it("le même AbortSignal couvre toute la chaîne", async () => {
    mockedFetch
      .mockResolvedValueOnce(redirect("/next"))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    await fetchWithRetry(START);
    expect(mockedFetch.mock.calls[0][1].signal).toBe(mockedFetch.mock.calls[1][1].signal);
  });

  it("get_migration_guide : page de wiki absente -> redirection github.com -> github.com suivie", async () => {
    const BASE = "https://github.com/spring-projects/spring-boot/wiki";
    mockedFetch.mockImplementation(async (url: string) =>
      url === `${BASE}/Spring-Boot-3.1-Release-Notes`
        ? redirect(BASE, 302)
        : fakeResponse(200, fixture("boot-wiki-home.html")));
    await expect(new SpringBootDocsServiceOptimized().getMigrationGuide("3.1")).rejects.toThrow("page not found");
    expect(mockedFetch.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      `${BASE}/Spring-Boot-3.1-Release-Notes`,
      BASE,
    ]);
  });
});
