#!/bin/bash

# Script de test pour le serveur MCP Spring Boot Documentation
# Ce script teste les différentes fonctionnalités du serveur

echo "🧪 Test du serveur MCP Spring Boot Documentation"
echo "================================================"

# Fonction pour envoyer une requête JSON-RPC et afficher la réponse
send_request() {
    local request="$1"
    local description="$2"
    
    echo -e "\n📝 Test: $description"
    echo "Requête: $request"
    echo "Réponse:"
    echo "$request" | node build/index.js | tail -n 1 | jq '.'
    echo "---"
}

# Vérifier que le serveur est compilé
if [ ! -f "build/index.js" ]; then
    echo "❌ Le serveur n'est pas compilé. Exécutez 'npm run build' d'abord."
    exit 1
fi

# Vérifier que jq est installé pour formater le JSON
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq n'est pas installé. Les réponses JSON ne seront pas formatées."
    alias jq="cat"
fi

# Test 1: Initialisation
send_request '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' "Initialisation du serveur"

# Test 2: Liste des outils
send_request '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}' "Liste des outils disponibles"

# Test 3: Recherche de documentation
send_request '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_spring_docs", "arguments": {"query": "REST API", "limit": 3}}}' "Recherche de documentation REST API"

# Test 4: Recherche de concepts
send_request '{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "search_spring_concepts", "arguments": {"concept": "auto-configuration"}}}' "Recherche du concept auto-configuration"

echo -e "\n✅ Tests terminés!"
echo ""
echo "Pour utiliser ce serveur avec Claude Desktop, ajoutez ceci à votre claude_desktop_config.json:"
echo '{'
echo '  "mcpServers": {'
echo '    "springboot-docs": {'
echo '      "command": "node",'
echo "      \"args\": [\"$(pwd)/build/index.js\"]"
echo '    }'
echo '  }'
echo '}'
