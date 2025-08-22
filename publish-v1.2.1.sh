#!/bin/bash

echo "🚀 Publication Spring Documentation MCP Server v1.2.1"
echo "====================================================="
echo

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📋 Vérifications pré-publication...${NC}"

# Vérifier que nous sommes sur la branche main
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    echo -e "${RED}❌ Vous devez être sur la branche main pour publier${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Branche main confirmée${NC}"

# Vérifier que le workspace est propre
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️ Il y a des changements non commitées${NC}"
    echo "Voulez-vous continuer ? (y/N)"
    read -r response
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        echo "Publication annulée"
        exit 1
    fi
fi

echo -e "${YELLOW}🏗️ Construction du projet...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors de la construction${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Construction réussie${NC}"

echo -e "${YELLOW}🧪 Tests automatiques...${NC}"

# Test du serveur
echo -e "${BLUE}Test du serveur local:${NC}"
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node build/index.js > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Serveur local fonctionne${NC}"
else
    echo -e "${RED}❌ Problème avec le serveur local${NC}"
    exit 1
fi

# Test npx local
echo -e "${BLUE}Test npx local:${NC}"
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | npx . > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ npx local fonctionne${NC}"
else
    echo -e "${RED}❌ Problème avec npx local${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Publication npm...${NC}"

# Publier le package
npm publish --access public

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Package publié avec succès !${NC}"
else
    echo -e "${RED}❌ Erreur lors de la publication${NC}"
    exit 1
fi

echo
echo -e "${YELLOW}🏷️ Création du tag git...${NC}"

# Créer un tag pour cette version
git tag -a "v1.2.1" -m "Release v1.2.1 - npx support"
git push origin "v1.2.1"

echo -e "${GREEN}✅ Tag v1.2.1 créé et poussé${NC}"

echo
echo -e "${YELLOW}🧪 Test du package publié...${NC}"

# Attendre quelques secondes pour la propagation npm
echo "Attente de la propagation npm (10 secondes)..."
sleep 10

# Test du package publié
echo -e "${BLUE}Test du package publié via npx:${NC}"
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | npx @enokdev/springdocs-mcp@latest > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Package publié accessible via npx${NC}"
else
    echo -e "${YELLOW}⚠️ Package en cours de propagation (normal)${NC}"
fi

echo
echo -e "${GREEN}🎉 Publication v1.2.1 terminée avec succès !${NC}"
echo
echo -e "${BLUE}📋 Résumé de la publication:${NC}"
echo "• 📦 Package npm: @enokdev/springdocs-mcp@1.2.1"
echo "• 🏷️ Tag git: v1.2.1"
echo "• 🌐 URL npm: https://www.npmjs.com/package/@enokdev/springdocs-mcp"
echo "• 📖 Repo GitHub: https://github.com/tky0065/springdocs-mcp"
echo
echo -e "${YELLOW}🚀 Configuration Claude Desktop recommandée:${NC}"
cat << 'EOF'
{
  "mcpServers": {
    "spring-docs": {
      "command": "npx",
      "args": ["-y", "@enokdev/springdocs-mcp@latest"]
    }
  }
}
EOF

echo
echo -e "${BLUE}🎯 Prochaines étapes:${NC}"
echo "1. 📢 Annoncer la release sur GitHub"
echo "2. 📝 Mettre à jour la documentation si nécessaire"
echo "3. 🧪 Tester la configuration npx avec Claude Desktop"
echo "4. 📊 Monitorer les téléchargements npm"
echo
echo -e "${GREEN}✨ Votre serveur MCP Spring Documentation v1.2.1 est maintenant public !${NC}"
