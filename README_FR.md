# 📚 Spring Documentation MCP Server

[![npm version](https://badge.fury.io/js/@enokdev%2Fspringdocs-mcp.svg)](https://badge.fury.io/js/@enokdev%2Fspringdocs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/GitHub-tky0065/springdocs--mcp-blue.svg)](https://github.com/tky0065/springdocs-mcp)

A public **Model Context Protocol (MCP)** server that provides access to the complete Spring Boot documentation and Spring ecosystem directly in Claude Desktop.

## 🚀 Quick Installation

```bash
npm install -g @enokdev/springdocs-mcp
```

Then add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

## ✨ Features

- 🌐 **Complete access** to spring.io/projects (all Spring projects)
- 📖 **Practical guides** spring.io/guides with filtering
- 📚 **Reference documentation** docs.spring.io
- � **Recherche intelligente** dans tout l'écosystème Spring
- 💡 **Base de connaissances** intégrée des concepts Spring Boot
- ⚡ **7 outils MCP** pour une exploration complète

## 🛠️ Utilisation

### Démarrage du serveur

```bash
npm start
```

ou

```bash
node build/index.js
```

## 🛠️ Outils disponibles

Le serveur MCP propose **7 outils** pour explorer la documentation Spring :

### 1. `search_spring_docs`
Recherche dans la documentation Spring Boot avec des mots-clés.

**Paramètres :**
- `query` (string, requis) : Mots-clés à rechercher
- `docType` (string, optionnel) : Type de documentation (`guides`, `reference`, `api`, `all`)
- `limit` (number, optionnel) : Nombre maximum de résultats (défaut: 10)

### 2. `search_spring_projects`
Recherche parmi tous les projets Spring disponibles sur spring.io/projects.

**Paramètres :**
- `query` (string, requis) : Mots-clés à rechercher dans les projets Spring
- `limit` (number, optionnel) : Nombre maximum de projets à retourner (défaut: 10)

### 3. `get_spring_project`
Récupère les détails complets d'un projet Spring spécifique.

**Paramètres :**
- `projectName` (string, requis) : Nom du projet Spring (ex: `spring-boot`, `spring-security`)

### 4. `get_all_spring_guides`
Récupère la liste de tous les guides Spring disponibles, optionnellement filtrés par catégorie.

**Paramètres :**
- `category` (string, optionnel) : Catégorie de guides à filtrer
- `limit` (number, optionnel) : Nombre maximum de guides (défaut: 20)

### 5. `get_spring_guide`
Récupère le contenu complet d'un guide Spring Boot spécifique.

**Paramètres :**
- `guideId` (string, requis) : Identifiant du guide (ex: `gs-rest-service`)

### 6. `get_spring_reference`
Récupère une section spécifique de la documentation de référence Spring Boot.

**Paramètres :**
- `section` (string, requis) : Section de la documentation (ex: `web`, `data`, `security`)
- `subsection` (string, optionnel) : Sous-section pour une recherche plus précise

### 7. `search_spring_concepts`
Recherche des concepts Spring Boot par catégorie avec explications détaillées.

**Paramètres :**
- `concept` (string, requis) : Concept à rechercher (ex: `auto-configuration`)
- `category` (string, optionnel) : Catégorie (`core`, `web`, `data`, `security`, `testing`, `production`)

## � Sources de documentation

Ce serveur MCP accède aux sources de documentation Spring suivantes :

- **🌟 [spring.io/projects](https://spring.io/projects)** - Tous les projets Spring (Boot, Security, Data, Cloud, etc.)
- **📖 [spring.io/guides](https://spring.io/guides)** - Guides pratiques et tutoriels
- **📚 [docs.spring.io](https://docs.spring.io)** - Documentation de référence officielle
- **🔧 API Documentation** - Documentation des classes et méthodes
- **💡 Base de connaissances intégrée** - Concepts et bonnes pratiques Spring Boot

## �🔧 Configuration avec Claude Desktop

Pour utiliser ce serveur avec Claude Desktop, ajoutez la configuration suivante dans votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "springboot-docs": {
      "command": "node",
      "args": ["/chemin/absolu/vers/springdocsmcp/build/index.js"]
    }
  }
}
```

### Localisation du fichier de configuration

- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\\Claude\\claude_desktop_config.json`

## 📚 Exemples d'utilisation

### Recherche générale
```
Recherche "REST API" dans la documentation Spring Boot
```

### Recherche de projets Spring
```
Trouve des projets Spring liés à "security"
```

### Détails d'un projet spécifique
```
Montre-moi les détails du projet "spring-boot"
```

### Liste des guides par catégorie
```
Quels sont les guides Spring pour la catégorie "Web" ?
```

### Récupération d'un guide spécifique
```
Récupère le guide "gs-rest-service"
```

### Exploration des concepts
```
Explique le concept "auto-configuration" dans Spring Boot
```

## 🏗️ Architecture

Le projet est organisé comme suit :

```
src/
├── index.ts              # Point d'entrée principal
├── services/
│   └── springboot-docs.ts # Service de récupération de documentation
└── tools/
    └── index.ts          # Définitions des outils MCP
```

### Composants principaux

- **SpringBootMCPServer** : Serveur MCP principal qui gère les requêtes
- **SpringBootDocsService** : Service pour récupérer et traiter la documentation
- **ToolDefinitions** : Définitions des outils exposés via MCP

## 🔒 Sécurité

- Le serveur accède uniquement aux ressources publiques de `docs.spring.io`
- Aucune donnée sensible n'est stockée ou transmise
- Toutes les requêtes HTTP sont en lecture seule

## 🐛 Dépannage

### Erreurs courantes

1. **"Cannot find module"** : Vérifiez que `npm install` a été exécuté
2. **"Serveur non démarré"** : Vérifiez que la compilation avec `npm run build` s'est bien passée
3. **"Documentation non trouvée"** : Vérifiez votre connexion internet

### Logs

Le serveur écrit ses logs sur `stderr` pour éviter d'interférer avec le protocole MCP sur `stdout`.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Forker le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🔗 Ressources utiles

- [Documentation Spring Boot](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [SDK MCP TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
