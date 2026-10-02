import { describe, expect, it } from "vitest";
import {
  buildSnippets, flattenCatalog, formatDependencyMatches, rankDependencies, searchWords,
  type CatalogEntry, type DependencyData,
} from "../src/services/dependency-finder.js";

const data: DependencyData = {
  bootVersion: "4.1.1",
  dependencies: {
    web: { groupId: "org.springframework.boot", artifactId: "spring-boot-starter-webmvc", scope: "compile" },
    h2: { groupId: "com.h2database", artifactId: "h2", scope: "runtime" },
    testcontainers: { groupId: "org.testcontainers", artifactId: "testcontainers-junit-jupiter", scope: "test" },
    lombok: { groupId: "org.projectlombok", artifactId: "lombok", scope: "annotationProcessor" },
    "spring-ai-openai": { groupId: "org.springframework.ai", artifactId: "spring-ai-starter-model-openai", scope: "compile", bom: "spring-ai" },
    "bom-missing": { groupId: "org.acme", artifactId: "acme-starter", scope: "compile", bom: "ghost" },
    springdoc: { groupId: "org.springdoc", artifactId: "springdoc-openapi-starter-webmvc-ui", scope: "compile", version: "3.1.0" },
    saml: { groupId: "org.springframework.boot", artifactId: "spring-boot-starter-security-saml2", scope: "compile", repository: "shibboleth" },
    native: { groupId: "org.springframework.boot", artifactId: "spring-boot", scope: "compile" },
    provided: { groupId: "jakarta.servlet", artifactId: "jakarta.servlet-api", scope: "provided" },
    weird: { groupId: "org.acme", artifactId: "weird", scope: "banana" },
    evil: { groupId: "org.acme\n```\n# pwn", artifactId: "x", scope: "compile" },
  },
  boms: { "spring-ai": { groupId: "org.springframework.ai", artifactId: "spring-ai-bom", version: "2.0.0" } },
  repositories: { shibboleth: { name: "Shibboleth Releases", url: "https://build.shibboleth.net/maven/releases" } },
};

describe("searchWords", () => {
  it("découpe, passe en minuscules, retire les mots vides et les doublons", () => {
    expect(searchWords("I want a Postgres driver")).toEqual(["postgres", "driver"]);
    expect(searchWords("Spring Data JPA!")).toEqual(["data", "jpa"]);
    expect(searchWords("jpa JPA jpa")).toEqual(["jpa"]);
    expect(searchWords("oauth2-client")).toEqual(["oauth2", "client"]);
  });

  it("n'interprète jamais les caractères spéciaux", () => {
    expect(searchWords(".*(")).toEqual([]);
    expect(searchWords("\\ [ ] ^ $")).toEqual([]);
    expect(searchWords("the for spring")).toEqual([]);
  });

  it("garde les mots courts utiles et ignore les caractères non ASCII", () => {
    expect(searchWords("ai")).toEqual(["ai"]);
    expect(() => searchWords("base de données")).not.toThrow();
    expect(searchWords("x")).toEqual([]);
  });
});

describe("flattenCatalog", () => {
  it("aplatit les catégories en entrées id/name/description", () => {
    const flat = flattenCatalog({ dependencies: { values: [{ name: "Web", values: [{ id: "web", name: "Spring Web", description: "MVC" }] }] } } as any);
    expect(flat).toEqual([{ id: "web", name: "Spring Web", description: "MVC" }]);
  });

  it("métadonnées sans dependencies : erreur claire", () => {
    expect(() => flattenCatalog({} as any)).toThrow(/unexpected response/i);
  });
});

describe("rankDependencies", () => {
  const catalog: CatalogEntry[] = [
    { id: "data-jpa", name: "Spring Data JPA", description: "Persist data in SQL stores" },
    { id: "jpa-extras", name: "Extras", description: "Something" },
    { id: "other", name: "JPA helper", description: "Helper" },
    { id: "zzz", name: "Zzz", description: "Works with jpa too" },
    { id: "jpa", name: "JPA", description: "x" },
    { id: "nomatch", name: "Nothing", description: "Nothing" },
  ];

  it("id égal > id contenant > nom > description, sans les non-correspondances", () => {
    const ids = rankDependencies(catalog, ["jpa"]).map((e) => e.id);
    expect(ids).toEqual(["jpa", "data-jpa", "jpa-extras", "other", "zzz"]);
  });

  it("cumule les scores de plusieurs mots", () => {
    const ids = rankDependencies(catalog, ["data", "jpa"]).map((e) => e.id);
    expect(ids[0]).toBe("data-jpa");
  });

  it("départage par id le plus court puis ordre alphabétique", () => {
    const tie: CatalogEntry[] = [
      { id: "bbb-x", name: "n", description: "d" },
      { id: "aaa-x", name: "n", description: "d" },
      { id: "x", name: "n", description: "d" },
    ];
    expect(rankDependencies(tie, ["x"]).map((e) => e.id)).toEqual(["x", "aaa-x", "bbb-x"]);
  });

  it("sans mot ou sans correspondance : liste vide", () => {
    expect(rankDependencies(catalog, [])).toEqual([]);
    expect(rankDependencies(catalog, ["qqqqq"])).toEqual([]);
  });
});

describe("buildSnippets", () => {
  it("compile : Maven sans scope, Gradle implementation", () => {
    const s = buildSnippets("web", data, "both");
    expect(s.kind).toBe("dependency");
    expect(s.coordinates).toBe("org.springframework.boot:spring-boot-starter-webmvc");
    expect(s.maven).toBe("<dependency>\n    <groupId>org.springframework.boot</groupId>\n    <artifactId>spring-boot-starter-webmvc</artifactId>\n</dependency>");
    expect(s.gradle).toBe('implementation("org.springframework.boot:spring-boot-starter-webmvc")');
  });

  it("runtime et test", () => {
    expect(buildSnippets("h2", data, "both").maven).toContain("<scope>runtime</scope>");
    expect(buildSnippets("h2", data, "both").gradle).toBe('runtimeOnly("com.h2database:h2")');
    expect(buildSnippets("testcontainers", data, "both").maven).toContain("<scope>test</scope>");
    expect(buildSnippets("testcontainers", data, "both").gradle).toContain("testImplementation(");
  });

  it("annotationProcessor : optional en Maven, compileOnly + annotationProcessor en Gradle", () => {
    const s = buildSnippets("lombok", data, "both");
    expect(s.maven).toContain("<optional>true</optional>");
    expect(s.gradle).toBe('compileOnly("org.projectlombok:lombok")\nannotationProcessor("org.projectlombok:lombok")');
  });

  it("provided", () => {
    const s = buildSnippets("provided", data, "both");
    expect(s.maven).toContain("<scope>provided</scope>");
    expect(s.gradle).toContain("compileOnly(");
  });

  it("scope inconnu : traité comme compile avec une note", () => {
    const s = buildSnippets("weird", data, "both");
    expect(s.gradle).toBe('implementation("org.acme:weird")');
    expect(s.notes.join(" ")).toMatch(/banana/);
  });

  it("BOM : import du BOM avec sa version avant la dépendance", () => {
    const s = buildSnippets("spring-ai-openai", data, "both");
    expect(s.maven).toContain("<dependencyManagement>");
    expect(s.maven).toContain("<artifactId>spring-ai-bom</artifactId>");
    expect(s.maven).toContain("<version>2.0.0</version>");
    expect(s.maven).toContain("<type>pom</type>");
    expect(s.maven).toContain("<scope>import</scope>");
    expect(s.maven!.indexOf("<dependencyManagement>")).toBeLessThan(s.maven!.indexOf("spring-ai-starter-model-openai"));
    expect(s.gradle).toBe('implementation(platform("org.springframework.ai:spring-ai-bom:2.0.0"))\nimplementation("org.springframework.ai:spring-ai-starter-model-openai")');
  });

  it("BOM absent de la liste : note, pas d'exception", () => {
    const s = buildSnippets("bom-missing", data, "both");
    expect(s.kind).toBe("dependency");
    expect(s.notes.join(" ")).toMatch(/ghost/);
    expect(s.maven).not.toContain("dependencyManagement");
  });

  it("version explicite", () => {
    const s = buildSnippets("springdoc", data, "both");
    expect(s.maven).toContain("<version>3.1.0</version>");
    expect(s.gradle).toBe('implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.0")');
  });

  it("dépôt supplémentaire : note avec nom et URL", () => {
    const s = buildSnippets("saml", data, "both");
    expect(s.notes.join(" ")).toContain("Shibboleth Releases (https://build.shibboleth.net/maven/releases)");
  });

  it("plugin de build : pas de snippet", () => {
    const s = buildSnippets("native", data, "both");
    expect(s.kind).toBe("plugin");
    expect(s.maven).toBeUndefined();
    expect(s.notes.join(" ")).toMatch(/build plugin/i);
  });

  it("id sans coordonnées : pas de snippet", () => {
    const s = buildSnippets("htmx", data, "both");
    expect(s.kind).toBe("unavailable");
    expect(s.notes.join(" ")).toMatch(/no Maven coordinates/i);
  });

  it("coordonnées au contenu douteux : pas de snippet", () => {
    const s = buildSnippets("evil", data, "both");
    expect(s.kind).toBe("unavailable");
    expect(s.maven).toBeUndefined();
  });

  it("build limite les snippets produits", () => {
    expect(buildSnippets("web", data, "maven").gradle).toBeUndefined();
    expect(buildSnippets("web", data, "gradle").maven).toBeUndefined();
    expect(buildSnippets("web", data, "gradle").gradle).toBeDefined();
  });
});

describe("formatDependencyMatches", () => {
  const entry = (id: string): CatalogEntry => ({ id, name: `Name ${id}`, description: `Description ${id}` });

  it("en-tête avec le besoin et la version de Boot, fiches avec snippets", () => {
    const text = formatDependencyMatches("web", [entry("web")], data, "both");
    expect(text).toContain('# Dependencies for "web" (Spring Boot 4.1.1)');
    expect(text).toContain("## `web` — Name web");
    expect(text).toContain("Description web");
    expect(text).toContain("org.springframework.boot:spring-boot-starter-webmvc");
    expect(text).toContain("```xml");
    expect(text).toContain("```gradle");
  });

  it("plafonne à 5 résultats avec le nombre restant", () => {
    const ranked = Array.from({ length: 8 }, (_, i) => entry(`dep-${i}`));
    const text = formatDependencyMatches("dep", ranked, data, "both");
    expect(text.match(/^## `/gm)).toHaveLength(5);
    expect(text).toMatch(/3 more matches, refine the query/);
  });

  it("aucun résultat : message avec piste vers get_spring_initializr", () => {
    const text = formatDependencyMatches("zzz", [], data, "both");
    expect(text).toMatch(/No dependency matches "zzz"/);
    expect(text).toContain("get_spring_initializr");
  });

  it("une fiche sans snippet affiche sa note", () => {
    const text = formatDependencyMatches("native", [entry("native")], data, "both");
    expect(text).toMatch(/build plugin/i);
    expect(text).not.toContain("```xml");
  });
});
