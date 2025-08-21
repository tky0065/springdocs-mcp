# Changelog - Spring Boot MCP Server

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [versioning sémantique](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-08-21

### ✨ Ajouté
- **Support complet de spring.io/projects** - Accès à tous les projets Spring (Security, Data, Cloud, etc.)
- **Nouvel outil `search_spring_projects`** - Recherche parmi tous les projets Spring disponibles
- **Nouvel outil `get_spring_project`** - Récupération des détails complets d'un projet Spring spécifique
- **Nouvel outil `get_all_spring_guides`** - Liste tous les guides Spring avec filtrage par catégorie
- **Base de connaissances étendue** - Projets Spring populaires intégrés pour un fallback robuste
- **Documentation enrichie** - Guides d'exemples pratiques (EXAMPLES.md)
- **Guide de contribution** - Documentation pour les développeurs (CONTRIBUTING.md)

### 🔧 Amélioré
- **Couverture documentaire élargie** - Passage de 4 à 7 outils MCP
- **Robustesse du service** - Mécanismes de fallback pour les projets et guides populaires
- **Performance des requêtes** - Optimisation du parsing HTML et conversion Markdown
- **Tests étendus** - Script de test mis à jour avec tous les nouveaux outils

### 📚 Sources de documentation ajoutées
- `https://spring.io/projects` - Catalogue complet des projets Spring
- `https://spring.io/guides` - Collection étendue de guides pratiques
- Base de connaissances des projets populaires (Boot, Security, Data, Cloud, etc.)

### 🛠️ Outils MCP (7 au total)
1. `search_spring_docs` - Recherche dans la documentation Spring Boot *(existant)*
2. `search_spring_projects` - **NOUVEAU** - Recherche de projets Spring
3. `get_spring_project` - **NOUVEAU** - Détails d'un projet Spring
4. `get_all_spring_guides` - **NOUVEAU** - Liste des guides Spring
5. `get_spring_guide` - Récupération d'un guide spécifique *(existant)*
6. `get_spring_reference` - Documentation de référence *(existant)*
7. `search_spring_concepts` - Recherche de concepts *(existant)*

## [1.0.0] - 2025-08-21

### ✨ Version initiale
- **Serveur MCP fonctionnel** - Implémentation complète du protocole Model Context Protocol
- **4 outils de base** - Accès à la documentation Spring Boot essentielle
- **Architecture TypeScript** - Code moderne avec types stricts
- **Configuration Claude Desktop** - Intégration prête à l'emploi
- **Tests automatisés** - Script de validation des fonctionnalités
- **Documentation complète** - README avec instructions d'installation et usage

### 🛠️ Outils MCP de base
1. `search_spring_docs` - Recherche dans la documentation Spring Boot
2. `get_spring_guide` - Récupération d'un guide spécifique
3. `get_spring_reference` - Documentation de référence
4. `search_spring_concepts` - Recherche de concepts Spring Boot

### 📚 Sources de documentation initiales
- Documentation Spring Boot officielle
- Guides Spring.io sélectionnés
- Base de connaissances des concepts Spring Boot

### 🔧 Fonctionnalités techniques
- Transport stdio pour communication MCP
- Parsing HTML avec Cheerio
- Conversion Markdown avec Turndown
- Gestion d'erreurs robuste
- Support des requêtes JSON-RPC 2.0

---

## Format des versions

- **MAJOR** : Changements incompatibles de l'API
- **MINOR** : Nouvelles fonctionnalités compatibles
- **PATCH** : Corrections de bugs compatibles

## Types de changements

- `✨ Ajouté` pour les nouvelles fonctionnalités
- `🔧 Amélioré` pour les modifications de fonctionnalités existantes
- `🐛 Corrigé` pour les corrections de bugs
- `❌ Supprimé` pour les fonctionnalités supprimées
- `⚠️ Déprécié` pour les fonctionnalités bientôt supprimées
- `🔒 Sécurité` pour les corrections de vulnérabilités
