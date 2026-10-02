import { describe, expect, it } from "vitest";
import { filterReleaseBody, normalizeReleaseVersion } from "../src/services/release-notes.js";

const BODY = [
  "## :star: New Features",
  "",
  "* Add support for virtual threads in the web server #12345",
  "* Improve startup time #12346",
  "",
  "## :lady_beetle: Bug Fixes",
  "",
  "* Fix NPE in actuator endpoint #12347",
  "* Remove deprecated `server.foo` property #12348",
  "* Deprecate `spring.bar.enabled` in favor of `spring.bar.mode` #12349",
  "* Binding is no longer case sensitive #12350",
  "",
  "## :hammer: Dependency Upgrades",
  "",
  "* Upgrade to Jackson 2.19 #12351",
].join("\n");

describe("filterReleaseBody (#33)", () => {
  it("all renvoie le corps tel quel", () => {
    expect(filterReleaseBody(BODY, "all")).toBe(BODY);
  });

  it("new-features s'arrête au titre suivant", () => {
    const out = filterReleaseBody(BODY, "new-features");
    expect(out).toContain("virtual threads");
    expect(out).toContain("startup time");
    expect(out).not.toContain("Fix NPE");
    expect(out).not.toContain("Jackson");
    expect(out).not.toContain("Bug Fixes");
  });

  it("new-features inclut les sous-titres de niveau inférieur", () => {
    const body = "## New Features\n\n### Web\n\n* A\n\n## Bug Fixes\n\n* B";
    const out = filterReleaseBody(body, "new-features");
    expect(out).toContain("### Web");
    expect(out).toContain("* A");
    expect(out).not.toContain("* B");
  });

  it("new-features s'arrête à un titre de niveau égal ou supérieur", () => {
    const body = "### New Features\n\n* A\n\n# Other\n\n* B";
    const out = filterReleaseBody(body, "new-features");
    expect(out).toContain("* A");
    expect(out).not.toContain("* B");
  });

  it("new-features sans section correspondante renvoie ''", () => {
    expect(filterReleaseBody("## Bug Fixes\n\n* Fix it", "new-features")).toBe("");
  });

  it("breaking-changes ne renvoie que des lignes non-titre correspondantes", () => {
    const out = filterReleaseBody(BODY, "breaking-changes");
    expect(out).toContain("Remove deprecated");
    expect(out).toContain("no longer case sensitive");
    expect(out).not.toContain("Fix NPE");
    expect(out).not.toMatch(/^#/m);
  });

  it("breaking-changes ignore les titres même s'ils correspondent", () => {
    expect(filterReleaseBody("## Breaking Changes\n\n* Something", "breaking-changes")).toBe("");
  });

  it("deprecations", () => {
    const out = filterReleaseBody(BODY, "deprecations");
    expect(out).toContain("Remove deprecated");
    expect(out).toContain("Deprecate `spring.bar.enabled`");
    expect(out).not.toContain("virtual threads");
    expect(out).not.toMatch(/^#/m);
  });

  it("deprecations ignore les titres", () => {
    expect(filterReleaseBody("## :warning: Deprecations\n\n* Other", "deprecations")).toBe("");
  });

  it("gère les fins de ligne CRLF", () => {
    const crlf = BODY.replace(/\n/g, "\r\n");
    const nf = filterReleaseBody(crlf, "new-features");
    expect(nf).toContain("virtual threads");
    expect(nf).not.toContain("Fix NPE");
    expect(nf).not.toContain("\r");
    const bc = filterReleaseBody(crlf, "breaking-changes");
    expect(bc).toContain("no longer case sensitive");
    expect(bc).not.toContain("\r");
    expect(filterReleaseBody(crlf, "deprecations")).not.toContain("\r");
  });

  it.each(["all", "breaking-changes", "new-features", "deprecations"] as const)(
    "%s : null/undefined/vide -> ''",
    (focus) => {
      expect(filterReleaseBody(null, focus)).toBe("");
      expect(filterReleaseBody(undefined, focus)).toBe("");
      expect(filterReleaseBody("", focus)).toBe("");
    },
  );
});

describe("normalizeReleaseVersion (#33)", () => {
  it.each([
    ["v3.5.0", "3.5.0"],
    ["3.5.0", "3.5.0"],
    ["4.2.0-M2", "4.2.0-M2"],
    ["3.5.0-RC1", "3.5.0-RC1"],
    ["latest", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeReleaseVersion(input)).toBe(expected);
  });

  it.each(["../x", "3.5", "3.5.0/../x", "v", " 3.5.0", "3.5.0 ", "3.5.0\n", "3.x.0", "3.5.0-", "%2e%2e"])(
    "rejette %j",
    (input) => {
      expect(() => normalizeReleaseVersion(input)).toThrow(/Invalid version/);
    },
  );
});
