# Guides : liste et contenu (bugs `getAllSpringGuides` / `getGuide`)

Design validé en chat le 2026-10-03 (bounded).

1. Fixtures `tests/fixtures/guides-page-data.json` et `guide-page.html` (réduits, structure réelle de spring.io).
2. Tests rouges `tests/guides.test.ts` : liste (parsing, `category`, `limit`, nœud sans `path` ignoré, JSON invalide = erreur non cachée) ; contenu (`.ascii-doc` extrait, carte `article` ignorée, contenu vide = erreur).
3. `getAllSpringGuides` : lire `https://spring.io/page-data/guides/page-data.json` (`result.data.guides.nodes`).
4. `processHtmlGuide` : `.ascii-doc` en premier, erreur si le contenu extrait est vide.
5. Adapter `url-usage` et `error-propagation` (mocks HTML → JSON pour cette URL).
6. `npm test`, vérification réseau réelle (`rest-service`), cocher dans IMPROVE.md.
