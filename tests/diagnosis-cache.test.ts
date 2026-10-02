import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse, fixture } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const MESSAGE = "Failed to configure a DataSource: 'url' attribute is not specified and no embedded datasource could be configured";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, fixture("listing.html")));
});
afterEach(() => vi.restoreAllMocks());

describe("sortie de diagnoseIssues (#23)", () => {
  it("ne mélange pas deux composants pour le même début de message", async () => {
    const service = new AdvancedFeaturesService();
    await service.diagnoseIssues(MESSAGE, "web");
    const second = await service.diagnoseIssues(MESSAGE, "data");
    expect(second).toContain("**Component:** data");
  });

  it("ne mélange pas deux stack traces", async () => {
    const service = new AdvancedFeaturesService();
    const first = await service.diagnoseIssues(MESSAGE);
    const second = await service.diagnoseIssues(MESSAGE, undefined, "java.lang.IllegalStateException: boom\n\tat com.example.Foo.bar(Foo.java:10)");
    expect(second).not.toBe(first);
    expect(second).toContain("**Your code:**");
  });
});
