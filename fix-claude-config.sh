#!/bin/bash

echo "🔧 Configuration de débogage Claude Desktop"
echo "============================================"
echo

# Backup de la configuration existante
CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
BACKUP_FILE="$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ Sauvegarde créée: $BACKUP_FILE"
fi

echo
echo "🧪 Création d'une configuration de test minimale..."

# Configuration de test avec logging
cat > "$CONFIG_FILE" << 'EOF'
{
  "mcpServers": {
    "spring-docs": {
      "command": "/opt/homebrew/bin/springdocs-mcp",
      "env": {
        "NODE_ENV": "development"
      }
    }
  },
  "logging": {
    "level": "debug"
  }
}
EOF

echo "✅ Configuration de test créée"
echo
echo "📋 Configuration actuelle:"
cat "$CONFIG_FILE"
echo
echo "🔄 Instructions:"
echo "1. Fermez complètement Claude Desktop"
echo "2. Attendez 10 secondes"
echo "3. Relancez Claude Desktop"
echo "4. Vérifiez si les outils Spring apparaissent"
echo "5. Si problème persiste, testez la configuration alternative"
echo
echo "🔧 Configuration alternative (mode développement):"
echo

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

echo
echo "📝 Pour appliquer la configuration alternative:"
echo "cat > \"$CONFIG_FILE\" << 'EOF'"
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
echo "EOF"

echo
echo "🔍 Pour consulter les logs Claude Desktop:"
echo "tail -f ~/Library/Application\\ Support/Claude/*.log"
echo
echo "📞 Si le problème persiste:"
echo "1. Vérifiez les logs Claude Desktop"
echo "2. Essayez la configuration en mode développement"
echo "3. Redémarrez votre système si nécessaire"
