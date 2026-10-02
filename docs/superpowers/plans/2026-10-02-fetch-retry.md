# fetchWithRetry robuste (#6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `fetchWithRetry` réessaie sur 429/5xx, son timeout couvre la lecture du corps, le backoff est exponentiel.

**Architecture:** Dans chaque service, `fetchWithRetry` lit le corps dans la boucle (avant `clearTimeout`) et retourne `{ ok, status, text(), json() }`. Les appelants ne changent pas. Pas de déduplication (#27).

**Spec:** design validé dans le chat le 2026-10-02 (tâche #6).

## Global Constraints

- Retry : 429 et 5xx uniquement ; autres statuts retournés sans retry (404 sert aux fallbacks de `getGuide`).
- Dernier essai en 429/5xx : retourner la réponse, ne pas lever (#9 traitera la propagation).
- Backoff `1000 * 2^(attempt-1)` ms ; `Retry-After` (secondes) prioritaire, plafonné à 10 s.
- Logs de retry sur `console.error` uniquement (stdout = JSON-RPC).

## Review Focus

- Corps bloqué : le timeout doit l'interrompre puis réessayer.
- `Retry-After` non numérique ou absent : retomber sur le backoff.

---

### Task 1: fetchWithRetry dans les deux services

**Files:**
- Modify: `src/services/springboot-docs-optimized.ts:549-574`, `src/services/advanced-features.ts:579-604`
- Test (jetable, scratchpad, remplacé par vitest dans #12) : `retry-smoke.mjs`

**Interfaces:**
- Produces: `fetchWithRetry(url, timeout?, retries?) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }>`

- [ ] **Step 1: Écrire le smoke test** (serveur HTTP local) : 503,503,200 → succès en 3 essais ; 404 → 1 seul appel ; corps bloqué puis 200 avec timeout 300 ms → succès ; 429 + `Retry-After: 1` → attente ≈ 1 s ; 503 permanent → retourne `ok:false, status:503` après 3 essais. Chaque cas sur les deux services.
- [ ] **Step 2: Le lancer sur le code actuel.** Expected: FAIL (503 retourné au premier appel, pas de retry).
- [ ] **Step 3: Implémenter** dans les deux fichiers.
- [ ] **Step 4: `npm run build` puis relancer le smoke test.** Expected: tous les cas PASS.
- [ ] **Step 5: Commit** sur `fix/align-versions`, sans ligne d'attribution Claude.
