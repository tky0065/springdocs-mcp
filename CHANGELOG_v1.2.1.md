# 🚀 Changelog - Version 1.2.1

## [1.2.1] - 2025-08-22

### ✨ Added - npx Support (Distribution révolutionnaire)

- **🌟 Support npx complet**: Configuration directe via `npx @enokdev/springdocs-mcp@latest`
  - Pas d'installation globale nécessaire
  - Toujours la dernière version automatiquement
  - Gestion automatique des dépendances
  - Compatible avec tous les systèmes

- **📋 Configurations optimisées**:
  ```json
  {
    "mcpServers": {
      "spring-docs": {
        "command": "npx",
        "args": ["-y", "@enokdev/springdocs-mcp@latest"]
      }
    }
  }
  ```

- **🚀 Scripts automatisés**:
  - `setup-claude-npx.sh` - Configuration automatique Claude Desktop
  - `test-npx.sh` - Tests complets de la configuration npx
  - `npm run setup-claude-npx` - Configuration via npm

### 🔧 Improved - Problème npm résolu

- **✅ Correction du problème de fermeture prématurée** dans Claude Desktop
- **🐛 Version debug** (`src/debug.ts`) avec logs étendus
- **📊 Scripts de diagnostic** pour identifier les problèmes
- **🔄 Amélioration de la gestion d'erreurs** et du logging

### 📚 Enhanced Documentation

- **📖 Guide de migration npx**: `NPX_MIGRATION.md`
- **🔧 Guide de résolution**: `NPM_ISSUE_RESOLUTION.md`
- **⚡ README mis à jour** avec options npx en priorité
- **🧪 Documentation de test** complète

### 🎯 Distribution Methods

Maintenant **3 méthodes de distribution** disponibles :

| Méthode | Configuration | Avantages |
|---------|---------------|-----------|
| **npx (Recommandé)** | `npx @enokdev/springdocs-mcp@latest` | ✅ Auto-update, Pas d'install |
| **npm global** | `springdocs-mcp` | ⚡ Démarrage rapide |
| **Développement** | `node build/index.js` | 🔧 Contrôle total |

### 🛠️ Technical Improvements

- **📦 Package.json optimisé** pour npx
- **📁 Files field** pour distribution minimale
- **🧪 Tests npx** intégrés dans les scripts
- **⚙️ Configuration Claude Desktop** automatisée

---

## Previous Versions

### [1.2.0] - 2025-08-21
- ✨ Support JetBrains IDEs complet
- 🛠️ Configuration automatique pour tous les IDEs
- 📚 Documentation JetBrains dédiée

### [1.1.1] - 2025-08-21
- 📝 Documentation internationalization (English)
- 🌍 Public distribution preparation

### [1.1.0] - 2025-08-21
- ✨ Extended to complete Spring ecosystem
- 🆕 Added 3 new MCP tools (total: 7 tools)
- 🌐 Spring.io/projects integration

### [1.0.0] - 2025-08-21
- 🎉 Initial release
- 📚 Basic Spring Boot documentation access
- 🛠️ 4 core MCP tools

---

## 🌟 Highlights v1.2.1

### 🚀 **Installation révolutionnaire**
Plus besoin d'installation globale ! Utilisez directement :
```bash
npx @enokdev/springdocs-mcp@latest
```

### 🔄 **Mises à jour automatiques**
Toujours la dernière version de la documentation Spring sans action manuelle.

### 🛠️ **3 environnements supportés**
- **Claude Desktop** via npx (recommandé)
- **JetBrains IDEs** (IntelliJ, WebStorm, etc.)
- **VS Code** avec extension Claude

### 📚 **Écosystème Spring complet**
- 🌐 1000+ projets Spring (spring.io/projects)
- 📖 Guides pratiques (spring.io/guides)
- 📚 Documentation de référence complète
- 💡 Base de connaissances Spring Boot intégrée

---

**Full Changelog**: https://github.com/tky0065/springdocs-mcp/compare/v1.2.0...v1.2.1
