#!/bin/bash

echo "🔍 Diagnostic du serveur MCP Spring Documentation"
echo "================================================="
echo

echo "📦 Vérification de l'installation npm..."
npm list -g @enokdev/springdocs-mcp 2>/dev/null || echo "❌ Package non installé globalement"
echo

echo "🔗 Vérification du lien symbolique..."
if [ -L "/opt/homebrew/bin/springdocs-mcp" ]; then
    echo "✅ Lien symbolique existe: $(readlink /opt/homebrew/bin/springdocs-mcp)"
else
    echo "❌ Lien symbolique manquant"
fi
echo

echo "📂 Vérification du fichier executable..."
if [ -x "/opt/homebrew/lib/node_modules/@enokdev/springdocs-mcp/build/index.js" ]; then
    echo "✅ Fichier exécutable existe"
else
    echo "❌ Fichier exécutable manquant ou non exécutable"
fi
echo

echo "🏗️ Vérification du shebang..."
head -1 /opt/homebrew/lib/node_modules/@enokdev/springdocs-mcp/build/index.js | grep -q "#!/usr/bin/env node" && echo "✅ Shebang correct" || echo "❌ Shebang incorrect"
echo

echo "🔄 Test de la commande directe..."
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | timeout 5s /opt/homebrew/bin/springdocs-mcp 2>&1 | head -5 || echo "❌ Timeout ou erreur"
echo

echo "📋 Configuration Claude Desktop actuelle:"
echo "$(cat ~/Library/Application\ Support/Claude/claude_desktop_config.json 2>/dev/null || echo '❌ Fichier de configuration non trouvé')"
echo

echo "💡 Configuration recommandée pour Claude Desktop:"
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

echo "🔧 Pour résoudre les problèmes potentiels:"
echo "1. Redémarrer Claude Desktop complètement"
echo "2. Vérifier que la configuration JSON est valide"
echo "3. Utiliser le chemin absolu: /opt/homebrew/bin/springdocs-mcp"
echo "4. Si nécessaire, réinstaller: npm uninstall -g @enokdev/springdocs-mcp && npm install -g @enokdev/springdocs-mcp"
