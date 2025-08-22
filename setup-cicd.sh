#!/bin/bash

# Script de setup CI/CD pour Spring Docs MCP
# Ce script guide l'utilisateur dans la configuration de la publication automatique

echo "🚀 Setup CI/CD pour Spring Docs MCP"
echo "======================================"
echo

# Vérifier si on est dans un repo git
if [ ! -d ".git" ]; then
    echo "❌ Erreur: Ce script doit être exécuté dans la racine du repo git"
    exit 1
fi

# Vérifier si GitHub CLI est installé
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI (gh) n'est pas installé"
    echo "📥 Installation:"
    echo "   macOS: brew install gh"
    echo "   Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "   Windows: https://github.com/cli/cli/releases"
    echo
    read -p "Appuyez sur Entrée après avoir installé gh..."
fi

# Vérifier si l'utilisateur est connecté à GitHub
if ! gh auth status &> /dev/null; then
    echo "🔐 Connexion à GitHub nécessaire"
    echo "   Exécutez: gh auth login"
    read -p "Appuyez sur Entrée après vous être connecté..."
fi

echo "📋 Checklist pré-configuration:"
echo "================================"
echo

# 1. Vérifier le token NPM
echo "1. 🔑 Token NPM"
echo "   - Allez sur https://www.npmjs.com/settings/tokens"
echo "   - Créez un token 'Automation' si vous n'en avez pas"
echo "   - Copiez le token (commence par npm_...)"
echo

read -p "   Avez-vous votre token NPM ? (y/n): " has_npm_token

if [ "$has_npm_token" != "y" ]; then
    echo "   ⏸️  Revenez quand vous aurez votre token NPM"
    exit 1
fi

read -s -p "   Collez votre token NPM: " npm_token
echo

if [ -z "$npm_token" ]; then
    echo "   ❌ Token NPM vide, arrêt du script"
    exit 1
fi

# 2. Configurer le secret GitHub
echo
echo "2. 🔒 Configuration des secrets GitHub"

# Vérifier si le secret existe déjà
if gh secret list | grep -q "NPM_TOKEN"; then
    echo "   ✅ Secret NPM_TOKEN existe déjà"
    read -p "   Voulez-vous le mettre à jour ? (y/n): " update_secret
    
    if [ "$update_secret" = "y" ]; then
        echo "$npm_token" | gh secret set NPM_TOKEN
        echo "   ✅ Secret NPM_TOKEN mis à jour"
    fi
else
    echo "$npm_token" | gh secret set NPM_TOKEN
    echo "   ✅ Secret NPM_TOKEN configuré"
fi

# 3. Vérifier les workflows
echo
echo "3. 📁 Vérification des workflows"

if [ -f ".github/workflows/publish.yml" ]; then
    echo "   ✅ Workflow publish.yml existe"
else
    echo "   ❌ Workflow publish.yml manquant"
fi

if [ -f ".github/workflows/auto-release.yml" ]; then
    echo "   ✅ Workflow auto-release.yml existe"
else
    echo "   ❌ Workflow auto-release.yml manquant"
fi

# 4. Test du build
echo
echo "4. 🧪 Test du build"
if npm run build; then
    echo "   ✅ Build réussi"
else
    echo "   ❌ Build échoué"
    exit 1
fi

# 5. Test dry-run
echo
echo "5. 🔬 Test publication (dry-run)"
if npm run release:dry; then
    echo "   ✅ Test publication réussi"
else
    echo "   ❌ Test publication échoué"
    exit 1
fi

# 6. Instructions finales
echo
echo "🎉 Configuration terminée !"
echo "=========================="
echo
echo "📝 Commandes disponibles:"
echo "   npm run version:patch    # Bump patch version (1.2.3 → 1.2.4)"
echo "   npm run version:minor    # Bump minor version (1.2.3 → 1.3.0)"
echo "   npm run version:major    # Bump major version (1.2.3 → 2.0.0)"
echo "   npm run release:dry      # Test publication sans publier"
echo "   npm run release:manual   # Publication manuelle"
echo "   npm run release:check    # Vérifier version publiée"
echo
echo "🔄 Workflow automatique:"
echo "   1. Faire vos changements et commit"
echo "   2. Exécuter: npm run version:patch (ou minor/major)"
echo "   3. GitHub Actions publie automatiquement sur NPM"
echo
echo "🎯 Prêt à publier !"
echo "   Pour votre première release automatique:"
echo "   git add . && git commit -m 'feat: setup CI/CD'"
echo "   npm run version:patch"
echo
