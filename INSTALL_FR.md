# 📦 Spring Documentation MCP Server - Installation publique

Serveur MCP public pour accéder à toute la documentation Spring Boot et l'écosystème Spring complet.

## 🚀 Installation rapide

### Via npm (recommandé)
```bash
npm install -g @enokdev/springdocs-mcp
```

### Via npx (sans installation)
```bash
npx @enokdev/springdocs-mcp
```

## ⚡ Configuration Claude Desktop

### 1. Installation globale
```bash
npm install -g @enokdev/springdocs-mcp
```

### 2. Configuration Claude Desktop
Ajoutez ceci à votre `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

### 3. Localisation du fichier de configuration
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## 🛠️ Configuration avancée

### Avec chemin spécifique
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "node",
      "args": ["/path/to/global/node_modules/@enokdev/springdocs-mcp/build/index.js"]
    }
  }
}
```

### Avec npx (sans installation globale)
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "npx",
      "args": ["@enokdev/springdocs-mcp"]
    }
  }
}
```

## 🔧 Outils disponibles

Une fois configuré, vous aurez accès à 7 outils dans Claude Desktop :

1. **`search_spring_docs`** - Recherche dans la documentation Spring Boot
2. **`search_spring_projects`** - Recherche de projets Spring
3. **`get_spring_project`** - Détails d'un projet Spring
4. **`get_all_spring_guides`** - Liste des guides Spring
5. **`get_spring_guide`** - Contenu d'un guide spécifique
6. **`get_spring_reference`** - Documentation de référence
7. **`search_spring_concepts`** - Recherche de concepts Spring Boot

## 💡 Exemples d'utilisation

Une fois installé, demandez à Claude :

- *"Quels sont les projets Spring disponibles pour la sécurité ?"*
- *"Montre-moi le guide pour créer une API REST avec Spring Boot"*
- *"Comment configurer Spring Security ?"*
- *"Explique-moi l'auto-configuration dans Spring Boot"*

## 🔄 Mise à jour

```bash
npm update -g @enokdev/springdocs-mcp
```

## 🆘 Dépannage

### Vérifier l'installation
```bash
springdocs-mcp --version
```

### Test manual
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | springdocs-mcp
```

### Réinstallation
```bash
npm uninstall -g @enokdev/springdocs-mcp
npm install -g @enokdev/springdocs-mcp
```

## 📚 Sources de documentation

Ce serveur accède à :
- **spring.io/projects** - Tous les projets Spring
- **spring.io/guides** - Guides pratiques
- **docs.spring.io** - Documentation de référence
- **Base de connaissances intégrée** - Concepts Spring Boot

---

**🌟 Profitez de l'accès complet à l'écosystème Spring directement dans Claude Desktop !**
