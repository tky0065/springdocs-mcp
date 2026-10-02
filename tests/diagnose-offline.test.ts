import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import * as diagnosis from "../src/services/diagnosis.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

const BEAN_TRACE = [
  "org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'userService': Unsatisfied dependency",
  "\tat org.springframework.beans.factory.support.ConstructorResolver.autowireConstructor(ConstructorResolver.java:800)",
  "\tat org.springframework.boot.SpringApplication.run(SpringApplication.java:315)",
  "Caused by: org.springframework.beans.factory.UnsatisfiedDependencyException: Error creating bean with name 'userService': Unsatisfied dependency expressed through constructor parameter 0",
  "\tat org.springframework.beans.factory.support.ConstructorResolver.createArgumentArray(ConstructorResolver.java:802)",
  "\tat com.acme.service.UserService.<init>(UserService.java:21)",
  "Caused by: org.springframework.beans.factory.NoSuchBeanDefinitionException: No qualifying bean of type 'com.acme.UserRepository' available",
  "\tat org.springframework.beans.factory.support.DefaultListableBeanFactory.raiseNoMatchingBeanFound(DefaultListableBeanFactory.java:2000)",
  "\t... 23 more",
].join("\n");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockRejectedValue(new Error("network down"));
});
afterEach(() => vi.restoreAllMocks());

describe("diagnoseIssues hors ligne (#36)", () => {
  it("résout sans réseau et n'appelle jamais fetch (message seul)", async () => {
    const out = await new AdvancedFeaturesService().diagnoseIssues("Web server failed to start. Port 8080 was already in use.");
    expect(out).toContain("## Likely Cause");
    expect(out).toContain("# Spring Boot Issue Diagnosis");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("résout sans réseau avec une stack trace", async () => {
    const out = await new AdvancedFeaturesService().diagnoseIssues("startup failed", undefined, BEAN_TRACE);
    expect(out).toContain("## Exception Summary");
    expect(out).toContain("NoSuchBeanDefinitionException");
    expect(out).toContain("A required bean is missing");
    expect(out).toContain("https://docs.spring.io/spring-framework/reference/core/beans.html");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("sert le cache sans recalculer", async () => {
    const spy = vi.spyOn(diagnosis, "renderDiagnosis");
    const service = new AdvancedFeaturesService();
    const first = await service.diagnoseIssues("x", "web", BEAN_TRACE);
    const second = await service.diagnoseIssues("x", "web", BEAN_TRACE);
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("deux stack traces différentes donnent deux sorties différentes", async () => {
    const service = new AdvancedFeaturesService();
    const a = await service.diagnoseIssues("x", undefined, BEAN_TRACE);
    const b = await service.diagnoseIssues("x", undefined, "java.lang.IllegalStateException: boom");
    expect(a).not.toBe(b);
  });
});
