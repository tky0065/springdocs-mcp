# 🚀 Configuration pour IDEs JetBrains

## 📋 IDEs JetBrains supportés

- **IntelliJ IDEA** (Ultimate & Community)
- **WebStorm**
- **PyCharm** (Professional & Community)
- **PhpStorm**
- **RubyMine**
- **CLion**
- **GoLand**
- **Rider**
- **DataGrip**
- **Android Studio**

## ⚙️ Configuration

### Option 1: Via le Plugin Claude (Recommandé)

1. **Installer le plugin Claude** depuis JetBrains Marketplace
2. **Configurer les serveurs MCP** dans Settings

**Chemin:** `Settings → Tools → Claude → MCP Servers`

**Configuration:**
```json
{
  "spring-docs": {
    "command": "/opt/homebrew/bin/springdocs-mcp"
  }
}
```

### Option 2: Configuration manuelle

**Fichier de configuration JetBrains:**
`~/.jetbrains/claude_mcp_config.json`

```json
{
  "mcpServers": {
    "spring-docs": {
      "command": "/opt/homebrew/bin/springdocs-mcp",
      "description": "Spring Documentation MCP Server - Access to complete Spring ecosystem",
      "timeout": 30000
    }
  }
}
```

### Option 3: Configuration par IDE

#### IntelliJ IDEA
**Fichier:** `~/.IntelliJIdea/config/options/claude.xml`

```xml
<application>
  <component name="ClaudeSettings">
    <option name="mcpServers">
      <map>
        <entry key="spring-docs">
          <value>
            <MCPServerConfig>
              <option name="command" value="/opt/homebrew/bin/springdocs-mcp" />
              <option name="description" value="Spring Documentation" />
            </MCPServerConfig>
          </value>
        </entry>
      </map>
    </option>
  </component>
</application>
```

#### WebStorm
**Fichier:** `~/.WebStorm/config/options/claude.xml`

#### PyCharm
**Fichier:** `~/.PyCharm/config/options/claude.xml`

## 🔧 Script d'installation automatique

Créons un script pour configurer automatiquement tous vos IDEs JetBrains :

```bash
#!/bin/bash
./setup-jetbrains.sh
```

## 🎯 Utilisation dans JetBrains IDEs

### 1. Accès via Chat AI

Dans votre IDE JetBrains avec Claude activé :

```
Quels sont les projets Spring pour la sécurité ?
```

### 2. Aide contextuelle

Sélectionnez du code Spring et demandez :

```
Comment améliorer cette configuration Spring Boot ?
```

### 3. Documentation instantanée

```
Montre-moi le guide Spring Boot pour les APIs REST
```

## 🛠️ Outils disponibles dans JetBrains

Tous les 7 outils MCP seront disponibles :

1. **search_spring_docs** - Recherche documentation
2. **search_spring_projects** - Projets Spring
3. **get_spring_project** - Détails projet
4. **get_all_spring_guides** - Liste guides
5. **get_spring_guide** - Contenu guide
6. **get_spring_reference** - Référence
7. **search_spring_concepts** - Concepts

## 📝 Exemples d'utilisation

### Développement Spring Boot dans IntelliJ

```java
@RestController
public class UserController {
    // Demander à Claude : "Montre-moi les meilleures pratiques pour ce contrôleur"
}
```

### Configuration dans application.yml

```yaml
spring:
  # Demander : "Quelles sont les options de configuration disponibles ?"
```

## 🔍 Dépannage JetBrains

### Plugin Claude non visible
1. Vérifier que le plugin est installé
2. Redémarrer l'IDE
3. Vérifier les permissions

### MCP Server non connecté
1. Vérifier le chemin : `/opt/homebrew/bin/springdocs-mcp`
2. Tester la commande dans le terminal
3. Vérifier les logs de l'IDE

## 📍 Emplacements des configurations

### macOS
- **IntelliJ IDEA:** `~/Library/Application Support/JetBrains/IntelliJIdea*/`
- **WebStorm:** `~/Library/Application Support/JetBrains/WebStorm*/`
- **PyCharm:** `~/Library/Application Support/JetBrains/PyCharm*/`

### Windows
- **Tous IDEs:** `%APPDATA%\JetBrains\[IDE_NAME]*\`

### Linux
- **Tous IDEs:** `~/.config/JetBrains/[IDE_NAME]*/`

---

**Note:** La disponibilité exacte dépend de la version du plugin Claude pour JetBrains. Consultez la documentation officielle du plugin pour les détails spécifiques à votre IDE.
