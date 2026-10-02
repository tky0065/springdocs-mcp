# Pagination de get_spring_project / get_spring_reference Implementation Plan (#24)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la troncature brute `substring(0, 1500)` + `...` par une pagination à frontières propres, pilotée par un paramètre `offset`.

**Architecture:** Fonction pure `pageMarkdown` dans `markdown.ts`. Le cache garde le markdown complet (+ URL) ; la page est découpée à chaque appel, donc les pages suivantes ne refont aucune requête. Les deux tools reçoivent `offset` (schéma, validation existante, handlers `index.ts`).

**Tech Stack:** TypeScript (Node16), vitest 3.

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #24.

## Global Constraints

- Taille de page : `PAGE_SIZE = 4000` caractères (exportée de `markdown.ts`).
- Paramètre `offset` : `type: "number"`, `minimum: 0`, `maximum: 10000000`, `default: 0`, sur `get_spring_project` et `get_spring_reference`.
- Pied de réponse tant qu'il reste du contenu : `Partie <début>–<fin> sur <total> caractères. Pour la suite, rappeler avec offset=<nextOffset>.` puis le lien source (`For complete project info, visit: <url>` / `For complete reference, visit: <url>`, textes existants). Dernière page : plus de `...`, seulement le lien. Offset ≥ total : message `No content at offset <offset> (total: <total> characters).` (pas d'erreur).
- Clés de cache et TTL inchangés (`project:${projectName}`, `reference:${projectId}:${section}:${subsection||'main'}` ; `setLongTerm` pour projet, stratégie du projet pour la référence). Ce qui est stocké devient `{ markdown, url }` (+ titre calculé à la lecture).
- `getSpringProject(projectName, offset = 0)` et `getSpringReference(projectId, section, subsection?, offset = 0)` : paramètre ajouté en dernier, appels existants inchangés.
- Ne pas toucher `get_spring_guide`/tutoriels (#25) ni `search_spring_concepts`.
- Imports `.js`, commentaires en anglais, pas d'attribution Claude dans les commits. `docker/tools.json` régénéré (`npm run build && npm run docker:tools`).

## Review Focus

- Enchaîner les pages (`offset = nextOffset`) reconstitue tout le document, sans trou ni doublon (aux fences de refermeture/réouverture près).
- Un bloc de code coupé en deux pages est refermé sur la page N et rouvert au début de la page N+1.
- La page 2 est servie **sans second `fetch`** (cache du markdown complet).
- `offset` au-delà de la fin → message clair, pas d'exception ni de page vide.
- Document ≤ 4000 caractères avec offset 0 : pas de pied de pagination, pas de `...`.
- Terminaison : `nextOffset > offset` toujours, même avec une ligne géante sans saut de ligne.

---

### Task 1: `pageMarkdown` (fonction pure)

**Files:**
- Modify: `src/services/markdown.ts`
- Test: `tests/page-markdown.test.ts` (nouveau)

**Interfaces:**
- Produces: `export const PAGE_SIZE = 4000;` et

```ts
export function pageMarkdown(markdown: string, offset = 0, pageSize = PAGE_SIZE):
  { content: string; start: number; end: number; nextOffset: number | null; total: number }
```

`start`/`end` = positions dans le markdown d'origine (`end` exclus) ; `content` = `markdown.slice(start, end)` éventuellement préfixé de `` ```\n `` (page qui démarre dans un bloc de code) et suffixé de `` \n``` `` (page qui se termine dans un bloc) ; `nextOffset = end` s'il reste du contenu, sinon `null`. Si `offset >= total` : `content: ''`, `start = end = offset`, `nextOffset: null`.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/page-markdown.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageMarkdown } from "../src/services/markdown.js";

const strip = (c: string) => c.replace(/^```\n/, "").replace(/\n```$/, "");

function allPages(doc: string, size: number) {
  const pages = [];
  let offset = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const page = pageMarkdown(doc, offset, size);
    pages.push(page);
    if (page.nextOffset === null) return pages;
    expect(page.nextOffset).toBeGreaterThan(offset);
    offset = page.nextOffset;
  }
  throw new Error("pagination does not terminate");
}

describe("pageMarkdown (#24)", () => {
  it("rend un petit document en une page sans suite", () => {
    const doc = "# T\n\ntexte";
    expect(pageMarkdown(doc)).toEqual({ content: doc, start: 0, end: doc.length, nextOffset: null, total: doc.length });
  });

  it("enchaîner les pages reconstitue le document", () => {
    const doc = Array.from({ length: 300 }, (_, i) => (i % 20 === 0 ? `## Section ${i}` : `ligne ${i} avec du texte`)).join("\n");
    const pages = allPages(doc, 500);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.map((p) => doc.slice(p.start, p.end)).join("")).toBe(doc);
  });

  it("préfère couper juste avant un titre", () => {
    const body = "mot ".repeat(120).trim(); // ~479 caractères sur une ligne
    const doc = `${body}\n\n## Suite\n${body}\n`;
    const page = pageMarkdown(doc, 0, 600);
    expect(doc.slice(page.end).startsWith("## Suite")).toBe(true);
  });

  it("referme un bloc de code coupé et le rouvre sur la page suivante", () => {
    const code = Array.from({ length: 200 }, (_, i) => `int v${i} = ${i};`).join("\n");
    const doc = `\`\`\`java\n${code}\n\`\`\`\n`;
    const [first, second] = allPages(doc, 600);
    expect(first.content.endsWith("\n```")).toBe(true);
    expect(second.content.startsWith("```\n")).toBe(true);
  });

  it("ne coupe pas un bloc de code quand un titre précède dans la fenêtre", () => {
    const doc = `${"a\n".repeat(150)}## Code\n\`\`\`\n${"b\n".repeat(150)}\`\`\`\n`;
    const page = pageMarkdown(doc, 0, 600);
    expect(doc.slice(page.end).startsWith("## Code")).toBe(true);
  });

  it("termine même avec une ligne géante sans saut de ligne", () => {
    const doc = "x".repeat(2500);
    const pages = allPages(doc, 1000);
    expect(pages.map((p) => doc.slice(p.start, p.end)).join("")).toBe(doc);
  });

  it("rend une page vide sans suite quand l'offset dépasse la fin", () => {
    const doc = "abc";
    expect(pageMarkdown(doc, 10)).toEqual({ content: "", start: 10, end: 10, nextOffset: null, total: 3 });
  });

  it("utilise PAGE_SIZE par défaut", () => {
    const doc = "ligne\n".repeat(2000);
    const page = pageMarkdown(doc);
    expect(page.end - page.start).toBeLessThanOrEqual(PAGE_SIZE);
    expect(strip(page.content).length).toBeLessThanOrEqual(PAGE_SIZE);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/page-markdown.test.ts` → FAIL (exports inexistants).

- [ ] **Step 3: Implémenter** dans `src/services/markdown.ts` :

```ts
export const PAGE_SIZE = 4000;

const isFence = (line: string) => line.trim().startsWith('```');

/**
 * Return one page of a markdown document starting at `offset`.
 * The page ends at a clean boundary: before a heading, else after a blank line
 * (both only outside code blocks and past the middle of the window), else on a
 * line boundary, else a hard cut for a single huge line. A code block cut by the
 * page boundary is closed here and reopened at the start of the next page.
 */
export function pageMarkdown(markdown: string, offset: number = 0, pageSize: number = PAGE_SIZE) {
  const total = markdown.length;
  if (offset >= total) return { content: '', start: offset, end: offset, nextOffset: null, total };

  // Fence state at `offset`, scanning from the start of the document
  let inCode = false;
  let position = 0;
  for (const line of markdown.slice(0, offset).split('\n')) {
    // the last element is the (possibly partial) line containing `offset`: only whole lines count
    if (position + line.length < offset && isFence(line)) inCode = !inCode;
    position += line.length + 1;
  }
  const startsInCode = inCode;

  const windowEnd = Math.min(total, offset + pageSize);
  let end = windowEnd;
  if (windowEnd < total) {
    let heading = -1;
    let blank = -1;
    let anyLine = -1;
    let state = startsInCode;
    let lineStart = markdown.lastIndexOf('\n', offset - 1) + 1;
    if (offset === 0) lineStart = 0;
    while (lineStart < windowEnd) {
      const newline = markdown.indexOf('\n', lineStart);
      const lineEnd = newline === -1 ? total : newline;
      const line = markdown.slice(lineStart, lineEnd);
      const next = lineEnd + 1;
      if (lineStart > offset && lineStart <= windowEnd) {
        anyLine = lineStart;
        if (!state && lineStart >= offset + pageSize / 2) {
          if (/^#{1,6}\s/.test(line)) heading = lineStart;
          else if (markdown.slice(Math.max(offset, lineStart - 2), lineStart) === '\n\n') blank = lineStart;
        }
      }
      if (isFence(line) && lineStart >= offset) state = !state;
      lineStart = next;
    }
    end = heading !== -1 ? heading : blank !== -1 ? blank : anyLine !== -1 ? anyLine : windowEnd;
  }

  // Fence state at `end`, to close a block cut by the boundary
  let endsInCode = startsInCode;
  let cursor = offset;
  for (const line of markdown.slice(offset, end).split('\n')) {
    if (cursor + line.length <= end && isFence(line) && cursor >= offset) endsInCode = !endsInCode;
    cursor += line.length + 1;
  }

  let content = markdown.slice(offset, end);
  if (startsInCode) content = '```\n' + content;
  if (endsInCode) content = content.replace(/\n?$/, '\n```');
  return { content, start: offset, end, nextOffset: end < total ? end : null, total };
}
```

Les tests du Step 1 sont la spécification : si l'implémentation ci-dessus ne les satisfait pas (le suivi des fences et des positions de ligne est subtil, notamment pour un `offset` qui ne tombe pas sur un début de ligne), **corriger l'implémentation** (la simplifier si possible, p. ex. en précalculant les lignes avec leurs positions de début en une seule passe) sans affaiblir les tests, et signaler l'écart dans le rapport.

- [ ] **Step 4: Vérifier** : `npx vitest run tests/page-markdown.test.ts` → PASS.

- [ ] **Step 5: Commit** : `git add src/services/markdown.ts tests/page-markdown.test.ts && git commit -m "feat: pageMarkdown pour découper un markdown en pages à frontières propres"`

### Task 2: pagination dans les services, le schéma et les handlers

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts` (`getSpringProject` ~l.83-120, `getSpringReference` ~l.257-320), `src/tools/index.ts` (schémas de `get_spring_project` et `get_spring_reference`), `src/index.ts` (`handleGetProject` l.173, `handleGetReference` l.226), `docker/tools.json` (régénéré)
- Test: `tests/pagination.test.ts` (nouveau), mise à jour éventuelle de `tests/reference-url.test.ts` / `tests/url-safety.test.ts` si des assertions dépendent de `...`

**Interfaces:**
- Consumes: `pageMarkdown`, `PAGE_SIZE` (Task 1).
- Produces: `getSpringProject(projectName: string, offset = 0)`, `getSpringReference(projectId: string, section: string, subsection?: string, offset = 0)`.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/pagination.test.ts`. Gabarit : même mock `node-fetch` que `tests/reference-url.test.ts` (`vi.mock("node-fetch", ...)`, `fakeResponse`). Servir une page HTML `<main><h2>Intro</h2><p>…</p>…</main>` dont le markdown dépasse 4000 caractères (par ex. 40 paragraphes de 200 caractères sous plusieurs `<h2>`), puis vérifier pour `getSpringReference("boot", "web")` et pour `getSpringProject("spring-boot")` :
  1. `offset` 0 : le texte contient `Partie 0–` et `Pour la suite, rappeler avec offset=<N>` et le lien source, ne contient pas `...`.
  2. Appel suivant avec `offset = N` : **`mockedFetch` n'a été appelé qu'une fois au total** et le texte commence par le même titre `# …` d'en-tête.
  3. Dernière page : pas de `Pour la suite`, pas de `...`, contient le lien `For complete reference, visit:` (ou `project info`).
  4. `offset` énorme (1e9) : résout avec `No content at offset 1000000000 (total: `, sans exception.
  5. Petit document (< 4000) offset 0 : ni `Partie` ni `...`.

- [ ] **Step 2: Vérifier l'échec** : `npm run build && npx vitest run tests/pagination.test.ts` → FAIL.

- [ ] **Step 3: Implémenter.**
  - Services : dans les deux méthodes, mettre en cache `{ markdown, url }` au lieu de la chaîne finale (mêmes clés et TTL) ; extraire un helper privé `formatPage(title: string, markdown: string, url: string, offset: number, linkLabel: string)` qui appelle `pageMarkdown(markdown, offset)` et construit : `# ${title}\n\n${content}` + (si `nextOffset !== null`) `\n\n---\nPartie ${start}–${end} sur ${total} caractères. Pour la suite, rappeler avec offset=${nextOffset}.` + `\n\n${linkLabel}: ${url}` ; et pour `offset >= total` : `No content at offset ${offset} (total: ${total} characters).` Titre projet : `projectName` ; titre référence : `` `${project.displayName} Reference: ${subsection ? `${section}/${subsection}` : section}` ``. `linkLabel` : `For complete project info, visit` / `For complete reference, visit`. Le retour reste une `string`.
  - `src/tools/index.ts` : ajouter à `get_spring_project` et `get_spring_reference` la propriété `offset: { type: "number", minimum: 0, maximum: 10000000, default: 0, description: "Position (en caractères) pour lire la suite d'un document tronqué, fournie dans le pied de la réponse précédente" }`.
  - `src/index.ts` : `handleGetProject` lit `offset = 0` des args et appelle `getSpringProject(projectName, offset)` ; `handleGetReference` appelle `getSpringReference(project, section, subsection, offset)`.
  - Régénérer : `npm run build && npm run docker:tools`.

- [ ] **Step 4: Vérifier** : `npm test` → build OK, tout vert (dont `docker-tools.test.ts`, `validation.test.ts`, `reference-url.test.ts`, `url-safety.test.ts`). Adapter uniquement les assertions qui dépendaient de l'ancien format `...`/1500, en le signalant dans le rapport.

- [ ] **Step 5: Commit** : `git add src tests docker && git commit -m "feat: paginer get_spring_project et get_spring_reference avec un paramètre offset (page de 4000 caractères, cache du markdown complet)"`

### Task 3: backlog

- [ ] Après vérification réelle de `npm test`, cocher #24 dans `IMPROVE.md` (` — Fait le 2026-10-02`).
