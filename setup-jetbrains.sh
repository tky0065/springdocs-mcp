#!/bin/bash

echo "🚀 Configuration automatique du serveur MCP Spring pour IDEs JetBrains"
echo "======================================================================"
echo

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier si springdocs-mcp est installé
if ! command -v springdocs-mcp &> /dev/null; then
    echo -e "${RED}❌ springdocs-mcp n'est pas installé globalement${NC}"
    echo "Exécutez: npm install -g @enokdev/springdocs-mcp"
    exit 1
fi

echo -e "${GREEN}✅ springdocs-mcp trouvé: $(which springdocs-mcp)${NC}"
echo

# Configuration MCP standard
MCP_CONFIG='{
  "spring-docs": {
    "command": "/opt/homebrew/bin/springdocs-mcp",
    "description": "Spring Documentation MCP Server - Access to complete Spring ecosystem",
    "timeout": 30000
  }
}'

# Fonction pour créer la configuration Claude générique
create_claude_config() {
    local config_dir="$1"
    local config_file="$config_dir/claude_mcp_config.json"
    
    if [ ! -d "$config_dir" ]; then
        mkdir -p "$config_dir"
        echo -e "${BLUE}📁 Créé le dossier: $config_dir${NC}"
    fi
    
    cat > "$config_file" << EOF
{
  "mcpServers": $MCP_CONFIG
}
EOF
    
    echo -e "${GREEN}✅ Configuration créée: $config_file${NC}"
}

# Fonction pour créer la configuration XML JetBrains
create_jetbrains_xml() {
    local ide_config_dir="$1"
    local options_dir="$ide_config_dir/options"
    local claude_xml="$options_dir/claude.xml"
    
    if [ ! -d "$options_dir" ]; then
        mkdir -p "$options_dir"
        echo -e "${BLUE}📁 Créé le dossier: $options_dir${NC}"
    fi
    
    cat > "$claude_xml" << 'EOF'
<application>
  <component name="ClaudeSettings">
    <option name="mcpServers">
      <map>
        <entry key="spring-docs">
          <value>
            <MCPServerConfig>
              <option name="command" value="/opt/homebrew/bin/springdocs-mcp" />
              <option name="description" value="Spring Documentation MCP Server" />
              <option name="timeout" value="30000" />
            </MCPServerConfig>
          </value>
        </entry>
      </map>
    </option>
  </component>
</application>
EOF
    
    echo -e "${GREEN}✅ Configuration XML créée: $claude_xml${NC}"
}

echo -e "${YELLOW}🔧 Configuration des IDEs JetBrains...${NC}"
echo

# Détecter le système d'exploitation
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    JETBRAINS_BASE="$HOME/Library/Application Support/JetBrains"
    CONFIG_BASE="$HOME/.jetbrains"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    JETBRAINS_BASE="$HOME/.config/JetBrains"
    CONFIG_BASE="$HOME/.jetbrains"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    JETBRAINS_BASE="$APPDATA/JetBrains"
    CONFIG_BASE="$HOME/.jetbrains"
else
    echo -e "${RED}❌ Système d'exploitation non supporté: $OSTYPE${NC}"
    exit 1
fi

echo -e "${BLUE}📍 Dossier JetBrains détecté: $JETBRAINS_BASE${NC}"
echo

# Créer la configuration générique
echo -e "${YELLOW}📝 Création de la configuration générique...${NC}"
create_claude_config "$CONFIG_BASE"
echo

# Liste des IDEs JetBrains à configurer
JETBRAINS_IDES=(
    "IntelliJIdea"
    "WebStorm"
    "PyCharm"
    "PhpStorm"
    "RubyMine"
    "CLion"
    "GoLand"
    "Rider"
    "DataGrip"
    "AndroidStudio"
)

echo -e "${YELLOW}🎯 Configuration des IDEs spécifiques...${NC}"

for ide in "${JETBRAINS_IDES[@]}"; do
    # Chercher les versions installées de l'IDE
    if [ -d "$JETBRAINS_BASE" ]; then
        ide_dirs=$(find "$JETBRAINS_BASE" -maxdepth 1 -type d -name "${ide}*" 2>/dev/null)
        
        if [ -n "$ide_dirs" ]; then
            echo -e "${BLUE}🔍 Trouvé $ide:${NC}"
            echo "$ide_dirs" | while read -r ide_dir; do
                echo -e "  📁 $(basename "$ide_dir")"
                create_jetbrains_xml "$ide_dir"
            done
        else
            echo -e "${YELLOW}⚠️  $ide non installé ou non trouvé${NC}"
        fi
    fi
done

echo
echo -e "${GREEN}🎉 Configuration terminée !${NC}"
echo
echo -e "${YELLOW}📋 Prochaines étapes:${NC}"
echo "1. 🔄 Redémarrer vos IDEs JetBrains"
echo "2. 🔌 Installer le plugin Claude (si pas déjà fait)"
echo "3. ⚙️  Vérifier les paramètres Claude dans Settings → Tools → Claude"
echo "4. 🧪 Tester avec une question Spring dans le chat Claude"
echo
echo -e "${BLUE}💡 Exemple de test:${NC}"
echo "Demandez à Claude dans votre IDE: 'Quels sont les projets Spring pour la sécurité ?'"
echo
echo -e "${YELLOW}🔧 En cas de problème:${NC}"
echo "- Vérifiez que springdocs-mcp fonctionne: echo '{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"tools/list\", \"params\": {}}' | springdocs-mcp"
echo "- Consultez TROUBLESHOOTING.md pour plus d'aide"
echo
echo -e "${GREEN}✨ Votre serveur MCP Spring Documentation est maintenant disponible dans tous vos IDEs JetBrains !${NC}"
