import { describe, expect, it } from "vitest";
import { absoluteSpringUrl, assertSafeSegment } from "../src/services/url.js";

describe("absoluteSpringUrl", () => {
  it("ignore les liens vides", () => {
    expect(absoluteSpringUrl(undefined)).toBeUndefined();
    expect(absoluteSpringUrl("  ")).toBeUndefined();
  });
  it("garde les URL absolues, préfixe et normalise les relatives", () => {
    expect(absoluteSpringUrl("https://x.io/a")).toBe("https://x.io/a");
    expect(absoluteSpringUrl("/projects/spring-boot")).toBe("https://spring.io/projects/spring-boot");
    expect(absoluteSpringUrl("projects/spring-boot")).toBe("https://spring.io/projects/spring-boot");
  });
});

describe("assertSafeSegment", () => {
  it("accepte les segments simples", () => {
    expect(assertSafeSegment("spring-boot", "projet")).toBe("spring-boot");
  });
  it.each(["../x", "a/b", "a?b", "a#b", "", "..", "a b%2f"])("rejette %j", (v) => {
    expect(() => assertSafeSegment(v, "projet")).toThrow(/projet/);
  });
});
