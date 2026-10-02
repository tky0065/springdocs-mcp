# Aligner les versions (#13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule version (1.2.8, celle de `package.json`) partout : handshake MCP, User-Agent, Dockerfile, CLAUDE.md.

**Architecture:** `src/version.ts` lit `package.json` via `createRequire` et exporte `VERSION` et `USER_AGENT`. Les deux services et `src/index.ts` les importent. `package.json`, le CHANGELOG et le tag `v1.3.0` ne changent pas.

**Tech Stack:** TypeScript (Node16, ESM), Node 18+.

**Spec:** design validé dans le chat le 2026-10-02 (tâche #13 d'IMPROVE.md).

## Global Constraints

- Version de référence : `1.2.8` (publiée sur npm). Pas de release, pas de bump.
- Hors périmètre : logique de `fetchWithRetry` (#6), `README.md:310` et `CONTRIBUTING` (#46).

## Review Focus

- `package.json` introuvable depuis `build/` : il est dans `files` et à `../package.json` de `build/version.js`.

---

### Task 1: Source unique de version

**Files:**
- Create: `src/version.ts`
- Modify: `src/index.ts:22`, `src/services/springboot-docs-optimized.ts:558`, `src/services/advanced-features.ts:588`, `Dockerfile:34,37,68`, `CLAUDE.md:81`

**Interfaces:**
- Produces: `VERSION: string`, `USER_AGENT: string` (`Spring-Docs-MCP/${VERSION}`) depuis `src/version.ts`.

- [ ] **Step 1: Constater l'état actuel** : `grep -rn "1\.2\.4\|1\.2\.5" src Dockerfile CLAUDE.md` liste 4 occurrences (`index.ts:22`, deux User-Agent, `CLAUDE.md:81`).
- [ ] **Step 2: Créer `src/version.ts`** : `createRequire(import.meta.url)("../package.json")`, export `VERSION` et `USER_AGENT`.
- [ ] **Step 3: Remplacer** les trois littéraux dans `src/` par `VERSION` / `USER_AGENT` (+ import), puis passer `Dockerfile` et `CLAUDE.md` à 1.2.8.
- [ ] **Step 4: Vérifier** : `npm run build` ; `node -e "import('./build/version.js').then(m=>console.log(m.VERSION))"` affiche `1.2.8` ; un `initialize` JSON-RPC sur `build/index.js` renvoie `serverInfo.version == "1.2.8"` ; `grep -rn "1\.2\.4\|1\.2\.5" src Dockerfile CLAUDE.md` est vide.
- [ ] **Step 5: Commit** sur la branche de travail, sans ligne d'attribution Claude (règle du CLAUDE.md global).
