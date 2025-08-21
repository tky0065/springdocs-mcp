#!/bin/bash

echo "🧪 Test des configurations JetBrains IDEs"
echo "========================================="
echo

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Fonction de test
test_config_file() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        echo -e "${BLUE}   📁 $file${NC}"
        
        # Vérifier si c'est un fichier JSON valide
        if [[ "$file" == *.json ]]; then
            if python3 -m json.tool "$file" > /dev/null 2>&1; then
                echo -e "${GREEN}   ✅ JSON valide${NC}"
            else
                echo -e "${RED}   ❌ JSON invalide${NC}"
            fi
        fi
        
        # Vérifier si c'est un fichier XML valide
        if [[ "$file" == *.xml ]]; then
            if command -v xmllint &> /dev/null; then
                if xmllint --noout "$file" 2>/dev/null; then
                    echo -e "${GREEN}   ✅ XML valide${NC}"
                else
                    echo -e "${RED}   ❌ XML invalide${NC}"
                fi
            else
                echo -e "${YELLOW}   ⚠️  xmllint non disponible (optionnel)${NC}"
            fi
        fi
        echo
    else
        echo -e "${YELLOW}⚠️  $description - Non trouvé${NC}"
        echo -e "${BLUE}   📁 $file${NC}"
        echo
    fi
}

echo -e "${YELLOW}🔍 Vérification des configurations créées...${NC}"
echo

# Configuration générique
test_config_file "$HOME/.jetbrains/claude_mcp_config.json" "Configuration générique JetBrains"

# IDEs spécifiques
JETBRAINS_BASE="$HOME/Library/Application Support/JetBrains"

if [ -d "$JETBRAINS_BASE" ]; then
    echo -e "${BLUE}📍 Recherche des configurations IDE...${NC}"
    echo
    
    # IntelliJ IDEA
    find "$JETBRAINS_BASE" -name "IntelliJIdea*" -type d | while read -r ide_dir; do
        claude_xml="$ide_dir/options/claude.xml"
        test_config_file "$claude_xml" "IntelliJ IDEA $(basename "$ide_dir")"
    done
    
    # WebStorm
    find "$JETBRAINS_BASE" -name "WebStorm*" -type d | while read -r ide_dir; do
        claude_xml="$ide_dir/options/claude.xml"
        test_config_file "$claude_xml" "WebStorm $(basename "$ide_dir")"
    done
    
    # GoLand
    find "$JETBRAINS_BASE" -name "GoLand*" -type d | while read -r ide_dir; do
        claude_xml="$ide_dir/options/claude.xml"
        test_config_file "$claude_xml" "GoLand $(basename "$ide_dir")"
    done
    
    # PyCharm
    find "$JETBRAINS_BASE" -name "PyCharm*" -type d | while read -r ide_dir; do
        claude_xml="$ide_dir/options/claude.xml"
        test_config_file "$claude_xml" "PyCharm $(basename "$ide_dir")"
    done
    
else
    echo -e "${RED}❌ Dossier JetBrains non trouvé: $JETBRAINS_BASE${NC}"
fi

echo -e "${YELLOW}🧪 Test du serveur MCP...${NC}"
echo

# Test du serveur MCP
if command -v springdocs-mcp &> /dev/null; then
    echo -e "${GREEN}✅ Commande springdocs-mcp disponible${NC}"
    
    # Test rapide du serveur
    echo -e "${BLUE}🔄 Test d'initialisation...${NC}"
    echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | timeout 5s springdocs-mcp > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Serveur MCP répond correctement${NC}"
    else
        echo -e "${RED}❌ Problème avec le serveur MCP${NC}"
    fi
else
    echo -e "${RED}❌ Commande springdocs-mcp non disponible${NC}"
    echo "Exécutez: npm install -g @enokdev/springdocs-mcp"
fi

echo
echo -e "${YELLOW}📋 Résumé des tests${NC}"
echo -e "${GREEN}✅ = Configuration trouvée et valide${NC}"
echo -e "${YELLOW}⚠️  = Configuration manquante (normal si IDE non installé)${NC}"
echo -e "${RED}❌ = Problème détecté${NC}"
echo
echo -e "${BLUE}💡 Prochaines étapes:${NC}"
echo "1. Redémarrer vos IDEs JetBrains"
echo "2. Installer le plugin Claude dans chaque IDE"
echo "3. Tester avec: 'Quels sont les projets Spring pour la sécurité ?'"
echo
echo -e "${GREEN}🎉 Configuration JetBrains terminée !${NC}"
