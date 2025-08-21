   # 🚀 Serveur MCP Spring Boot Documentation

## En TypeScript  
https://github.com/modelcontextprotocol/typescript-sdk

## 📖 Vue d'ensemble

Ce projet implémente un serveur MCP (Model Context Protocol) en **TypeScript** qui permet d'accéder facilement à la documentation officielle de Spring Boot. Le serveur récupère et formate le contenu depuis `docs.spring.io` et l'expose via une interface MCP standardisée.

Utilise aussi https://spring.io/projects

### 🎯 Objectifs

- ✅ Fournir un accès programmatique à la documentation Spring Boot
- ✅ Supporter le protocole MCP 2025-06-18
- ✅ Convertir le HTML en format Markdown lisible
- ✅ Offrir une interface simple et bien documentée

Ce serveur MCP (Model Context Protocol) permet d'accéder à la documentation officielle de Spring Boot via une interface standardisée, **maintenant disponible pour un usage public** comme Context7 !

## 🛠️ Fonctionnalités

### Outils disponibles

1. **`search_spring_docs`** - Recherche dans la documentation avec des mots-clés
2. **`get_spring_guide`** - Récupère un guide Spring Boot complet  
3. **`get_spring_reference`** - Accède aux sections de la documentation de référence
4. **`search_spring_concepts`** - Recherche des concepts par catégorie

### Catégories de concepts supportées

- **Core** : Auto-configuration, Profiles, Properties
- **Web** : Spring MVC, Serveurs intégrés
- **Data** : Spring Data JPA, Migration de base de données
- **Security** : Spring Security
- **Testing** : Test Slices, annotations de test
- **Production** : Actuator, monitoring

## 🚀 Installation et utilisation

### 1. Installation des dépendances
```bash
npm install
```

### 2. Compilation
```bash
npm run build
```

### 3. Test du serveur
```bash
npm start
```

### 4. Configuration avec Claude Desktop

Copiez la configuration suivante dans votre fichier `claude_desktop_config.json` :

**macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "springboot-docs": {
      "command": "node",
      "args": ["/Users/yacoubakone/Documents/dev/springdocsmcp/build/index.js"]
    }
  }
}
```

## 📝 Exemples d'utilisation

Une fois configuré avec Claude Desktop, vous pouvez utiliser des requêtes comme :

- "Recherche dans la documentation Spring Boot sur les API REST"
- "Récupère le guide gs-rest-service"
- "Explique le concept d'auto-configuration dans Spring Boot"
- "Montre-moi la documentation sur Spring Security"

## 🏗️ Architecture du projet

```
src/
├── index.ts                 # Point d'entrée principal du serveur MCP
├── services/
│   └── springboot-docs.ts   # Service de récupération de documentation
└── tools/
    └── index.ts            # Définitions des outils MCP exposés
```