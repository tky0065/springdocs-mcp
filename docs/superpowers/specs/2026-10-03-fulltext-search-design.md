# Recherche plein texte locale (BM25) : design

IMPROVE.md #52 · 2026-10-03 · Classification : architecturale

## Objectif

`search_spring_docs` compare aujourd'hui la requête, en sous-chaîne, aux titres de la table des matières et aux titres/descriptions des guides. Une requête comme « configure datasource pool » ne trouve rien. L'objectif est de retrouver les pages dont le **contenu** est pertinent, classées par score BM25, à partir d'un index en mémoire construit paresseusement.

## Décisions validées

- **Corpus** : uniquement les pages que le serveur télécharge déjà (projets, référence, guides, migration). Aucune requête réseau ajoutée.
- **Interface** : pas de nouveau tool. Nouveau `docType="content"` de `search_spring_docs`, inclus dans `all`. Le compteur de tools (17) ne change pas.
- **Dépendances** : aucune. BM25 est écrit à la main.
- **Hors ligne** : l'index vit en mémoire, rien n'est écrit sur disque.

## Architecture

### `src/services/search-index.ts` (module pur, sans réseau)

```ts
class SearchIndex {
  constructor(opts?: { maxChars?: number })      // défaut 8_000_000
  add(docId: string, doc: { title: string; url: string; text: string }): void
  search(query: string, limit: number): SearchHit[]
  get size(): number                              // documents indexés
}
type SearchHit = { docId: string; title: string; url: string; score: number; snippet: string }
```

- `add` est idempotent : un `docId` déjà présent est remplacé.
- **Tokenisation** : minuscules, découpe sur tout caractère hors `[a-z0-9]`, en conservant `.` et `-` internes à un mot (`spring.datasource.url` reste un jeton, et ses fragments sont aussi indexés). Stopwords anglais courts. Jetons de 1 caractère ignorés.
- **Score** : BM25 (k1 = 1,2, b = 0,75), titre pondéré ×3. Le calcul d'IDF et de longueur moyenne est recalculé au `search` à partir de compteurs maintenus à l'`add`/éviction (pas de reconstruction complète).
- **Extrait** : fenêtre d'environ 200 caractères autour de la première occurrence du terme le mieux noté, sans couper un mot.
- **Budget** : somme des longueurs de `text` plafonnée à `maxChars`. Au dépassement, éviction du document le plus anciennement ajouté (ordre d'insertion d'une `Map`) jusqu'à rentrer dans le budget. Un document seul plus grand que le budget est tronqué à son préfixe.
- Requête vide, ou ne contenant que des stopwords : renvoie `[]`.

### Alimentation (`springboot-docs-optimized.ts`, `advanced-features.ts` si nécessaire)

L'index est possédé par `SpringBootDocsServiceOptimized` et injecté par constructeur (comme le cache, pour garder les tests isolés). À chaque obtention d'un markdown complet, le service appelle `index.add` :

- `getProjectMarkdown` → `docId = "project:<slug>"`
- référence (`getSpringReference`, markdown complet avant pagination) → `docId = "reference:<projet>:<version>:<section>"`
- guides (`getGuide`) → `docId = "guide:<id>"`
- migration (`get_migration_guide`) : hors périmètre (lue par `boot-wiki.ts`, hors `SpringBootDocsServiceOptimized`) ; candidat backlog.

L'ajout est un effet de bord : il ne change ni les sorties ni le cache existants, et une exception de l'index est interceptée et journalisée sur stderr sans casser la lecture.

### Interface de recherche

- `docType` accepte `content` ; `all` = `guides` + `projects` + `reference` + `content`. Valeur inconnue : erreur explicite existante.
- Les résultats `content` portent `type: "content"`, `title`, `url`, `description` = extrait, et un `score`.
- Dédoublonnage : un résultat `content` dont l'URL est déjà présent dans les résultats de titres est ignoré (le résultat de titres prime).
- **Index vide** : si `index.size === 0` et que `docType` inclut `content`, la réponse ajoute une entrée de type `note` « Index de contenu vide : lisez d'abord une page (get_spring_project, get_spring_reference, get_spring_guide) pour l'alimenter ».
- **Cache** : les résultats `content` dépendent de l'état de l'index et ne sont jamais mis en cache. Le cache de `searchSpringDocs` ne contient que les sources de titres ; la source `content` est évaluée à chaque appel. Un échec de l'index ne compte pas comme un échec de source.

### Impact documentaire et schéma

- `src/tools/index.ts` : enum `docType` + description.
- `docker/tools.json` régénéré (le test de synchro existant le contrôle).
- `README.md`, `CLAUDE.md` : mention de `content` et de l'architecture (nouveau module). Compteurs de tools inchangés.

## Tests (vitest, sans réseau)

- `search-index.test.ts` : tokenisation (`spring.datasource.url`), ordre BM25 sur un corpus de 4 documents, pondération du titre, remplacement idempotent, éviction au dépassement du budget, document plus grand que le budget, requête vide / stopwords seuls, extrait sans mot coupé.
- `fulltext-search.test.ts` : lecture d'une page (fixture, fetch mocké) puis recherche `content` qui la trouve ; recherche à froid → note d'index vide ; `all` fusionne titres + contenu avec dédoublonnage ; résultats `content` non mis en cache ; exception de l'index sans effet sur la lecture.
- `docker-tools.test.ts` doit rester vert.

## Hors périmètre

Pré-téléchargement du corpus, persistance disque, synonymes, stemming, recherche par version (autre candidat du backlog), pondération par type de page.

## Critères de réussite

`npm test` vert (build + vitest), `docker/tools.json` synchronisé, `search_spring_docs` avec `docType="content"` renvoie des pages classées après lecture d'une page, et signale clairement l'index vide à froid.
