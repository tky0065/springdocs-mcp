# Tests automatisés vitest + CI (#12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Une vraie suite `npm test` (vitest 3, compatible Node 18) couvrant #6, #7, #9, #13, et une CI qui la lance.

**Architecture:** Tests dans `tests/` (hors `tsc` et hors package publié). Services testés avec `vi.mock('node-fetch')` + fausses minuteries ; serveur testé en spawnant `build/index.js`. `npm test` = build + `vitest run`.

**Tech Stack:** vitest ^3.2.7, TypeScript, GitHub Actions.

**Spec:** design validé dans le chat le 2026-10-02 (tâche #12).

## Global Constraints

- Node >= 18 (vitest 3 seulement ; vitest 4/5 exigent Node >= 20/22).
- Aucun accès réseau dans les tests.
- Hors périmètre : lint, README/CONTRIBUTING (#46), `test-npx` (#30).

## Review Focus

- Les tests doivent échouer quand on casse le comportement (contrôle par mutation).
- Le test stdio dépend de `build/` : `npm test` construit d'abord.

---

### Task 1: Suite de tests + CI

**Files:**
- Create: `vitest.config.ts`, `tests/fetch-retry.test.ts`, `tests/error-propagation.test.ts`, `tests/stdio.test.ts`, `tests/version.test.ts`, `tests/fixtures/*.html`, `.github/workflows/ci.yml`
- Modify: `package.json` (devDependency + script `test`), `.github/workflows/publish.yml` (étape test), `CLAUDE.md` (bloc Testing)

- [ ] **Step 1: Installer vitest@^3.2.7, config, script `test`.**
- [ ] **Step 2: Écrire les 4 fichiers de tests** (cas listés dans le design).
- [ ] **Step 3: `npm test`.** Expected: tout PASS.
- [ ] **Step 4: Contrôle par mutation** : casser le retry 5xx, la non-mise en cache des échecs, la version → les tests concernés échouent ; restaurer.
- [ ] **Step 5: CI** (`ci.yml`, étape dans `publish.yml`), `CLAUDE.md`, validation YAML.
- [ ] **Step 6: Commit** sur `fix/align-versions`, sans ligne d'attribution Claude.
