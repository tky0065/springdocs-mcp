import { describe, expect, it } from "vitest";
import {
  SPRING_PROJECTS,
  SpringProjectsConfig,
  springProjectsConfig,
  type SpringProjectConfig
} from "../src/services/spring-projects-config.js";
import { normalizeVersion } from "../src/services/url.js";

const D = "https://docs.spring.io";

const table: [string, string, string | undefined, string, string][] = [
  ["boot", "web", undefined, "3.4", `${D}/spring-boot/3.4/reference/web/index.html`],
  ["boot", "deployment", undefined, "3.4", `${D}/spring-boot/3.4/how-to/deployment/index.html`],
  ["boot", "application-properties", undefined, "3.4", `${D}/spring-boot/3.4/appendix/application-properties/index.html`],
  ["boot", "native-image", undefined, "3.4", `${D}/spring-boot/3.4/reference/packaging/native-image/index.html`],
  ["framework", "core", undefined, "6.2", `${D}/spring-framework/reference/6.2/core.html`],
  ["framework", "core", "beans", "6.2", `${D}/spring-framework/reference/6.2/core/beans.html`],
  ["ai", "chatclient", undefined, "1.1", `${D}/spring-ai/reference/1.1/api/chatclient.html`],
  ["security", "servlet", undefined, "6.5", `${D}/spring-security/reference/6.5/servlet/index.html`],
  ["security", "servlet", "architecture", "6.5", `${D}/spring-security/reference/6.5/servlet/architecture.html`],
  ["security", "authentication", undefined, "6.5", `${D}/spring-security/reference/6.5/servlet/authentication/index.html`],
  ["batch", "job", undefined, "5.2", `${D}/spring-batch/reference/5.2/job.html`],
  ["kafka", "retrytopic", undefined, "3.2", `${D}/spring-kafka/reference/3.2/retrytopic.html`],
  ["integration", "channel", undefined, "6.4", `${D}/spring-integration/reference/6.4/channel.html`],
  ["modulith", "events", undefined, "1.3", `${D}/spring-modulith/reference/1.3/events.html`],
  ["data-jpa", "jpa", "query-methods", "3.5", `${D}/spring-data/jpa/reference/3.5/jpa/query-methods.html`],
  ["cloud-config", "server", undefined, "4.2", `${D}/spring-cloud-config/reference/4.2/server.html`],
  ["cloud-gateway", "spring-cloud-gateway-server-webflux", undefined, "4.3", `${D}/spring-cloud-gateway/reference/4.3/spring-cloud-gateway-server-webflux.html`]
];

describe("normalizeVersion", () => {
  it("keeps major.minor and drops the patch", () => {
    expect(normalizeVersion("3.4")).toBe("3.4");
    expect(normalizeVersion("3.4.2")).toBe("3.4");
  });

  it.each(["current", "", undefined])("treats %j as the current documentation", (v) => {
    expect(normalizeVersion(v)).toBeUndefined();
  });

  it.each(["3.4-SNAPSHOT", "../x", "3.x", "3", "v3.4", "3.4.2.1", " 3.4", "3.4 ", "3.4/../x", "%2e"])(
    "rejects %j",
    (v) => {
      expect(() => normalizeVersion(v)).toThrow(/Invalid version/);
    }
  );
});

describe("buildReferenceUrl with a version", () => {
  it.each(table)("%s / %s / %s / %s", (project, section, subsection, version, expected) => {
    expect(springProjectsConfig.buildReferenceUrl(project, section, subsection, version)).toBe(expected);
  });

  it("is unchanged without a version", () => {
    expect(springProjectsConfig.buildReferenceUrl("boot", "web")).toBe(`${D}/spring-boot/reference/web/index.html`);
    expect(springProjectsConfig.buildReferenceUrl("framework", "core", "beans")).toBe(
      `${D}/spring-framework/reference/core/beans.html`
    );
  });

  it("treats 'current' and an empty version as no version", () => {
    const plain = springProjectsConfig.buildReferenceUrl("boot", "web");
    expect(springProjectsConfig.buildReferenceUrl("boot", "web", undefined, "current")).toBe(plain);
    expect(springProjectsConfig.buildReferenceUrl("boot", "web", undefined, "")).toBe(plain);
  });

  it("gives the same URL for 3.4.2 and 3.4", () => {
    expect(springProjectsConfig.buildReferenceUrl("boot", "web", undefined, "3.4.2")).toBe(
      springProjectsConfig.buildReferenceUrl("boot", "web", undefined, "3.4")
    );
  });

  it("rejects an invalid version", () => {
    expect(() => springProjectsConfig.buildReferenceUrl("boot", "web", undefined, "../x")).toThrow(/Invalid version/);
  });

  it("rejects a version for a project without versioned docs", () => {
    const entry: SpringProjectConfig = {
      ...SPRING_PROJECTS.get("framework")!,
      id: "unversioned",
      hasVersionedDocs: false
    };
    const config = new SpringProjectsConfig(new Map([["unversioned", entry]]));
    expect(() => config.buildReferenceUrl("unversioned", "core", undefined, "6.2")).toThrow(
      /does not support versioned documentation/
    );
    expect(config.buildReferenceUrl("unversioned", "core")).toBe(`${D}/spring-framework/reference/core.html`);
  });
});

describe("versionInsertAfter config guard", () => {
  it("covers the 11 projects", () => {
    expect(SPRING_PROJECTS.size).toBe(11);
  });

  it.each([...SPRING_PROJECTS.values()].map((p) => [p.id, p] as const))(
    "%s: versionInsertAfter is a prefix of the unversioned URL",
    (_id, project) => {
      expect(project.hasVersionedDocs).toBe(true);
      expect(project.versionInsertAfter).toBeTruthy();
      const url = springProjectsConfig.buildReferenceUrl(project.id, project.referenceSections![0]);
      expect(url.startsWith(project.versionInsertAfter!)).toBe(true);
    }
  );
});
