# 📦 Guide de publication - Spring Documentation MCP Server

Ce guide explique comment publier le serveur MCP pour que tout le monde puisse l'utiliser.

## 🚀 Étapes de publication

### 1. Préparation du repository GitHub

```bash
# Initialiser Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit: Spring Documentation MCP Server v1.1.0"

# Créer un repository sur GitHub
# Puis connecter le repository local
git remote add origin https://github.com/tky0065/springdocs-mcp.git
git branch -M main
git push -u origin main
```

### 2. Publication sur npm

#### A. Créer un compte npm
```bash
npm adduser
# ou
npm login
```

#### B. Vérifier la configuration
```bash
npm whoami
npm config list
```

#### C. Test avant publication
```bash
npm run build
npm pack --dry-run
```

#### D. Publication
```bash
# Publication initiale
npm publish --access public

# Ou pour une mise à jour
npm version patch  # ou minor/major
npm publish
```

### 3. Création d'un registry MCP public

#### A. Créer un fichier de registry
```json
{
  "name": "@enokdev/springdocs-mcp",
  "description": "Spring Documentation MCP Server for Claude Desktop",
  "version": "1.1.0",
  "homepage": "https://github.com/tky0065/springdocs-mcp",
  "repository": "https://github.com/tky0065/springdocs-mcp.git",
  "author": "EnokDev",
  "license": "MIT",
  "keywords": ["mcp", "spring", "documentation", "claude"],
  "installation": {
    "npm": "@enokdev/springdocs-mcp",
    "github": "tky0065/springdocs-mcp"
  },
  "usage": {
    "command": "springdocs-mcp",
    "config": {
      "mcpServers": {
        "spring-docs": {
          "command": "springdocs-mcp"
        }
      }
    }
  }
}
```

## 🌐 Distribution publique

### 1. Via npm (recommandé)
Les utilisateurs peuvent installer avec :
```bash
npm install -g @enokdev/springdocs-mcp
```

### 2. Via GitHub Releases
```bash
# Créer un tag de version
git tag v1.1.0
git push origin v1.1.0

# Créer une release sur GitHub avec les binaires
```

### 3. Via Docker (optionnel)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build/ ./build/
EXPOSE 3000
CMD ["node", "build/index.js"]
```

## 📋 Liste de vérification avant publication

- [ ] ✅ **Code testé** - Tous les outils fonctionnent
- [ ] ✅ **Documentation complète** - README, INSTALL, EXAMPLES
- [ ] ✅ **Version mise à jour** - package.json et code source
- [ ] ✅ **License ajoutée** - MIT License
- [ ] ✅ **Repository GitHub** - Code source accessible
- [ ] ✅ **npm configuré** - Accès de publication
- [ ] ✅ **Keywords optimisés** - Pour la découverte
- [ ] ✅ **Tests passés** - Script de test fonctionne

## 🔧 Configuration pour les utilisateurs

### Configuration Claude Desktop simplifiée
```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "springdocs-mcp"
    }
  }
}
```

### Documentation utilisateur
Créer des guides pour :
- Installation rapide
- Configuration Claude Desktop
- Exemples d'utilisation
- Dépannage

## 📈 Promotion et visibilité

### 1. Soumission aux annuaires MCP
- Registre officiel MCP (si disponible)
- Awesome MCP lists sur GitHub
- Documentation Anthropic

### 2. Communication
- Article de blog
- Post LinkedIn/Twitter
- Documentation Spring Boot community
- Slack/Discord Spring Boot

### 3. SEO et découvrabilité
- Keywords optimisés dans package.json
- README avec badges
- Documentation claire
- Exemples concrets

## 🔄 Maintenance continue

### 1. Versioning sémantique
- **PATCH** : Corrections de bugs
- **MINOR** : Nouvelles fonctionnalités
- **MAJOR** : Changements incompatibles

### 2. Monitoring
- GitHub issues
- npm downloads
- Feedback utilisateurs

### 3. Mises à jour
- Dépendances sécurisées
- Nouvelles fonctionnalités Spring
- Améliorations MCP

---

## 🎯 Commandes de publication rapide

```bash
# Préparation
npm run build
npm test

# Publication
npm version minor
git add .
git commit -m "Release v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push origin main --tags
npm publish --access public
```

🌟 **Votre serveur MCP sera alors accessible à tous les utilisateurs de Claude Desktop !**
