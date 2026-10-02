# Migrer le SDK MCP vers 1.x (#7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remplacer `@modelcontextprotocol/sdk` 0.5.0 (vulnérable `<1.24.0`) par `^1.31.0` sans changer le comportement des 12 tools.

**Architecture:** On garde l'API bas niveau `Server` + `setRequestHandler` ; seuls les ajustements de types éventuels dans `src/index.ts`. Pas de `McpServer` (zod, #18/#47).

**Spec:** design validé dans le chat le 2026-10-02 (tâche #7).

## Global Constraints

- Node >= 18 (`engines`), imports ESM Node16 inchangés.
- Stdout = JSON-RPC uniquement.
- Hors périmètre : `undici` (#20), resources/HTTP (#47/#53).
- Si le build/handshake exige plus que des ajustements de types dans `index.ts` : s'arrêter et demander.

## Review Focus

- Négociation du protocole : client en `2024-11-05` doit toujours être servi.
- `tools/call` en erreur : `isError: true` conservé.

---

### Task 1: Migration SDK

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/index.ts` (si nécessaire), `CLAUDE.md` (version de protocole)
- Test (jetable, scratchpad) : `sdk-smoke.mjs`

- [ ] **Step 1: Smoke test jetable** (spawn `node build/index.js`, JSON-RPC stdio) : `initialize` 2024-11-05 → `serverInfo.version "1.2.8"` ; `tools/list` → 12 tools ; `tools/call` argument invalide → `isError: true` ; `tools/call` unknown tool → `isError: true`.
- [ ] **Step 2: Lancer sur le build actuel (SDK 0.5.0).** Expected: PASS (baseline de comportement).
- [ ] **Step 3: `npm install @modelcontextprotocol/sdk@^1.31.0`, `npm run build`**, corriger les erreurs de types dans `src/index.ts`.
- [ ] **Step 4: Relancer le smoke test + `npm audit`.** Expected: PASS ; SDK absent de l'audit ; `initialize` avec la dernière version de protocole du SDK répond aussi.
- [ ] **Step 5: Commit** sur `fix/align-versions`, sans ligne d'attribution Claude.
