# Tool find_spring_dependency : design

IMPROVE.md #51. Date : 2026-10-02.

## Objectif

À partir d'un besoin en langage naturel (« jpa », « postgres driver », « oauth2 »), renvoyer les starters Spring correspondants avec leurs coordonnées Maven et des snippets prêts à coller pour Maven et/ou Gradle. Données réelles de Spring Initializr, aucune coordonnée inventée.

## Décisions validées

- Tool 17 `find_spring_dependency` ; recherche par mots-clés (anglais, sans synonymes) ; 5 meilleurs résultats ; snippets Maven et Gradle.
- Les coordonnées viennent de `GET https://start.spring.io/dependencies` ; noms et descriptions de `GET https://start.spring.io/metadata/client` (déjà utilisé par `get_spring_initializr`).

## Faits vérifiés sur l'API (2026-10-02)

- `/dependencies` : 179 entrées `{ groupId, artifactId, scope, bom?, version?, repository? }`, plus `boms` (`{ groupId, artifactId, version }` par nom) et `repositories` (`{ name, url, … }`). Scopes : `compile` (155), `runtime` (19), `test` (3), `annotationProcessor` (2, Lombok et un autre).
- 75 entrées ont un `bom`, 6 une `version` explicite, 1 un `repository` (`security-saml2`).
- `native` et `sbom-cyclone-dx` ont l'artefact `spring-boot` : ce sont des plugins de build, pas des dépendances.
- 25 ids du catalogue `/metadata/client` n'ont pas d'entrée dans `/dependencies`.
- Le résultat dépend de la version de Spring Boot : on utilise la version par défaut d'Initializr, et la sortie l'indique.

## Interface du tool

| Paramètre | Type | Règle |
|---|---|---|
| `need` | string, obligatoire | `maxLength` 100, non vide ni blanc |
| `build` | string, optionnel | enum `maven` \| `gradle` \| `both`, défaut `both` |

La description du tool précise que `need` doit être formulé avec des mots-clés en anglais.

## Recherche

- Mots de `need` : minuscules, découpés sur tout caractère non alphanumérique, longueur ≥ 2, sans mots vides (`a, an, the, for, with, to, and, of, in, on, my, i, want, need, use, using, spring`).
- Aucun mot exploitable après filtrage → erreur claire (« need must contain at least one searchable word »).
- Score d'une dépendance, somme sur les mots : id égal au mot +10 ; id contient le mot +5 ; nom contient le mot +4 ; description contient le mot +1. Il faut au moins un mot qui correspond. Comparaison par sous-chaîne littérale (jamais de regex).
- Tri : score décroissant, puis id le plus court, puis ordre alphabétique de l'id. On garde 5 résultats ; si plus de 5 dépendances correspondent, la sortie ajoute « N more matches, refine the query ».
- Aucun résultat : message qui suggère des mots-clés anglais et renvoie vers `get_spring_initializr` avec `section: "dependencies"`.

## Snippets

Scope → Maven / Gradle :

| scope | Maven | Gradle |
|---|---|---|
| `compile` | `<dependency>` sans `<scope>` | `implementation("g:a")` |
| `runtime` | `<scope>runtime</scope>` | `runtimeOnly("g:a")` |
| `test` | `<scope>test</scope>` | `testImplementation("g:a")` |
| `annotationProcessor` | `<optional>true</optional>` | `compileOnly("g:a")` + `annotationProcessor("g:a")` |

Les parenthèses et guillemets doubles sont valides en DSL Groovy comme Kotlin.

Cas particuliers :
- **BOM** : le snippet de dépendance est précédé de l'import du BOM avec sa version (Maven : `<dependencyManagement>` avec `<type>pom</type>` et `<scope>import</scope>` ; Gradle : `implementation(platform("g:a:v"))`).
- **Version explicite** : ajoutée à la dépendance (`<version>` / `g:a:v`).
- **Dépôt supplémentaire** : note « requires the repository <name> (<url>) » (le snippet de déclaration du dépôt n'est pas généré).
- **Plugin de build** (`native`, `sbom-cyclone-dx`, détectés par `artifactId == "spring-boot"` sans autre artefact) : fiche sans snippet, avec « build plugin, not a dependency: enable it in the build configuration ».
- **Sans coordonnées** (absent de `/dependencies`) : fiche sans snippet, avec « no Maven coordinates published by Initializr for this id ».

## Composants

- `src/services/dependency-finder.ts` (pur, sans réseau) : `searchWords(need)`, `rankDependencies(meta, need)`, `buildSnippets(coordinates, boms, build)`, `formatDependencyMatches(...)`.
- `src/services/initializr.ts` : `loadCoordinates()` (fetch `/dependencies` via `fetchWithRetry`, contrôle de forme, `setLongTerm` sous la clé `initializr:dependencies`, rien en cache en cas d'échec) ; `findDependency(need, build)` qui charge les deux jeux de données puis délègue au module pur.
- `src/tools/index.ts`, `src/index.ts` : schéma et routage du tool.

## Erreurs

- `need` vide ou sans mot exploitable : erreur (`isError`) avant tout réseau.
- Réponse HTTP non OK ou forme inattendue (`dependencies` absent) : erreur claire, rien en cache.

## Tests

- Fixtures réduites pour `/dependencies` et `boms`, réutilisation de `tests/fixtures/initializr.json` pour les métadonnées (cas BOM/version/dépôt/plugin/sans coordonnées avec des entrées dédiées).
- Classement : id exact > id contenant > nom > description ; mots vides ; tri stable ; plafond à 5 avec message ; aucun résultat.
- Snippets : un test par scope et par cas particulier, pour Maven et Gradle, et `build` = `maven` / `gradle` / `both`.
- Robustesse : `need` avec `.*(` traité littéralement ; `need` vide, blanc ou constitué de mots vides rejeté ; cache (un seul fetch par source pour deux appels) ; erreur HTTP non mise en cache ; validation du schéma ; synchro `docker/tools.json`.
- Vérification sur l'API réelle (hors suite) : `jpa`, `postgres`, `lombok`, `spring ai openai`, `saml`.

## Hors périmètre

Paramètre de version de Spring Boot, synonymes et recherche en français, génération de projet, détection de conflits entre dépendances, génération de la déclaration du dépôt supplémentaire.

## Synchro et docs

Compteurs de tools 16 → 17 (README, CLAUDE.md, `docker/README.md`, landing, tests), régénération de `docker/tools.json`, carte sur la landing, mention du module dans CLAUDE.md.
