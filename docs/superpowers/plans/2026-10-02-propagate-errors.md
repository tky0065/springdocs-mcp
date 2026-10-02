# Propager les erreurs réseau, ne pas les mettre en cache (#9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Une panne réseau n'est ni avalée ni mise en cache : elle remonte (`isError` via `index.ts`), sauf échec partiel d'un agrégateur.

**Architecture:** Les méthodes feuilles lèvent au lieu de renvoyer `[]`/texte d'erreur. `searchSpringDocs` et `searchEcosystem` tentent chaque source séparément : tout échoue → ils lèvent ; échec partiel → résultats des autres sources, rien en cache (+ ligne d'avertissement pour l'écosystème). Succès complet → cache comme avant.

**Tech Stack:** TypeScript ; smoke test jetable (`fetchWithRetry` remplacé par un faux via `as any`), repris en vitest dans #12.

**Spec:** design validé dans le chat le 2026-10-02 (tâche #9).

## Global Constraints

- `index.ts:113-123` convertit déjà toute exception en `isError: true` : ne pas le modifier.
- Logs sur `console.error` uniquement (stdout = JSON-RPC).
- Pas de déduplication des deux services (#27).

## Review Focus

- Échec partiel : second appel identique doit refaire les requêtes (non caché).
- Toutes sources en échec : rejet, pas de résultat vide mis en cache.

---

### Task 1: Propager les erreurs dans les deux services

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts`, `src/services/advanced-features.ts`
- Test (jetable, scratchpad) : `errors-smoke.mjs`

- [ ] **Step 1: Écrire le smoke test** : faux `fetchWithRetry` ; cas : (a) `searchSpringDocs('all')` toutes sources en 503 → rejet + 2e appel refait des fetch ; (b) une source en panne → résultats partiels + 2e appel refait des fetch ; (c) tout OK → 2e appel sans fetch ; (d) `searchEcosystem` : tout en panne → rejet ; partiel → avertissement + non caché ; OK → caché ; (e) `getTutorial`/`compareVersions`/`getBestPractices`/`searchConcepts` en panne → rejet.
- [ ] **Step 2: Lancer sur le code actuel.** Expected: FAIL (résultats vides mis en cache, textes « Error » renvoyés).
- [ ] **Step 3: Implémenter** (feuilles qui lèvent, `catch` de texte retirés, agrégateurs par source).
- [ ] **Step 4: `npm run build`, relancer le smoke test, smoke `initialize`.** Expected: tous PASS.
- [ ] **Step 5: Commit** sur `fix/align-versions`, sans ligne d'attribution Claude.
