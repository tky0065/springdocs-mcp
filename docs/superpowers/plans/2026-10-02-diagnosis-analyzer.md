# Analyseur de stack trace pour diagnose_spring_issues Implementation Plan (#36)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le diagnostic actuel (recherche réseau sur 3 mots + bloc fixe) par une analyse locale, déterministe et bornée : chaîne d'exceptions, cause racine, première frame applicative, composant déduit, règles de causes probables, références réelles du registre.

**Architecture:** Module pur `src/services/diagnosis.ts` (extraction, règles, rendu) appelé par `AdvancedFeaturesService.diagnoseIssues`, qui n'effectue plus aucun appel réseau. Schéma d'entrée et cache (sha256, #23) inchangés.

**Tech Stack:** TypeScript (Node16), vitest 3.

**Spec:** design approuvé dans le chat (bounded). Backlog : `IMPROVE.md` #36.

## Global Constraints

- **Aucun appel réseau** dans l'analyse ni dans `diagnoseIssues` (le test vérifie `fetch` non appelé). `searchDocumentation` reste utilisée par `searchEcosystem` : ne pas la supprimer.
- **Aucun changement** de schéma, de `docker/tools.json`, de `src/index.ts`, ni du compteur de tools (14). Le cache `diagnosis:<sha256>` de #23 est conservé tel quel.
- **Robustesse / DoS** : pas de regex à backtracking. Entrées plafonnées dans le module : `stackTrace` → 400 premières lignes et 20 000 caractères au plus ; `errorMessage` → 2 000 caractères ; chaque ligne analysée → 500 caractères. Correspondance des règles par `includes` sur du texte en minuscules. Seules les regex linéaires ancrées et sans quantificateur imbriqué sont admises (p. ex. `/^[A-Za-z0-9_.$]+$/`). Un test envoie des entrées pathologiques et exige un temps borné (< 500 ms chacune).
- **Extraction** : lignes d'en-tête d'exception = lignes qui ne commencent pas par `at ` ni `...` ; après retrait des préfixes `Caused by: ` et `Exception in thread "<nom>" `, le jeton avant le premier `:` (ou la ligne entière) ne contient que `[A-Za-z0-9_.$]` et son dernier segment (après le dernier `.`) se termine par `Exception`, `Error` ou `Throwable`. `chain` = liste ordonnée `{ type, message }` (message = texte après le premier `: `, `''` sinon, tronqué à 300 caractères) ; `top` = premier maillon, `root` = dernier. Les anciens formats « …; nested exception is X: msg » ne sont pas décomposés (hors périmètre) mais restent dans le texte analysé par les règles.
- **Première frame applicative** = première ligne `at <classe.méthode>(<fichier>:<ligne>)` dont le nom qualifié commence par aucun de : `java.`, `javax.`, `jakarta.`, `jdk.`, `sun.`, `com.sun.`, `org.springframework.`, `org.apache.`, `org.hibernate.`, `com.fasterxml.`, `io.netty.`, `reactor.`, `org.aspectj.`, `net.bytebuddy.`, `org.junit.`, `org.eclipse.`, `org.jboss.`, `org.slf4j.`, `ch.qos.`, `com.zaxxer.`. Affichée telle quelle (ligne `at …` rognée).
- **Composant déduit** (uniquement si le paramètre `component` est absent), première frame de la trace (dans l'ordre) dont le nom contient : `org.springframework.security` → `security` ; `org.springframework.data`, `org.hibernate`, `jakarta.persistence`, `javax.persistence`, `org.springframework.jdbc`, `org.springframework.orm` → `data` ; `org.springframework.boot.actuate` → `actuator` ; `org.springframework.web`, `org.apache.catalina`, `org.apache.tomcat`, `com.fasterxml.jackson` → `web` ; `org.springframework.boot.context.properties`, `org.springframework.boot.autoconfigure` → `configuration` ; `org.springframework.beans`, `org.springframework.context`, `org.springframework.boot.SpringApplication` → `startup`. Sinon aucun.
- **Références** : couples `(projectId, section, subsection?)` du registre ; URL via `springProjectsConfig.buildReferenceUrl` (**sans** version) ; ligne rendue : `- <Titre> — <url> (get_spring_reference: project="<id>", section="<section>"[, subsection="<sub>"])`. Dédoublonnées par URL. Chaque couple doit passer `validateSection`. Table de références **autorisées** (toutes valides dans le registre) : `boot`: `features`, `using`, `web`, `data`, `actuator`, `application-properties`, `deployment` ; `framework`: `core`+`beans`, `web`, `data-access` ; `data-jpa`: `jpa`, `jpa`+`transactions` ; `security`: `servlet`, `authentication`, `authorization`, `exploits`. **Aucune autre** référence. L'implémenteur vérifie chaque URL construite en ligne (`curl -s -o /dev/null -L -m 15 -w '%{http_code}' -A springdocs-mcp-probe`, en parallèle) et retire/remplace toute référence qui ne répond pas 200 (le signaler).
- **Références par composant** (ajoutées, dédoublonnées, après celles des règles) : `startup` → boot `using` ; `web` → boot `web` ; `data` → boot `data` ; `security` → security `servlet` ; `actuator` → boot `actuator` ; `configuration` → boot `features` + boot `application-properties`.
- **Format de sortie** (anglais) : `# Spring Boot Issue Diagnosis`, `**Error:** <errorMessage>`, `**Component:** <c>` (suffixe ` (inferred from the stack trace)` si déduit), puis `## Exception Summary` (uniquement si une chaîne existe : lignes `**Exception:**`, `**Root cause:**` (type + message) et `**Your code:**` si une frame applicative existe ; si la chaîne ne compte qu'un maillon, pas de ligne `Root cause` distincte), `## Likely Cause` (une sous-section `### <titre>` par règle correspondante, dans l'ordre de la table, avec une phrase d'explication puis la liste `What to check:`), ou si aucune règle : `No known pattern matched this error. Read the root cause above (or the error message) and use the references below.`, `## Reference Documentation`, puis `## General Troubleshooting Steps` (les 4 points actuels, avec le lien Boot remplacé par `https://docs.spring.io/spring-boot/index.html` après vérification 200, sinon `https://docs.spring.io/spring-boot/reference/index.html`).
- **Règles** (ordre = ordre d'affichage ; correspondance : au moins un des `needles` présent, en minuscules, dans le texte analysé = `errorMessage` + lignes d'en-tête d'exception de la trace) :

| id | needles | titre | pistes « What to check » (anglais, 2 à 4 puces) | références |
|---|---|---|---|---|
| `non-unique-bean` | `nouniquebeandefinitionexception`, `expected single matching bean but found` | Several beans match the injection point | mark one candidate `@Primary`; select explicitly with `@Qualifier` or a matching parameter name; inject `List<T>`/`Map<String, T>` to receive all candidates | framework core+beans |
| `missing-bean` | `nosuchbeandefinitionexception`, `no qualifying bean of type` | A required bean is missing | the class is outside the `@SpringBootApplication` package or lacks `@Component`/`@Service`/`@Repository`; the `@Bean` method or auto-configuration condition is not met (start with `--debug` to read the conditions report); a profile or `@ConditionalOn…` excludes it; a starter dependency is missing | framework core+beans, boot using |
| `circular-dependency` | `beancurrentlyincreationexception`, `form a cycle`, `circular dependency`, `circular reference` | Circular dependency between beans | extract the shared logic into a third bean; break the cycle with `@Lazy` on one injection point or setter injection; Spring Boot 2.6+ forbids circular references by default — `spring.main.allow-circular-references=true` is a workaround, not a fix | framework core+beans, boot application-properties |
| `datasource` | `failed to configure a datasource`, `cannot determine embedded database driver class` | No usable DataSource | set `spring.datasource.url`, `username` and `password`; add the JDBC driver (or an embedded database such as H2) to the classpath; exclude `DataSourceAutoConfiguration` if the application needs no database | boot data, boot application-properties |
| `port-in-use` | `was already in use`, `port already in use`, `address already in use` | The server port is already taken | stop the process holding the port (for example `lsof -i :8080`); change `server.port`, or use `server.port=0` for a random port | boot web, boot application-properties |
| `config-binding` | `configurationpropertiesbindexception`, `failed to bind properties`, `binding to target` | Configuration properties cannot be bound | check the property name and value type (kebab-case is the canonical form); check `@Validated` constraints and required constructor-bound values; read the "Action" hint printed with the failure | boot features, boot application-properties |
| `http-message-not-readable` | `httpmessagenotreadableexception`, `json parse error`, `required request body is missing` | The request body cannot be read | the JSON does not match the target type (types, enums, unknown properties); the `Content-Type` is not `application/json`; an empty body is sent to a `@RequestBody` that is required | framework web, boot web |
| `lazy-initialization` | `lazyinitializationexception`, `could not initialize proxy`, `no session` | A lazy association is accessed outside a session | access the association inside a `@Transactional` boundary; load it with a fetch join or `@EntityGraph`; return a DTO projection instead of entities; do not rely on open-in-view | data-jpa jpa, boot data |
| `no-transaction` | `no entitymanager with actual transaction available`, `transactionrequiredexception` | A transaction is required | annotate the service method with `@Transactional`; calls must go through the Spring proxy (no self-invocation, not a private method); modifying queries need `@Modifying` and a transaction | data-jpa jpa+transactions, framework data-access |
| `classpath` | `classnotfoundexception`, `noclassdeffounderror`, `nosuchmethoderror`, `nosuchfielderror`, `abstractmethoderror` | Missing class or incompatible library versions | inspect the dependency tree (`mvn dependency:tree` or `gradle dependencies`); let Spring Boot's dependency management choose versions instead of overriding them; do a clean build; if the text mentions `javax.`, it may be the Jakarta migration — see `get_migration_guide` with version `3.0` and section `jakarta` | boot using |
| `access-denied` | `accessdeniedexception`, `invalid csrf token`, `could not verify the provided csrf token`, `forbidden` | Access denied by Spring Security | state-changing requests need the CSRF token unless CSRF is deliberately disabled for a stateless API; check the order of the `requestMatchers` rules; roles need the `ROLE_` prefix as an authority and `hasRole` adds it for you | security authorization, security exploits |
| `unsatisfied-dependency` | `unsatisfieddependencyexception` | Dependency injection failed | this exception only wraps the real failure: read the root cause above; typical causes are a missing or ambiguous bean, or a failing `@Bean` method | framework core+beans |
| `bean-creation` | `beancreationexception` | A bean could not be created | the exception wraps the cause: read the root cause above; check the constructor, `@PostConstruct` and the `@Bean` method for failures | framework core+beans |

- Imports `.js`, commentaires en anglais, pas d'attribution Claude dans les commits.

## Review Focus

- Sur une vraie stack trace `NoSuchBeanDefinitionException` imbriquée dans `UnsatisfiedDependencyException` puis `BeanCreationException` : `top` = `BeanCreationException`, `root` = `NoSuchBeanDefinitionException`, règles `missing-bean` + `unsatisfied-dependency` + `bean-creation` dans cet ordre de table, première frame applicative = celle de `com.acme…` et non une frame `org.springframework`.
- Aucun appel `fetch` ; `diagnoseIssues` fonctionne réseau coupé.
- Entrées pathologiques bornées : 50 000 caractères sans saut de ligne, 20 000 lignes `Caused by: X`, `((((…` répétés, ligne d'en-tête géante ; jamais d'exception.
- Pas de règle trouvée → message honnête + références du composant, pas d'exception.
- `component` fourni : jamais écrasé par la déduction ; absent : déduit et marqué `(inferred from the stack trace)`.
- Toutes les références de toutes les règles passent `validateSection` et produisent une URL sans version.
- Les 3 tests de `tests/diagnosis-cache.test.ts` restent vrais (composant dans la sortie, stack trace différente → sortie différente, cache servi sans `fetch`).

---

### Task 1: module pur `diagnosis.ts`

**Files:**
- Create: `src/services/diagnosis.ts`
- Test: `tests/diagnosis.test.ts` (nouveau)

**Interfaces:**
- Produces:

```ts
export interface ExceptionLink { type: string; message: string }
export interface TraceAnalysis {
  chain: ExceptionLink[];
  top?: ExceptionLink;
  root?: ExceptionLink;
  applicationFrame?: string;      // trimmed "at com.acme.Foo.bar(Foo.java:42)"
  inferredComponent?: string;     // one of startup|web|data|security|actuator|configuration
}
export function analyzeStackTrace(stackTrace?: string): TraceAnalysis;
export interface DiagnosisRule { id: string; needles: string[]; title: string; checks: string[]; references: Array<{ project: string; section: string; subsection?: string }> }
export const DIAGNOSIS_RULES: DiagnosisRule[];
export function matchRules(errorMessage: string, analysis: TraceAnalysis, stackTrace?: string): DiagnosisRule[];
export function renderDiagnosis(input: { errorMessage: string; component?: string; stackTrace?: string }, config?: SpringProjectsConfig): string;
```

- [ ] **Step 1: Écrire les tests qui échouent** `tests/diagnosis.test.ts`, en construisant des traces réalistes dans le test : (a) trace `BeanCreationException` ← `UnsatisfiedDependencyException` ← `NoSuchBeanDefinitionException: No qualifying bean of type 'com.acme.UserRepository' available` avec des frames `org.springframework…` puis `at com.acme.service.UserService.<init>(UserService.java:21)` → `chain` de 3 maillons, `top`/`root`, `applicationFrame`, règles `["missing-bean","unsatisfied-dependency","bean-creation"]` dans l'ordre de `DIAGNOSIS_RULES` ; (b) `Exception in thread "main" java.lang.IllegalStateException: boom` → chaîne d'un maillon ; (c) message seul `Port 8080 was already in use` → règle `port-in-use` sans trace, `chain` vide ; (d) `LazyInitializationException: could not initialize proxy - no Session` → `lazy-initialization` ; (e) `NoUniqueBeanDefinitionException` ne déclenche PAS `missing-bean` ; (f) trace inconnue (`com.acme.FooException: x`) → aucune règle, `renderDiagnosis` contient `No known pattern matched` et les références du composant ; (g) déduction : trace avec première frame `org.springframework.security.web…` et `component` absent → `inferredComponent: "security"` et sortie `**Component:** security (inferred from the stack trace)` ; `component: "web"` fourni → `**Component:** web` sans suffixe ; (h) première frame applicative : saute `java.`, `org.springframework.`, `org.hibernate.`, retient `com.acme.` ; absente si toutes les frames sont framework ; (i) **références** : pour chaque règle de `DIAGNOSIS_RULES`, chaque référence passe `springProjectsConfig.validateSection(project, section)` et `buildReferenceUrl(project, section, subsection)` ne contient pas de version et commence par `https://docs.spring.io/` ; aucune référence hors de la table autorisée des Global Constraints ; (j) pathologiques, chacune `< 500 ms` et sans exception : `"x".repeat(50000)` en trace, `"Caused by: a.B: m\n".repeat(20000)`, `"(".repeat(30000)`, une ligne d'en-tête de 100 000 caractères, `"at ".repeat(30000)`, NUL et caractères Unicode exotiques ; (k) plafonds : une trace de 1000 lignes ne produit pas plus de maillons que dans les 400 premières lignes ; (l) `renderDiagnosis` : sections dans l'ordre `Exception Summary`, `Likely Cause`, `Reference Documentation`, `General Troubleshooting Steps` ; pas de ligne `Root cause` distincte pour une chaîne d'un maillon ; liens dédoublonnés.

- [ ] **Step 2: Vérifier l'échec** : `npx vitest run tests/diagnosis.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** `src/services/diagnosis.ts` selon les Global Constraints (extraction linéaire, table de règles telle que spécifiée, rendu).

- [ ] **Step 4: Vérifier** : `npm test` → tout vert.

- [ ] **Step 5: Commit** : `git add src tests && git commit -m "feat: analyseur de stack trace Spring (chaîne d'exceptions, cause racine, règles, références du registre)"`

### Task 2: brancher dans `diagnoseIssues`

**Files:**
- Modify: `src/services/advanced-features.ts` (méthode `diagnoseIssues` uniquement), `tests/diagnosis-cache.test.ts`, `tests/error-propagation.test.ts`
- Test: `tests/diagnose-offline.test.ts` (nouveau)

**Interfaces:**
- Consumes: `renderDiagnosis` (Task 1).
- Produces: `diagnoseIssues(errorMessage, component?, stackTrace?): Promise<string>` inchangé en signature.

- [ ] **Step 1: Écrire les tests qui échouent** `tests/diagnose-offline.test.ts` : `fetch` mocké en rejet (`mockRejectedValue(new Error("network down"))`) → `diagnoseIssues` **résout** quand même, contient `## Exception Summary` ou `## Likely Cause` selon l'entrée, et `mockedFetch` n'a jamais été appelé ; pour une stack trace de la Task 1 (a) (recopiée), la sortie contient `NoSuchBeanDefinitionException`, `missing-bean`'s title `A required bean is missing`, et le lien `https://docs.spring.io/spring-framework/reference/core/beans.html` ; cache : deux appels identiques → même chaîne (et `diagnoseIssues` n'appelle pas `renderDiagnosis` une seconde fois : vérifier par `vi.spyOn` si pratique, sinon par égalité) ; deux `stackTrace` différentes → sorties différentes (clé de cache #23).

- [ ] **Step 2: Vérifier l'échec** : `npm run build && npx vitest run tests/diagnose-offline.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** : dans `diagnoseIssues`, conserver le calcul de la clé sha256 et le `cache.get` ; remplacer le bloc `try` (recherche + texte fixe) par `const result = renderDiagnosis({ errorMessage, component, stackTrace })` puis `this.cache.set(cacheKey, result)` ; retirer l'import `createHash` seulement s'il devient inutilisé (il ne l'est pas : la clé le garde). Adapter `tests/diagnosis-cache.test.ts` : le test « ne mélange pas deux stack traces » doit vérifier que la sortie avec `"at com.example.Foo"` **diffère** de celle sans stack trace (et contient `**Your code:**`), plutôt que la chaîne `Stack Trace Analysis` ; les deux autres tests restent. Dans `tests/error-propagation.test.ts` : retirer le cas `diagnoseIssues` de la liste des méthodes qui rejettent quand la source réseau est en panne (ligne `["diagnoseIssues", …]`), avec un commentaire d'une ligne indiquant que le diagnostic est désormais local (couvert par `tests/diagnose-offline.test.ts`) ; ne pas modifier les autres cas.

- [ ] **Step 4: Vérifier** : `npm run build && npm test` → tout vert. Vérifier en ligne chaque URL de références des règles et des composants (une seule passe `curl` parallèle, tableau des statuts dans le rapport) ; toute URL non 200 est remplacée/retirée en respectant la table autorisée, et signalée.

- [ ] **Step 5: Commit** : `git add src tests && git commit -m "feat: diagnose_spring_issues utilise l'analyseur local (hors ligne, références du registre)"`

### Task 3: backlog

- [ ] Après vérification réelle de `npm test`, cocher #36 dans `IMPROVE.md` (` — Fait le 2026-10-02`, avec : analyse locale sans réseau, 13 familles, limites : heuristique par mots-clés, `stack_trace` limité à 10 000 caractères par le schéma, anciens formats « nested exception is » non décomposés).
