# 🚀 Spring Documentation MCP Server v1.2.0 - Support JetBrains IDEs

## 🎉 Nouveautés de la version 1.2.0

### ✨ Support complet des IDEs JetBrains

Votre serveur MCP Spring Documentation est maintenant compatible avec **tous les IDEs JetBrains** :

- ✅ **IntelliJ IDEA** (Ultimate & Community)
- ✅ **WebStorm** 
- ✅ **PyCharm** (Professional & Community)
- ✅ **PhpStorm**
- ✅ **RubyMine**
- ✅ **CLion**
- ✅ **GoLand**
- ✅ **Rider**
- ✅ **DataGrip**
- ✅ **Android Studio**

## 🛠️ Installation et Configuration

### 1. Mise à jour du package (si déjà installé)

```bash
npm update -g @enokdev/springdocs-mcp
```

### 2. Configuration automatique JetBrains

```bash
cd /path/to/springdocs-mcp
./setup-jetbrains.sh
```

### 3. Vérification de la configuration

```bash
./test-jetbrains.sh
```

## 🎯 Utilisation dans vos IDEs

### Claude Desktop
✅ **Déjà configuré** - Continuez à utiliser comme avant

### VS Code
✅ **Déjà configuré** - Extension Claude avec MCP

### JetBrains IDEs (NOUVEAU!)
🆕 **Nouvellement supporté** :

1. **Installer le plugin Claude** dans votre IDE JetBrains
2. **Redémarrer l'IDE** après la configuration automatique
3. **Tester** avec une question Spring dans le chat Claude

## 💬 Exemples d'utilisation JetBrains

### Dans IntelliJ IDEA
```
Vous: "Quels sont les projets Spring pour la sécurité ?"
Claude: [Utilise search_spring_projects("security")]
```

### Dans WebStorm
```
Vous: "Comment créer une API REST avec Spring Boot ?"
Claude: [Utilise get_spring_guide("gs-rest-service")]
```

### Dans GoLand
```
Vous: "Documentation Spring Boot pour les microservices"
Claude: [Utilise search_spring_concepts("microservices")]
```

## 🔧 Tous vos outils MCP Spring disponibles

1. **search_spring_docs** - Recherche documentation
2. **search_spring_projects** - Projets Spring ecosystem
3. **get_spring_project** - Détails d'un projet
4. **get_all_spring_guides** - Liste des guides
5. **get_spring_guide** - Contenu guide complet
6. **get_spring_reference** - Documentation référence
7. **search_spring_concepts** - Concepts Spring Boot

## 📍 Où utiliser maintenant

| Environnement | Status | Configuration |
|---------------|--------|---------------|
| **Claude Desktop** | ✅ Actif | `claude_desktop_config.json` |
| **VS Code** | ✅ Actif | Extension Claude |
| **IntelliJ IDEA** | 🆕 Nouveau | Plugin Claude + XML config |
| **WebStorm** | 🆕 Nouveau | Plugin Claude + XML config |
| **GoLand** | 🆕 Nouveau | Plugin Claude + XML config |
| **PyCharm** | 🆕 Nouveau | Plugin Claude + XML config |
| **Autres JetBrains** | 🆕 Nouveau | Plugin Claude + XML config |

## 🔄 Migration depuis v1.1.1

**Aucune action requise** pour vos configurations existantes :
- ✅ Claude Desktop continue de fonctionner
- ✅ VS Code continue de fonctionner
- 🆕 JetBrains IDEs maintenant supportés en plus

## 🛠️ Dépannage

### JetBrains IDEs
Si les outils n'apparaissent pas :

1. **Vérifier le plugin Claude** est installé
2. **Redémarrer l'IDE** complètement
3. **Vérifier la configuration** : `./test-jetbrains.sh`
4. **Consulter** `JETBRAINS_SETUP.md` pour les détails

### Claude Desktop / VS Code
Si problème existant :

1. **Consulter** `TROUBLESHOOTING.md`
2. **Exécuter** `./diagnostic.sh`

## 🎊 Profitez de votre Spring Documentation

Vous avez maintenant accès à **toute la documentation Spring** dans **tous vos environnements de développement** !

- 📚 **Documentation complète** Spring Boot + écosystème
- 🛠️ **7 outils MCP puissants**
- 🌐 **Support multi-plateforme** (Claude Desktop, VS Code, JetBrains)
- ⚡ **Accès instantané** à spring.io/projects et guides

---

**🔗 Liens utiles :**
- 📖 [Documentation complète](README.md)
- 🛠️ [Configuration JetBrains](JETBRAINS_SETUP.md)
- 🔧 [Dépannage](TROUBLESHOOTING.md)
- 📦 [npm Package](https://www.npmjs.com/package/@enokdev/springdocs-mcp)

**Made with ❤️ by [EnokDev](https://github.com/tky0065)**
