import { describe, expect, it } from "vitest";
import {
  DIAGNOSIS_RULES,
  analyzeStackTrace,
  matchRules,
  renderDiagnosis,
} from "../src/services/diagnosis.js";
import { springProjectsConfig } from "../src/services/spring-projects-config.js";

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

const ALLOWED_REFS = new Set([
  "boot/features",
  "boot/using",
  "boot/web",
  "boot/data",
  "boot/actuator",
  "boot/application-properties",
  "boot/deployment",
  "framework/core+beans",
  "framework/web",
  "framework/data-access",
  "data-jpa/jpa",
  "data-jpa/jpa+transactions",
  "security/servlet",
  "security/authentication",
  "security/authorization",
  "security/exploits",
]);

function timed(fn: () => void): number {
  const t = performance.now();
  fn();
  return performance.now() - t;
}

describe("analyzeStackTrace", () => {
  it("(a) extracts the exception chain, top, root and first application frame", () => {
    const a = analyzeStackTrace(BEAN_TRACE);
    expect(a.chain).toHaveLength(3);
    expect(a.top?.type).toBe("org.springframework.beans.factory.BeanCreationException");
    expect(a.root?.type).toBe("org.springframework.beans.factory.NoSuchBeanDefinitionException");
    expect(a.root?.message).toContain("No qualifying bean of type");
    expect(a.applicationFrame).toBe("at com.acme.service.UserService.<init>(UserService.java:21)");
    expect(matchRules("", a, BEAN_TRACE).map((r) => r.id)).toEqual([
      "missing-bean",
      "unsatisfied-dependency",
      "bean-creation",
    ]);
  });

  it("(b) parses an 'Exception in thread' header into a single link", () => {
    const a = analyzeStackTrace('Exception in thread "main" java.lang.IllegalStateException: boom');
    expect(a.chain).toEqual([{ type: "java.lang.IllegalStateException", message: "boom" }]);
    expect(a.top).toEqual(a.root);
  });

  it("(c) empty chain without a trace", () => {
    expect(analyzeStackTrace(undefined).chain).toEqual([]);
    expect(analyzeStackTrace("").chain).toEqual([]);
    const a = analyzeStackTrace(undefined);
    expect(matchRules("Port 8080 was already in use", a).map((r) => r.id)).toEqual(["port-in-use"]);
  });

  it("(d) lazy initialization", () => {
    const a = analyzeStackTrace(undefined);
    const ids = matchRules("LazyInitializationException: could not initialize proxy - no Session", a).map((r) => r.id);
    expect(ids).toEqual(["lazy-initialization"]);
  });

  it("(e) NoUniqueBeanDefinitionException does not trigger missing-bean", () => {
    const trace =
      "org.springframework.beans.factory.NoUniqueBeanDefinitionException: No qualifying bean of type 'x.Y' available: expected single matching bean but found 2: a,b";
    const ids = matchRules("", analyzeStackTrace(trace), trace).map((r) => r.id);
    expect(ids).toContain("non-unique-bean");
    // The message contains "no qualifying bean of type", which is the missing-bean needle:
    // the rule order puts non-unique-bean first, and missing-bean must not be reported for it.
    expect(ids).not.toContain("missing-bean");
  });

  it("(g) infers the component from the first framework frame", () => {
    const trace = [
      "java.lang.RuntimeException: x",
      "\tat org.springframework.security.web.FilterChainProxy.doFilter(FilterChainProxy.java:1)",
      "\tat org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1)",
    ].join("\n");
    expect(analyzeStackTrace(trace).inferredComponent).toBe("security");
    const out = renderDiagnosis({ errorMessage: "x", stackTrace: trace });
    expect(out).toContain("**Component:** security (inferred from the stack trace)");
    const out2 = renderDiagnosis({ errorMessage: "x", component: "web", stackTrace: trace });
    expect(out2).toContain("**Component:** web\n");
    expect(out2).not.toContain("inferred");
  });

  it("(h) skips framework frames to find the application frame", () => {
    const trace = [
      "java.lang.RuntimeException: x",
      "\tat java.base/java.util.ArrayList.get(ArrayList.java:427)",
      "\tat org.springframework.aop.Foo.bar(Foo.java:1)",
      "\tat org.hibernate.Session.get(Session.java:9)",
      "\tat com.acme.Repo.find(Repo.java:7)",
    ].join("\n");
    expect(analyzeStackTrace(trace).applicationFrame).toBe("at com.acme.Repo.find(Repo.java:7)");
    const onlyFw = "java.lang.RuntimeException: x\n\tat org.springframework.aop.Foo.bar(Foo.java:1)";
    expect(analyzeStackTrace(onlyFw).applicationFrame).toBeUndefined();
  });

  it("(i) classifies module-prefixed JDK frames and lambda frames correctly", () => {
    const head = "java.lang.RuntimeException: x\n";
    const jdk = head + "\tat java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1136)";
    expect(analyzeStackTrace(jdk).applicationFrame).toBeUndefined();
    const springLambda = head + "\tat org.springframework.beans.factory.support.AbstractBeanFactory$$Lambda/0x0000000800c0a000.getObject(Unknown Source)";
    expect(analyzeStackTrace(springLambda).applicationFrame).toBeUndefined();
    const appLambda = head + "\tat com.acme.Foo$$Lambda/0x0000000800c0a000.apply(Unknown Source)";
    expect(analyzeStackTrace(appLambda).applicationFrame).toBe("at com.acme.Foo$$Lambda/0x0000000800c0a000.apply(Unknown Source)");
    const appFrame = head + "\tat com.acme.Repo.find(Repo.java:7)";
    expect(analyzeStackTrace(appFrame).applicationFrame).toBe("at com.acme.Repo.find(Repo.java:7)");
  });

  it("handles edge cases: no colon, empty Caused by, broken frames, CRLF, NUL", () => {
    expect(analyzeStackTrace("java.lang.RuntimeException").chain).toEqual([
      { type: "java.lang.RuntimeException", message: "" },
    ]);
    const a = analyzeStackTrace(
      "java.lang.RuntimeException: a\r\nCaused by: java.io.IOException:\r\n\tat com.acme.Foo.bar(Foo.java:1\r\n\tat com.acme.Baz.q(Baz.java:2)\r\n\t... 23 more\r\n",
    );
    expect(a.chain.map((c) => c.type)).toEqual(["java.lang.RuntimeException", "java.io.IOException"]);
    expect(a.chain[1].message).toBe("");
    expect(a.chain[0].message).toBe("a");
    expect(a.applicationFrame).toBe("at com.acme.Baz.q(Baz.java:2)");
    const nul = analyzeStackTrace("java.lang.Run\0timeException: bo\0om");
    expect(nul.chain).toEqual([{ type: "java.lang.RuntimeException", message: "boom" }]);
    expect(analyzeStackTrace("not an exception line: foo\nsome prose Exception").chain).toEqual([]);
  });

  it("(k) caps at 400 lines", () => {
    const line = "Caused by: a.BException: m";
    const big = Array(1000).fill(line).join("\n");
    const first400 = Array(400).fill(line).join("\n");
    expect(analyzeStackTrace(big).chain.length).toBe(analyzeStackTrace(first400).chain.length);
    expect(analyzeStackTrace(big).chain.length).toBeLessThanOrEqual(400);
  });

  it("truncates messages to 300 characters", () => {
    const a = analyzeStackTrace("a.BException: " + "m".repeat(450));
    expect(a.chain[0].message).toHaveLength(300);
  });
});

describe("pathological inputs (j)", () => {
  const cases: Array<[string, string]> = [
    ["50k chars", "x".repeat(50000)],
    ["20k Caused by", "Caused by: a.BException: m\n".repeat(20000)],
    ["30k parens", "(".repeat(30000)],
    ["giant header", "a.b.c.Exception: " + "y".repeat(100000)],
    ["giant dotted header", "a.".repeat(50000) + "Exception"],
    ["30k 'at '", "at ".repeat(30000)],
    ["NUL and exotic unicode", "\0‮\ud800\u{1F600}́".repeat(5000) + "\nCaused by: \0.X\0Exception: \u{1F600}"],
  ];
  for (const [name, input] of cases) {
    it(`bounded and safe: ${name}`, () => {
      const ms = timed(() => {
        analyzeStackTrace(input);
        matchRules(input, analyzeStackTrace(input), input);
        renderDiagnosis({ errorMessage: input, stackTrace: input });
      });
      expect(ms).toBeLessThan(500);
    });
  }
});

describe("DIAGNOSIS_RULES references (i)", () => {
  it("has the 13 rules in table order", () => {
    expect(DIAGNOSIS_RULES.map((r) => r.id)).toEqual([
      "non-unique-bean",
      "missing-bean",
      "circular-dependency",
      "datasource",
      "port-in-use",
      "config-binding",
      "http-message-not-readable",
      "lazy-initialization",
      "no-transaction",
      "classpath",
      "access-denied",
      "unsatisfied-dependency",
      "bean-creation",
    ]);
  });

  it("every reference is allowed, valid and versionless", () => {
    for (const rule of DIAGNOSIS_RULES) {
      expect(rule.references.length).toBeGreaterThan(0);
      for (const ref of rule.references) {
        const key = `${ref.project}/${ref.section}${ref.subsection ? "+" + ref.subsection : ""}`;
        expect(ALLOWED_REFS.has(key), `${rule.id}: ${key}`).toBe(true);
        expect(springProjectsConfig.validateSection(ref.project, ref.section)).toBe(true);
        const url = springProjectsConfig.buildReferenceUrl(ref.project, ref.section, ref.subsection);
        expect(url.startsWith("https://docs.spring.io/")).toBe(true);
        expect(url).not.toMatch(/\/\d+\.\d+/);
      }
    }
  });
});

describe("renderDiagnosis", () => {
  it("(f) unknown trace: honest message plus component references", () => {
    const out = renderDiagnosis({ errorMessage: "x", component: "web", stackTrace: "com.acme.FooException: x" });
    expect(out).toContain("No known pattern matched");
    expect(out).toContain("https://docs.spring.io/spring-boot/reference/web/index.html");
  });

  it("(l) section order, no distinct root cause for one link, deduplicated links", () => {
    const out = renderDiagnosis({ errorMessage: "boom", stackTrace: BEAN_TRACE });
    const order = ["## Exception Summary", "## Likely Cause", "## Reference Documentation", "## General Troubleshooting Steps"].map(
      (s) => out.indexOf(s),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(out).toContain("**Root cause:**");
    expect(out).toContain("**Your code:**");

    const single = renderDiagnosis({ errorMessage: "x", stackTrace: "java.lang.IllegalStateException: boom" });
    expect(single).toContain("**Exception:**");
    expect(single).not.toContain("**Root cause:**");

    const urls = [...out.matchAll(/ — (https:\/\/\S+) \(get_spring_reference/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
    expect(out).toContain('(get_spring_reference: project="framework", section="core", subsection="beans")');
  });

  it("omits Exception Summary without a chain", () => {
    const out = renderDiagnosis({ errorMessage: "Port 8080 was already in use" });
    expect(out).not.toContain("## Exception Summary");
    expect(out).toContain("### The server port is already taken");
    expect(out).toContain("What to check:");
    expect(out.startsWith("# Spring Boot Issue Diagnosis")).toBe(true);
  });
});

describe("diagnosis: écarts du P2", () => {
  const ids = (msg: string, trace?: string) => matchRules(msg, analyzeStackTrace(trace), trace).map((r) => r.id);

  it("ne rapporte pas un 403 d'API externe comme un problème Spring Security", () => {
    const trace = [
      "org.springframework.web.client.HttpClientErrorException$Forbidden: 403 Forbidden: \"denied\"",
      "\tat org.springframework.web.client.HttpClientErrorException.create(HttpClientErrorException.java:134)",
      "\tat com.acme.client.PaymentClient.charge(PaymentClient.java:30)",
    ].join("\n");
    expect(ids("403 Forbidden", trace)).not.toContain("access-denied");
  });

  it("rapporte un Forbidden levé depuis une frame Spring Security", () => {
    const trace = [
      "java.lang.IllegalStateException: Forbidden",
      "\tat org.springframework.security.web.access.ExceptionTranslationFilter.handleAccessDeniedException(ExceptionTranslationFilter.java:1)",
      "\tat com.acme.Foo.bar(Foo.java:2)",
    ].join("\n");
    expect(ids("Forbidden", trace)).toContain("access-denied");
  });

  it("garde AccessDeniedException", () => {
    expect(ids("org.springframework.security.access.AccessDeniedException: Access Denied")).toContain("access-denied");
  });

  it("une classe cachée non-lambda du framework n'est pas « votre code »", () => {
    const head = "java.lang.RuntimeException: x\n";
    const fw = head + "\tat org.springframework.aop.Foo/0x0000000800c0a000.run(Unknown Source)";
    expect(analyzeStackTrace(fw).applicationFrame).toBeUndefined();
    const app = head + "\tat com.acme.Foo/0x0000000800c0a000.run(Unknown Source)";
    expect(analyzeStackTrace(app).applicationFrame).toBe("at com.acme.Foo/0x0000000800c0a000.run(Unknown Source)");
  });
});
