# Plafond de taille des réponses HTTP Implementation Plan (#21)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher qu'une réponse HTTP géante sature la mémoire/CPU : plafond dur à 5 MiB dans `fetchWithRetry`.

**Architecture:** On passe `size: MAX_RESPONSE_BYTES` à node-fetch 3 (qui compte les octets pendant la lecture et lève une `FetchError` de type `max-size`). Un pré-contrôle `Content-Length` rejette avant lecture. Le dépassement n'est jamais retenté.

**Tech Stack:** TypeScript (Node16), node-fetch 3.3.2, vitest 3.

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #21.

## Global Constraints

- Plafond : `MAX_RESPONSE_BYTES = 5 * 1024 * 1024` (5 MiB), constante exportée de `src/services/http.ts`, pas de variable d'environnement.
- Message d'erreur exact : `Response from <url> exceeds the 5 MiB limit`.
- Dépassement = erreur immédiate, **aucun retry** ; comportement des réponses normales, 4xx et 5xx inchangé.
- Fichiers touchés : `src/services/http.ts` et `tests/fetch-retry.test.ts` uniquement. Imports `.js`, commentaires en anglais.
- Pas de ligne d'attribution Claude dans les commits.

## Review Focus

- Un `content-length` supérieur au plafond rejette **sans** lire le corps (`text()` non appelé) et sans retry.
- Un `content-length` absent ou non numérique ne casse rien (on laisse `size` faire le travail).
- Une erreur `max-size` levée par `text()` n'est pas retentée (un seul appel à `fetch`).
- Les autres erreurs réseau continuent d'être retentées comme avant.

---

### Task 1: plafond de taille dans `fetchWithRetry`

**Files:**
- Modify: `src/services/http.ts`
- Test: `tests/fetch-retry.test.ts` (ajouter un `describe` à la fin du fichier ; réutilise `fakeResponse`, `settle`, `mockedFetch`, `URL_UNDER_TEST` déjà définis)

**Interfaces:**
- Produces: `export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;` ; `fetchWithRetry` rejette avec `Error('Response from <url> exceeds the 5 MiB limit')` sur dépassement.

- [ ] **Step 1: Écrire les tests qui échouent.** Dans `tests/fetch-retry.test.ts`, ajouter l'import `import { MAX_RESPONSE_BYTES } from "../src/services/http.js";` puis ce bloc à la fin du fichier :

```ts
describe("plafond de taille des réponses (#21)", () => {
  const call = () => (new AdvancedFeaturesService() as any).fetchWithRetry(URL_UNDER_TEST);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passe le plafond à node-fetch via l'option size", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "ok"));

    await settle(call());

    expect(mockedFetch).toHaveBeenCalledWith(URL_UNDER_TEST, expect.objectContaining({ size: MAX_RESPONSE_BYTES }));
  });

  it("rejette sans retry quand la lecture dépasse le plafond (max-size)", async () => {
    const tooBig = { ...fakeResponse(200), text: async () => { throw Object.assign(new Error("over"), { type: "max-size" }); } };
    mockedFetch.mockResolvedValue(tooBig);

    const outcome = await settle(call());

    expect(!outcome.ok && (outcome.error as Error).message).toBe(`Response from ${URL_UNDER_TEST} exceeds the 5 MiB limit`);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("rejette sans lire le corps quand content-length dépasse le plafond", async () => {
    const text = vi.fn(async () => "x");
    mockedFetch.mockResolvedValue({ ...fakeResponse(200, "x", { "content-length": String(MAX_RESPONSE_BYTES + 1) }), text });

    const outcome = await settle(call());

    expect(!outcome.ok && (outcome.error as Error).message).toMatch(/exceeds the 5 MiB limit/);
    expect(text).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("ignore un content-length non numérique", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "ok", { "content-length": "abc" }));

    const outcome = await settle(call());

    expect(outcome.ok && await outcome.value.text()).toBe("ok");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/fetch-retry.test.ts` → FAIL (`MAX_RESPONSE_BYTES` non exporté, pas d'option `size`).

- [ ] **Step 3: Implémenter** dans `src/services/http.ts` :

```ts
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MiB

class ResponseTooLargeError extends Error {
  constructor(url: string) {
    super(`Response from ${url} exceeds the 5 MiB limit`);
  }
}
```

Dans `fetch(url, {...})` ajouter `size: MAX_RESPONSE_BYTES,` aux options. Juste après l'appel `fetch` et avant `response.text()` :

```ts
      // Reject early when the server announces a body above the limit
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw new ResponseTooLargeError(url);
      }
      // Read the body before clearing the timeout so the timeout also covers it
      let body: string;
      try {
        body = await response.text();
      } catch (error) {
        // node-fetch aborts the read once `size` is exceeded
        if ((error as { type?: string }).type === 'max-size') throw new ResponseTooLargeError(url);
        throw error;
      }
```

(en remplaçant la ligne `const body = await response.text();` et son commentaire). Dans le `catch (error)` principal, en première ligne : `if (error instanceof ResponseTooLargeError) throw error; // never retried`.

Attention : `Number(null)` vaut 0 (en-tête absent → pas de rejet) et `Number("abc")` vaut NaN (pas de rejet) : c'est le comportement voulu.

- [ ] **Step 4: Vérifier** : `npm test` → build OK, tous les tests verts (≥ 109).

- [ ] **Step 5: Commit** : `git add src/services/http.ts tests/fetch-retry.test.ts && git commit -m "fix: plafonner la taille des réponses HTTP à 5 MiB sans retry sur dépassement"`

### Task 2: backlog

- [ ] Après vérification réelle de `npm test`, cocher #21 dans `IMPROVE.md` (` — Fait le 2026-10-02`).
