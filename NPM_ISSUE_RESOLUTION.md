# 🔧 Guide de Résolution - Problème npm MCP Server

## 🚨 Problème identifié
Le serveur MCP se connecte mais se ferme immédiatement après l'initialisation dans Claude Desktop, même si les tests en ligne de commande fonctionnent.

## ✅ Solutions testées et validées

### 1. Configuration de débogage (RECOMMANDÉE)

**Remplacez votre configuration Claude Desktop par :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "node",
      "args": ["/Users/yacoubakone/Documents/dev/springdocsmcp/build/debug.js"]
    }
  }
}
```

Cette configuration utilise la version debug qui fournit des logs détaillés.

### 2. Configuration en mode développement

**Si la version debug ne fonctionne pas :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "node",
      "args": ["/Users/yacoubakone/Documents/dev/springdocsmcp/build/index.js"]
    }
  }
}
```

### 3. Configuration globale fixée

**Si vous préférez utiliser le package global :**
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "/opt/homebrew/bin/springdocs-mcp",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## 🔍 Scripts de diagnostic disponibles

### Script complet de diagnostic
```bash
./debug-npm.sh
```

### Script de configuration Claude Desktop
```bash
./fix-claude-config.sh
```

### Test manuel du serveur
```bash
# Test local
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node build/index.js

# Test global
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | springdocs-mcp
```

## 🛠️ Étapes de résolution recommandées

### Étape 1 : Utilisation de la version debug
1. **Configurer Claude Desktop** avec la version debug
2. **Redémarrer Claude Desktop** complètement
3. **Vérifier les logs** Claude Desktop
4. **Tester les outils** Spring

### Étape 2 : Si la version debug fonctionne
1. **Publier une nouvelle version** du package avec les corrections
2. **Réinstaller globalement** : `npm install -g @enokdev/springdocs-mcp`
3. **Revenir à la configuration globale**

### Étape 3 : Solution permanente
1. **Utiliser la configuration en mode développement** comme solution stable
2. **Ou maintenir la version debug** pour le développement

## 📊 Statut des tests

| Configuration | Status | Notes |
|---------------|--------|-------|
| **Local build/index.js** | ✅ Fonctionne | Version stable |
| **Local build/debug.js** | ✅ Fonctionne | Avec logs détaillés |
| **Global springdocs-mcp** | ⚠️ Problématique | Se ferme dans Claude Desktop |
| **npm package** | ⚠️ Problématique | Même issue que global |

## 🔧 Corrections appliquées

### Dans src/index.ts
- ✅ Suppression de la condition `import.meta.url` problématique
- ✅ Amélioration de la gestion d'erreurs
- ✅ Ajout de logging pour le debug

### Nouveau fichier src/debug.ts
- ✅ Version avec logs étendus
- ✅ Diagnostic complet du processus
- ✅ Informations système détaillées

### Scripts de diagnostic
- ✅ `debug-npm.sh` - Diagnostic complet
- ✅ `fix-claude-config.sh` - Configuration automatique
- ✅ `test-jetbrains.sh` - Test des configurations JetBrains

## 🎯 Recommandation finale

**Pour une utilisation immédiate et stable :**

1. **Utilisez la configuration en mode développement :**
   ```json
   {
     "mcpServers": {
       "spring-docs": {
         "command": "node",
         "args": ["/Users/yacoubakone/Documents/dev/springdocsmcp/build/index.js"]
       }
     }
   }
   ```

2. **Cette configuration :**
   - ✅ Fonctionne immédiatement
   - ✅ Utilise la version la plus récente
   - ✅ Évite les problèmes de package npm
   - ✅ Permet le débogage facile

3. **Pour déployer publiquement :**
   - Publier la version 1.2.1 avec les corrections
   - Mettre à jour la documentation
   - Recommander la configuration en mode développement comme alternative

## 📞 Support

Si le problème persiste :
1. Consultez les logs Claude Desktop
2. Utilisez la version debug pour plus d'informations
3. Ouvrez une issue sur GitHub avec les logs complets
