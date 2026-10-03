import { describe, expect, it } from "vitest";
import { SearchIndex, tokenize } from "../src/services/search-index.js";

function corpus(): SearchIndex {
  const index = new SearchIndex();
  index.add("a", { title: "Datasource configuration", url: "https://x/a", text: "Configure the spring.datasource.url property and the connection pool hikari settings." });
  index.add("b", { title: "Web MVC", url: "https://x/b", text: "Spring MVC controllers handle requests and return views." });
  index.add("c", { title: "Security", url: "https://x/c", text: "Spring Security authentication and authorization filters." });
  index.add("d", { title: "Messaging", url: "https://x/d", text: "Kafka and RabbitMQ messaging with spring." });
  return index;
}

describe("tokenize", () => {
  it("garde les clés pointées et indexe aussi leurs fragments", () => {
    const tokens = tokenize("Set spring.datasource.url now");
    expect(tokens).toContain("spring.datasource.url");
    expect(tokens).toContain("datasource");
    expect(tokens).toContain("url");
  });

  it("retire les stopwords et les jetons d'un caractère", () => {
    expect(tokenize("the of a x")).toEqual([]);
  });
});

describe("SearchIndex.search", () => {
  it("classe en tête la page qui parle du sujet", () => {
    const hits = corpus().search("datasource connection pool", 5);
    expect(hits[0].docId).toBe("a");
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("trouve une clé de configuration pointée", () => {
    expect(corpus().search("spring.datasource.url", 5)[0].docId).toBe("a");
  });

  it("ne renvoie que les pages contenant le terme", () => {
    expect(corpus().search("kafka", 5).map(h => h.docId)).toEqual(["d"]);
  });

  it("renvoie [] pour une requête vide ou faite de stopwords", () => {
    const index = corpus();
    expect(index.search("", 5)).toEqual([]);
    expect(index.search("the of", 5)).toEqual([]);
  });

  it("renvoie [] sur un index vide", () => {
    expect(new SearchIndex().search("kafka", 5)).toEqual([]);
  });

  it("respecte limit", () => {
    expect(corpus().search("spring", 2)).toHaveLength(2);
  });

  it("pondère le titre : un terme dans le titre bat une seule occurrence dans le texte", () => {
    const index = new SearchIndex();
    index.add("x", { title: "kafka", url: "u", text: "alpha beta gamma delta" });
    index.add("y", { title: "other", url: "u", text: "kafka alpha beta gamma delta" });
    expect(index.search("kafka", 5).map(h => h.docId)).toEqual(["x", "y"]);
  });

  it("produit un extrait qui contient le terme sans couper de mot", () => {
    const words = Array.from({ length: 200 }, (_, i) => `alpha${i}`);
    words.splice(100, 0, "needle");
    const index = new SearchIndex();
    index.add("long", { title: "Long", url: "u", text: words.join(" ") });
    const snippet = index.search("needle", 1)[0].snippet;
    expect(snippet).toContain("needle");
    expect(snippet.length).toBeLessThanOrEqual(260);
    for (const word of snippet.replace(/…/g, "").split(/\s+/).filter(Boolean)) {
      expect(word).toMatch(/^(alpha\d+|needle)$/);
    }
  });

  it("donne un extrait de début de page quand le terme n'est que dans le titre", () => {
    const index = new SearchIndex();
    index.add("t", { title: "Kafka", url: "u", text: "intro text only" });
    expect(index.search("kafka", 1)[0].snippet).toContain("intro text only");
  });
});

describe("SearchIndex.add", () => {
  it("remplace une entrée existante au lieu de la dupliquer", () => {
    const index = new SearchIndex();
    index.add("p", { title: "P", url: "u", text: "oldterm here" });
    index.add("p", { title: "P", url: "u", text: "newterm here" });
    expect(index.size).toBe(1);
    expect(index.search("oldterm", 5)).toEqual([]);
    expect(index.search("newterm", 5)).toHaveLength(1);
  });

  it("évince la plus ancienne page au dépassement du budget", () => {
    const index = new SearchIndex({ maxChars: 100 });
    index.add("a", { title: "A", url: "u", text: "firstterm " + "x".repeat(50) });
    index.add("b", { title: "B", url: "u", text: "secondterm " + "y".repeat(50) });
    expect(index.size).toBe(1);
    expect(index.search("firstterm", 5)).toEqual([]);
    expect(index.search("secondterm", 5)).toHaveLength(1);
  });

  it("tronque une page seule plus grande que le budget", () => {
    const index = new SearchIndex({ maxChars: 50 });
    index.add("big", { title: "Big", url: "u", text: "headterm " + "word ".repeat(100) });
    expect(index.size).toBe(1);
    expect(index.search("headterm", 5)).toHaveLength(1);
  });
});
