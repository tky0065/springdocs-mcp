# Serveur MCP Spring Boot Documentation

Un serveur MCP (Model Context Protocol) en TypeScript qui permet d'accéder facilement à la documentation officielle de Spring Boot. Ce serveur récupère et formate le contenu depuis `docs.spring.io` et l'expose via une interface MCP standardisée.

## 🎯 Objectifs

- ✅ Fournir un accès programmatique à la documentation Spring Boot
- ✅ Supporter le protocole MCP 2024-11-05
- ✅ Convertir le HTML en format Markdown lisible
- ✅ Offrir une interface simple et bien documentée

## 🚀 Installation

### Prérequis

- Node.js 18 ou plus récent
- npm ou yarn

### Installation des dépendances

```bash
npm install
```

### Compilation

```bash
npm run build
```

## 🛠️ Utilisation

### Démarrage du serveur

```bash
npm start
```

ou

```bash
node build/index.js
```

### Outils disponibles

Le serveur expose 4 outils principaux :

#### 1. `search_spring_docs`
Recherche dans la documentation Spring Boot avec des mots-clés.

**Paramètres :**
- `query` (requis) : Les mots-clés à rechercher
- `docType` (optionnel) : Type de documentation ("guides", "reference", "api", "all")
- `limit` (optionnel) : Nombre maximum de résultats (défaut: 10)

#### 2. `get_spring_guide`
Récupère le contenu complet d'un guide Spring Boot spécifique.

**Paramètres :**
- `guideId` (requis) : L'identifiant du guide (ex: "gs-rest-service")

#### 3. `get_spring_reference`
Récupère une section spécifique de la documentation de référence.

**Paramètres :**
- `section` (requis) : La section de la documentation (ex: "web", "data")
- `subsection` (optionnel) : Sous-section pour une recherche plus précise

#### 4. `search_spring_concepts`
Recherche des concepts Spring Boot par catégorie avec des explications détaillées.

**Paramètres :**
- `concept` (requis) : Le concept à rechercher (ex: "auto-configuration")
- `category` (optionnel) : Catégorie du concept ("core", "web", "data", "security", "testing", "production")

## 🔧 Configuration avec Claude Desktop

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
