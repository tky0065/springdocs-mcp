# extractContent factorisé et sans perte Implementation Plan (#25)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les deux copies de `extractIntelligentContent` (qui perdent du contenu) par une troncature en préfixe contigu, factorisée dans `markdown.ts`, et rendre `full` réellement complet (50 000 caractères).

**Architecture:** `markdown.ts` exporte `DETAIL_LIMITS` et `extractContent(markdown, detailLevel)` qui renvoie `{ content, truncated }`. La coupe se fait à une frontière de ligne, lignes vides conservées, et un bloc de code coupé est refermé. Les services appellent cette fonction et décident du texte de notice avec `truncated`.

**Tech Stack:** TypeScript (Node16), vitest 3.

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #25.

## Global Constraints

- Limites : `summary` 1500, `medium` 4000, `full` 50000 caractères. Niveau inconnu → `medium` (comportement actuel).
- Document ≤ limite → rendu tel quel, `truncated: false`.
- Sortie tronquée ≤ limite + 4 caractères (la fermeture `\n```` éventuelle), jamais de ligne coupée en deux.
- Ne pas toucher `substring(0, 1500)` de `getSpringProject`/`getSpringReference` (#24).
- Les clés de cache et les formats de réponse des tools restent identiques, sauf le texte de notice quand `full` est tronqué.
- Imports `.js`, commentaires en anglais, pas d'attribution Claude dans les commits.

## Review Focus

- Un bloc de code plus gros que 80 % du budget n'est plus supprimé : il est coupé et refermé.
- Source avec bloc de code **non fermé** : la sortie est du markdown bien formé (nombre de lignes de fence pair).
- Lignes vides conservées (paragraphes séparés).
- Document de 20 000 caractères en `full` rendu en entier, sans notice.
- Un doc juste au-dessus de la limite avec fermeture ajoutée est bien marqué `truncated: true` même si la sortie n'est pas plus courte.

---

### Task 1: `extractContent` dans `markdown.ts`, branché dans les deux services

**Files:**
- Modify: `src/services/markdown.ts`, `src/services/springboot-docs-optimized.ts`, `src/services/advanced-features.ts`, `src/tools/index.ts`, `docker/tools.json` (régénéré)
- Test: `tests/extract-content.test.ts` (nouveau)

**Interfaces:**
- Produces: `export const DETAIL_LIMITS: Record<string, number>` ; `export function extractContent(markdown: string, detailLevel?: string): { content: string; truncated: boolean }`.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/extract-content.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { DETAIL_LIMITS, extractContent } from "../src/services/markdown.js";

const fences = (text: string) => text.split("\n").filter((l) => l.trim().startsWith("```")).length;

describe("extractContent (#25)", () => {
  it("rend un document sous la limite tel quel", () => {
    const doc = "# Titre\n\ntexte\n";
    expect(extractContent(doc, "summary")).toEqual({ content: doc, truncated: false });
  });

  it("utilise medium pour un niveau inconnu", () => {
    const doc = "a\n".repeat(3000); // 6000 caractères
    const { content } = extractContent(doc, "nope");
    expect(content.length).toBeLessThanOrEqual(DETAIL_LIMITS.medium + 4);
  });

  it("garde les lignes vides entre paragraphes", () => {
    const doc = ("paragraphe un\n\nparagraphe deux\n\n").repeat(200);
    const { content, truncated } = extractContent(doc, "summary");
    expect(truncated).toBe(true);
    expect(content).toContain("paragraphe un\n\nparagraphe deux\n\n");
  });

  it("ne supprime plus un gros bloc de code : il est coupé et refermé", () => {
    const code = Array.from({ length: 200 }, (_, i) => `line${i} = ${i};`).join("\n");
    const doc = `# Guide\n\n\`\`\`java\n${code}\n\`\`\`\n\nfin`;
    const { content, truncated } = extractContent(doc, "summary");
    expect(truncated).toBe(true);
    expect(content).toContain("```java\nline0 = 0;");
    expect(fences(content) % 2).toBe(0);
    expect(content.length).toBeLessThanOrEqual(DETAIL_LIMITS.summary + 4);
  });

  it("produit du markdown bien formé pour un bloc non fermé en source", () => {
    const doc = `# Guide\n\n\`\`\`xml\n${"<a/>\n".repeat(1000)}`;
    const { content } = extractContent(doc, "summary");
    expect(fences(content) % 2).toBe(0);
  });

  it("ne coupe jamais une ligne en deux", () => {
    const doc = Array.from({ length: 400 }, (_, i) => `ligne numéro ${i}`).join("\n");
    const { content } = extractContent(doc, "summary");
    for (const line of content.split("\n")) expect(doc.split("\n")).toContain(line);
  });

  it("rend un guide de 20000 caractères en entier en full", () => {
    const doc = "x".repeat(99) + "\n";
    const big = doc.repeat(200); // 20000 caractères
    expect(extractContent(big, "full")).toEqual({ content: big, truncated: false });
  });

  it("marque truncated même quand la fermeture rend la sortie plus longue", () => {
    const doc = "```\n" + "y\n".repeat(DETAIL_LIMITS.summary / 2);
    expect(extractContent(doc, "summary").truncated).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/extract-content.test.ts` → FAIL (exports inexistants).

- [ ] **Step 3: Implémenter** dans `src/services/markdown.ts` (après le `turndownService`) :

```ts
export const DETAIL_LIMITS: Record<string, number> = {
  summary: 1500,
  medium: 4000,
  full: 50000,
};

/**
 * Keep the beginning of a markdown document within the detail level's budget.
 * The cut happens on a line boundary; a code block cut in the middle is closed
 * so the result stays valid markdown.
 */
export function extractContent(markdown: string, detailLevel: string = 'medium'): { content: string; truncated: boolean } {
  const maxLength = DETAIL_LIMITS[detailLevel] ?? DETAIL_LIMITS.medium;
  if (markdown.length <= maxLength) return { content: markdown, truncated: false };

  const kept: string[] = [];
  let length = 0;
  let inCodeBlock = false;
  for (const line of markdown.split('\n')) {
    if (length + line.length + 1 > maxLength) break;
    kept.push(line);
    length += line.length + 1;
    if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;
  }

  let content = kept.join('\n').trimEnd();
  if (inCodeBlock) content += '\n```';
  return { content, truncated: true };
}
```

Dans les deux services : supprimer la méthode privée `extractIntelligentContent` (et son JSDoc), importer `{ extractContent }` depuis `./markdown.js` (à côté de `turndownService`), puis :
- `springboot-docs-optimized.ts` (`processHtmlGuide`, ~l.557-560) : `const { content: extractedContent, truncated } = extractContent(markdown, detailLevel);` ; la notice devient `truncated ? (detailLevel === 'full' ? '\n\n---\n*Content truncated at 50,000 characters even in full mode. Visit the link above for the complete guide.*' : '\n\n---\n*Content truncated for brevity. Use detail_level="full" for complete guide or visit the link above.*') : ''`. Supprimer `needsTruncation`.
- `advanced-features.ts` (`getTutorial`, ~l.167-170) : même principe avec les textes `Content truncated at 50,000 characters even in full mode. Visit the link above for the complete tutorial.` / `Content truncated. Use detail_level="full" for complete tutorial or visit the link above.`.

Dans `src/tools/index.ts`, remplacer `full (8000 chars)` par `full (50000 chars)` aux deux endroits (descriptions de `detail_level`, guide et tutoriel).

Puis régénérer : `npm run build && npm run docker:tools`.

- [ ] **Step 4: Vérifier** : `npm test` → build OK, tous les tests verts (dont `docker-tools.test.ts` et `extract-content.test.ts`).

- [ ] **Step 5: Commit** : `git add src tests docker && git commit -m "fix: extractContent sans perte (troncature en préfixe, blocs refermés) factorisé dans markdown.ts, full à 50000 caractères"`

### Task 2: backlog

- [ ] Après vérification réelle de `npm test`, cocher #25 dans `IMPROVE.md` (` — Fait le 2026-10-02`).
