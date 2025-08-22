# 🚀 Guide de publication pour EnokDev (@enokdev)

## 📋 Informations de publication

- **GitHub**: https://github.com/tky0065
- **npm**: https://www.npmjs.com/~enokdev
- **Package**: `@enokdev/springdocs-mcp`
- **Repository**: `tky0065/springdocs-mcp`

## ⚡ Commandes de publication rapide

### 1. Préparer le repository GitHub

```bash
# Dans votre dossier de projet
cd /Users/yacoubakone/Documents/dev/springdocsmcp

# Initialiser Git (si pas encore fait)
git init
git add .
git commit -m "Initial release: Spring Documentation MCP Server v1.1.0"

# Créer le repository sur GitHub avec le nom: springdocs-mcp
# Description: "Spring Documentation MCP Server for Claude Desktop - Access the complete Spring ecosystem in Claude"

# Connecter le repository local
git remote add origin https://github.com/tky0065/springdocs-mcp.git
git branch -M main
git push -u origin main
```

### 2. Publication sur npm

```bash
# Se connecter à npm avec votre compte enokdev
npm login
# Username: enokdev
# Password: [votre mot de passe]
# Email: [votre email]

# Vérifier la connexion
npm whoami
# Doit afficher: enokdev

# Compilation et test final
npm run build
npm test

# Publication
npm publish --access public
```

### 3. Créer une release GitHub

```bash
# Créer un tag de version
git tag v1.1.0
git push origin v1.1.0

# La GitHub Action va automatiquement créer une release
```

## 🌐 Après publication

### Installation pour les utilisateurs

```bash
npm install -g @enokdev/springdocs-mcp
```

### Configuration Claude Desktop

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

## 📈 Promotion

### 1. Réseaux sociaux
- **LinkedIn**: Post avec hashtags #SpringBoot #Claude #MCP #OpenSource
- **Twitter/X**: Mention @springboot et @anthropicai
- **GitHub**: Ajouter aux topics: `mcp`, `spring-boot`, `claude`, `documentation`

### 2. Communautés
- **Reddit**: r/SpringBoot, r/java, r/programming
- **Dev.to**: Article de présentation
- **Stack Overflow**: Répondre aux questions Spring Boot avec votre outil

### 3. Documentation officielle
- **MCP Registry**: Soumettre à la liste officielle MCP
- **Awesome Lists**: Ajouter aux listes "Awesome MCP" sur GitHub

## 🔗 Liens utiles

- **Package npm**: https://www.npmjs.com/package/@enokdev/springdocs-mcp
- **Repository GitHub**: https://github.com/tky0065/springdocs-mcp
- **Documentation**: https://tky0065.github.io/springdocs-mcp
- **Issues**: https://github.com/tky0065/springdocs-mcp/issues

## 📊 Métriques à suivre

- Downloads npm: https://npm-stat.com/charts.html?package=@enokdev/springdocs-mcp
- GitHub stars et forks
- Issues et pull requests
- Feedback utilisateurs

## 🔄 Mises à jour futures

```bash
# Pour publier une mise à jour
npm version patch  # ou minor/major
git add .
git commit -m "Release v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push origin main --tags
npm publish
```

## 🎯 Script de publication automatique

```bash
#!/bin/bash
# publish.sh

set -e

echo "🔍 Vérifications pré-publication..."
npm run build
npm test

echo "📝 Mise à jour de version..."
npm version patch

echo "📤 Envoi vers GitHub..."
git push origin main --tags

echo "📦 Publication sur npm..."
npm publish --access public

echo "✅ Publication terminée!"
echo "Package: https://www.npmjs.com/package/@enokdev/springdocs-mcp"
echo "GitHub: https://github.com/tky0065/springdocs-mcp"
```

---

## 🎉 Message de lancement suggéré

```markdown
🚀 Nouveau package npm: @enokdev/springdocs-mcp

Un serveur MCP qui donne accès à TOUTE la documentation Spring (Boot, Security, Data, Cloud...) directement dans Claude Desktop !

✨ 7 outils MCP pour explorer l'écosystème Spring
📚 Accès instantané à spring.io/projects + guides + docs
🔍 Recherche intelligente dans toute la documentation
⚡ Installation en une commande: npm install -g @enokdev/springdocs-mcp

Perfect pour tous les développeurs Spring utilisant Claude ! 

#SpringBoot #Claude #MCP #OpenSource #Documentation
```

**🌟 Votre serveur MCP sera bientôt disponible pour toute la communauté des développeurs Spring !**
