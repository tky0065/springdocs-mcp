# 🔧 Guide de Dépannage - Spring Documentation MCP Server

## 🚨 Problème : Les outils MCP n'apparaissent pas dans Claude Desktop

### ✅ Vérifications de base

1. **Vérifier l'installation du package**
   ```bash
   npm list -g @enokdev/springdocs-mcp
   ```
   Devrait afficher : `@enokdev/springdocs-mcp@1.1.1`

2. **Vérifier la commande globale**
   ```bash
   which springdocs-mcp
   ```
   Devrait afficher : `/opt/homebrew/bin/springdocs-mcp`

3. **Tester le serveur localement**
   ```bash
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | springdocs-mcp
   ```

### 🔧 Solutions étape par étape

#### Solution 1 : Configuration Claude Desktop (Recommandée)

**Fichier :** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "/opt/homebrew/bin/springdocs-mcp"
    }
  }
}
```

#### Solution 2 : Configuration alternative (Développement)

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "node",
      "args": ["/path/to/springdocs-mcp/build/index.js"]
    }
  }
}
```

#### Solution 3 : Réinstallation complète

```bash
# Désinstaller
npm uninstall -g @enokdev/springdocs-mcp

# Nettoyer le cache
npm cache clean --force

# Réinstaller
npm install -g @enokdev/springdocs-mcp

# Vérifier
springdocs-mcp --help
```

### 🔍 Diagnostic automatique

Utilisez le script de diagnostic :

```bash
./diagnostic.sh
```

### 📋 Checklist de dépannage

- [ ] Package installé globalement
- [ ] Lien symbolique existe dans `/opt/homebrew/bin/`
- [ ] Fichier exécutable avec permissions correctes
- [ ] Configuration JSON valide (pas de virgules en trop)
- [ ] Chemin absolu utilisé dans la configuration
- [ ] Claude Desktop redémarré après modification config

### 🚫 Erreurs communes

#### JSON invalide
❌ **Problème :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    },  // <- virgule en trop
  }
}
```

✅ **Solution :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

#### Chemin relatif
❌ **Problème :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"  // <- peut ne pas être trouvé
    }
  }
}
```

✅ **Solution :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "/opt/homebrew/bin/springdocs-mcp"  // <- chemin absolu
    }
  }
}
```

### 🔄 Redémarrage requis

Après modification de la configuration :

1. **Fermer complètement Claude Desktop**
2. **Attendre 5 secondes**
3. **Relancer Claude Desktop**
4. **Vérifier la présence des outils dans le menu**

### 📍 Emplacements des fichiers

- **Configuration Claude Desktop :** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Executable global :** `/opt/homebrew/bin/springdocs-mcp`
- **Package installé :** `/opt/homebrew/lib/node_modules/@enokdev/springdocs-mcp/`

### 🆘 Si rien ne fonctionne

1. **Vérifier les logs de Claude Desktop** (si disponibles)
2. **Tester avec une configuration minimale**
3. **Utiliser le mode développement avec chemin absolu**
4. **Contacter le support ou ouvrir une issue GitHub**

### 📞 Support

- **GitHub Issues :** https://github.com/tky0065/springdocs-mcp/issues
- **npm Package :** https://www.npmjs.com/package/@enokdev/springdocs-mcp

---

**Note :** Ce serveur MCP fournit 7 outils pour explorer la documentation Spring. Une fois configuré correctement, vous devriez voir apparaître les outils Spring dans l'interface Claude Desktop.
