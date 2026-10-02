import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse, settle } from "./helpers.js";
import { MAX_RESPONSE_BYTES } from "../src/services/http.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const URL_UNDER_TEST = "https://example.test/page";

describe.each([
  ["SpringBootDocsServiceOptimized", () => new SpringBootDocsServiceOptimized()],
  ["AdvancedFeaturesService", () => new AdvancedFeaturesService()],
])("fetchWithRetry (%s)", (_name, create) => {
  const call = (...args: unknown[]) => (create() as any).fetchWithRetry(...args);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries 5xx responses until one succeeds", async () => {
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(503))
      .mockResolvedValueOnce(fakeResponse(503))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));

    const outcome = await settle(call(URL_UNDER_TEST));

    expect(outcome.ok && await outcome.value.text()).toBe("ok");
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry other 4xx responses", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(404, "not found"));

    const outcome = await settle(call(URL_UNDER_TEST));

    expect(outcome.ok && outcome.value.status).toBe(404);
    expect(outcome.ok && outcome.value.ok).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("returns the last failing response once retries are exhausted", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(503, "down"));

    const outcome = await settle(call(URL_UNDER_TEST));

    expect(outcome.ok && outcome.value.ok).toBe(false);
    expect(outcome.ok && outcome.value.status).toBe(503);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially (1s then 2s) without Retry-After", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(503));
    const pending = call(URL_UNDER_TEST);

    await vi.advanceTimersByTimeAsync(0);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    await settle(pending);
  });

  it("honors Retry-After (seconds) on 429", async () => {
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(429, "", { "retry-after": "4" }))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    const pending = call(URL_UNDER_TEST);

    await vi.advanceTimersByTimeAsync(3999);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect((await settle(pending)).ok).toBe(true);
  });

  it("caps Retry-After at 10 seconds", async () => {
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(429, "", { "retry-after": "3600" }))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    const pending = call(URL_UNDER_TEST);

    await vi.advanceTimersByTimeAsync(9999);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    await settle(pending);
  });

  it.each([
    ["absent", {}],
    ["an HTTP date", { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }],
  ])("falls back to the backoff when Retry-After is %s", async (_label, headers) => {
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(503, "", headers))
      .mockResolvedValueOnce(fakeResponse(200, "ok"));
    const pending = call(URL_UNDER_TEST);

    await vi.advanceTimersByTimeAsync(999);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    await settle(pending);
  });

  it("times out a body that never finishes, then retries", async () => {
    mockedFetch
      .mockImplementationOnce(async (_url: string, init: { signal: AbortSignal }) => ({
        ...fakeResponse(200),
        text: () => new Promise<string>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      }))
      .mockResolvedValueOnce(fakeResponse(200, "fine"));

    const outcome = await settle(call(URL_UNDER_TEST, 300));

    expect(outcome.ok && await outcome.value.text()).toBe("fine");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("rethrows the network error after the last attempt", async () => {
    mockedFetch.mockRejectedValue(new Error("ECONNRESET"));

    const outcome = await settle(call(URL_UNDER_TEST));

    expect(!outcome.ok && (outcome.error as Error).message).toBe("ECONNRESET");
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });
});

describe("plafond de taille des réponses (#21)", () => {
  const call = () => (new AdvancedFeaturesService() as any).fetchWithRetry(URL_UNDER_TEST);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passe le plafond à node-fetch via l'option size", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "ok"));

    await settle(call());

    expect(mockedFetch).toHaveBeenCalledWith(URL_UNDER_TEST, expect.objectContaining({ size: MAX_RESPONSE_BYTES }));
  });

  it("rejette sans retry quand la lecture dépasse le plafond (max-size)", async () => {
    const tooBig = { ...fakeResponse(200), text: async () => { throw Object.assign(new Error("over"), { type: "max-size" }); } };
    mockedFetch.mockResolvedValue(tooBig);

    const outcome = await settle(call());

    expect(!outcome.ok && (outcome.error as Error).message).toBe(`Response from ${URL_UNDER_TEST} exceeds the 5 MiB limit`);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("rejette sans lire le corps quand content-length dépasse le plafond", async () => {
    const text = vi.fn(async () => "x");
    mockedFetch.mockResolvedValue({ ...fakeResponse(200, "x", { "content-length": String(MAX_RESPONSE_BYTES + 1) }), text });

    const outcome = await settle(call());

    expect(!outcome.ok && (outcome.error as Error).message).toMatch(/exceeds the 5 MiB limit/);
    expect(text).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("ignore un content-length non numérique", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "ok", { "content-length": "abc" }));

    const outcome = await settle(call());

    expect(outcome.ok && await outcome.value.text()).toBe("ok");
  });
});
