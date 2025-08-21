#!/bin/bash

# Script de publication automatique pour @enokdev/springdocs-mcp
# Auteur: EnokDev (https://github.com/tky0065)

set -e

echo "🌱 Publication de Spring Documentation MCP Server"
echo "=================================================="
echo ""

# Vérifications préliminaires
echo "🔍 Vérifications pré-publication..."

# Vérifier que nous sommes connectés à npm
NPM_USER=$(npm whoami 2>/dev/null || echo "")
if [ "$NPM_USER" != "enokdev" ]; then
    echo "❌ Erreur: Vous devez être connecté à npm en tant qu'enokdev"
    echo "Exécutez: npm login"
    exit 1
fi

echo "✅ Connecté à npm en tant que: $NPM_USER"

# Vérifier que le build fonctionne
echo "🔨 Compilation du projet..."
npm run build

# Exécuter les tests
echo "🧪 Exécution des tests..."
npm test

# Vérifier la configuration Git
if ! git remote get-url origin | grep -q "tky0065/springdocs-mcp"; then
    echo "⚠️  Attention: L'origin Git ne semble pas pointer vers tky0065/springdocs-mcp"
    echo "Origin actuel: $(git remote get-url origin)"
    read -p "Continuer quand même? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Afficher la version actuelle
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Version actuelle: $CURRENT_VERSION"

# Demander le type de mise à jour
echo ""
echo "Type de mise à jour:"
echo "1) patch (1.1.0 -> 1.1.1) - Corrections de bugs"
echo "2) minor (1.1.0 -> 1.2.0) - Nouvelles fonctionnalités"
echo "3) major (1.1.0 -> 2.0.0) - Changements incompatibles"
echo "4) Garder la version actuelle"

read -p "Votre choix (1-4): " -n 1 -r
echo

case $REPLY in
    1) VERSION_TYPE="patch" ;;
    2) VERSION_TYPE="minor" ;;
    3) VERSION_TYPE="major" ;;
    4) VERSION_TYPE="" ;;
    *) echo "❌ Choix invalide"; exit 1 ;;
esac

# Mise à jour de version si nécessaire
if [ ! -z "$VERSION_TYPE" ]; then
    echo "📝 Mise à jour de version ($VERSION_TYPE)..."
    npm version $VERSION_TYPE --no-git-tag-version
    NEW_VERSION=$(node -p "require('./package.json').version")
    echo "✅ Nouvelle version: $NEW_VERSION"
else
    NEW_VERSION=$CURRENT_VERSION
    echo "📌 Conservation de la version: $NEW_VERSION"
fi

# Test final du package
echo "🔍 Test final du package..."
npm pack --dry-run > /dev/null

# Confirmation finale
echo ""
echo "🚀 Prêt pour la publication:"
echo "   Package: @enokdev/springdocs-mcp@$NEW_VERSION"
echo "   Registry: https://www.npmjs.com/package/@enokdev/springdocs-mcp"
echo "   Repository: https://github.com/tky0065/springdocs-mcp"
echo ""

read -p "Confirmer la publication? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publication annulée"
    exit 1
fi

# Git commit et push
if [ ! -z "$VERSION_TYPE" ]; then
    echo "📤 Envoi vers GitHub..."
    git add .
    git commit -m "Release v$NEW_VERSION"
    git tag "v$NEW_VERSION"
    git push origin main --tags
    echo "✅ Code envoyé vers GitHub avec tag v$NEW_VERSION"
fi

# Publication npm
echo "📦 Publication sur npm..."
npm publish --access public

echo ""
echo "🎉 Publication réussie!"
echo ""
echo "📋 Informations de publication:"
echo "   📦 Package: https://www.npmjs.com/package/@enokdev/springdocs-mcp"
echo "   🐙 GitHub: https://github.com/tky0065/springdocs-mcp"
echo "   📊 Stats: https://npm-stat.com/charts.html?package=@enokdev/springdocs-mcp"
echo ""
echo "📥 Installation pour les utilisateurs:"
echo "   npm install -g @enokdev/springdocs-mcp"
echo ""
echo "🔧 Configuration Claude Desktop:"
echo '   {"mcpServers": {"spring-docs": {"command": "springdocs-mcp"}}}'
echo ""
echo "🌟 N'oubliez pas de:"
echo "   • Annoncer sur les réseaux sociaux"
echo "   • Mettre à jour la documentation si nécessaire"
echo "   • Répondre aux issues GitHub"
echo ""
echo "Merci d'avoir publié un outil utile pour la communauté Spring! 🌱"
