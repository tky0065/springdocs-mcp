#!/bin/bash

echo "🔍 Diagnostic avancé du serveur MCP Spring Documentation"
echo "======================================================="
echo

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🏗️ Reconstruction du projet...${NC}"
npm run build
echo

echo -e "${YELLOW}📦 Vérification de l'installation npm...${NC}"
echo -e "${BLUE}Version installée:${NC} $(npm list -g @enokdev/springdocs-mcp 2>/dev/null | grep @enokdev/springdocs-mcp)"
echo -e "${BLUE}Localisation globale:${NC} $(npm root -g)/@enokdev/springdocs-mcp"
echo -e "${BLUE}Commande disponible:${NC} $(which springdocs-mcp || echo 'NON TROUVÉE')"
echo

echo -e "${YELLOW}🔧 Test du serveur local vs global...${NC}"
echo
echo -e "${BLUE}1. Test du serveur local:${NC}"
timeout 3s node build/index.js <<< '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' 2>&1 | head -10 || echo "Timeout local"
echo

echo -e "${BLUE}2. Test du serveur global:${NC}"
timeout 3s springdocs-mcp <<< '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' 2>&1 | head -10 || echo "Timeout global"
echo

echo -e "${YELLOW}📋 Comparaison des fichiers...${NC}"
LOCAL_FILE="./build/index.js"
GLOBAL_FILE="$(npm root -g)/@enokdev/springdocs-mcp/build/index.js"

if [ -f "$LOCAL_FILE" ] && [ -f "$GLOBAL_FILE" ]; then
    echo -e "${BLUE}Shebang local:${NC} $(head -1 "$LOCAL_FILE")"
    echo -e "${BLUE}Shebang global:${NC} $(head -1 "$GLOBAL_FILE")"
    echo -e "${BLUE}Permissions local:${NC} $(ls -la "$LOCAL_FILE" | awk '{print $1}')"
    echo -e "${BLUE}Permissions global:${NC} $(ls -la "$GLOBAL_FILE" | awk '{print $1}')"
    echo -e "${BLUE}Taille local:${NC} $(wc -l < "$LOCAL_FILE") lignes"
    echo -e "${BLUE}Taille global:${NC} $(wc -l < "$GLOBAL_FILE") lignes"
else
    echo -e "${RED}❌ Impossible de comparer - fichier manquant${NC}"
fi
echo

echo -e "${YELLOW}🧪 Test de la version courte...${NC}"
echo
echo "Tentative d'exécution directe du serveur global:"
timeout 2s /opt/homebrew/bin/springdocs-mcp 2>&1 | head -5 || echo "Process terminé ou timeout"
echo

echo -e "${YELLOW}🔄 Réinstallation du package global...${NC}"
echo "Désinstallation..."
npm uninstall -g @enokdev/springdocs-mcp >/dev/null 2>&1

echo "Réinstallation depuis le répertoire local..."
npm install -g . >/dev/null 2>&1

echo -e "${GREEN}✅ Package réinstallé${NC}"
echo

echo -e "${YELLOW}🧪 Test post-réinstallation...${NC}"
echo "Test de la commande:"
which springdocs-mcp && echo -e "${GREEN}✅ Commande disponible${NC}" || echo -e "${RED}❌ Commande non disponible${NC}"

echo
echo "Test d'exécution:"
timeout 3s springdocs-mcp <<< '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' 2>&1 | head -5 || echo "Timeout ou erreur"

echo
echo -e "${YELLOW}📝 Configuration Claude Desktop recommandée:${NC}"
cat << 'EOF'
{
  "mcpServers": {
    "spring-docs": {
      "command": "/opt/homebrew/bin/springdocs-mcp"
    }
  }
}
EOF

echo
echo -e "${GREEN}🎯 Actions recommandées:${NC}"
echo "1. Redémarrer Claude Desktop complètement"
echo "2. Vérifier que la configuration utilise le chemin absolu"
echo "3. Si le problème persiste, utiliser la configuration en mode développement:"
echo
echo -e "${BLUE}Configuration de développement alternative:${NC}"
cat << EOF
{
  "mcpServers": {
    "spring-docs": {
      "command": "node",
      "args": ["$(pwd)/build/index.js"]
    }
  }
}
EOF
