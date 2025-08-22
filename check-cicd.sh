#!/bin/bash

# Script de vérification rapide du statut CI/CD

echo "🔍 Vérification Statut CI/CD"
echo "============================="
echo

# 1. Version actuelle
echo "📦 Version actuelle:"
current_version=$(node -p "require('./package.json').version")
echo "   Local: v$current_version"

# Vérifier version NPM
if command -v npm &> /dev/null; then
    npm_version=$(npm view @enokdev/springdocs-mcp version 2>/dev/null || echo "Non trouvée")
    echo "   NPM: v$npm_version"
    
    if [ "$current_version" = "$npm_version" ]; then
        echo "   ✅ Versions synchronisées"
    else
        echo "   ⚠️  Versions différentes"
    fi
else
    echo "   ❌ npm non disponible"
fi

echo

# 2. Statut Git
echo "🌿 Statut Git:"
if [ -d ".git" ]; then
    branch=$(git branch --show-current)
    echo "   Branche: $branch"
    
    # Vérifier s'il y a des changements non commitées
    if git diff-index --quiet HEAD --; then
        echo "   ✅ Aucun changement non commité"
    else
        echo "   ⚠️  Changements non commitées détectés"
        git status --porcelain
    fi
    
    # Vérifier le dernier tag
    last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "Aucun tag")
    echo "   Dernier tag: $last_tag"
else
    echo "   ❌ Pas un repo git"
fi

echo

# 3. Workflows GitHub
echo "🔄 Workflows GitHub:"
if [ -f ".github/workflows/publish.yml" ]; then
    echo "   ✅ publish.yml"
else
    echo "   ❌ publish.yml manquant"
fi

if [ -f ".github/workflows/auto-release.yml" ]; then
    echo "   ✅ auto-release.yml"
else
    echo "   ❌ auto-release.yml manquant"
fi

echo

# 4. Secrets GitHub (si gh CLI disponible)
echo "🔐 Secrets GitHub:"
if command -v gh &> /dev/null; then
    if gh auth status &> /dev/null; then
        if gh secret list | grep -q "NPM_TOKEN"; then
            echo "   ✅ NPM_TOKEN configuré"
        else
            echo "   ❌ NPM_TOKEN manquant"
        fi
    else
        echo "   ⚠️  Non connecté à GitHub CLI"
    fi
else
    echo "   ⚠️  GitHub CLI non installé"
fi

echo

# 5. Build et tests
echo "🧪 Tests rapides:"

# Test build
if npm run build &> /dev/null; then
    echo "   ✅ Build réussi"
else
    echo "   ❌ Build échoué"
fi

# Test publication dry-run
if npm run release:dry &> /dev/null; then
    echo "   ✅ Publication test OK"
else
    echo "   ❌ Publication test échoué"
fi

echo

# 6. Actions recommandées
echo "💡 Actions recommandées:"

# Si versions différentes
if [ "$current_version" != "$npm_version" ] && [ "$npm_version" != "Non trouvée" ]; then
    echo "   📤 Publication en attente - Version locale plus récente"
    echo "      Commande: npm run version:patch (ou git tag + push)"
fi

# Si changements non commitées
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "   💾 Commiter les changements avant publication"
    echo "      Commande: git add . && git commit -m 'description'"
fi

# Si pas de tag récent
if [ "$last_tag" = "Aucun tag" ]; then
    echo "   🏷️  Créer le premier tag"
    echo "      Commande: npm run version:patch"
fi

echo
echo "✨ Status check terminé !"
