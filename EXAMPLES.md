# Exemples d'utilisation du serveur MCP Spring Documentation

Ce fichier contient des exemples pratiques d'utilisation du serveur MCP Spring Documentation avec Claude Desktop.

## 🚀 Scénarios d'utilisation

### 1. Découverte des projets Spring

**Question à Claude :**
> "Quels sont les projets Spring disponibles pour la sécurité ?"

**Outils utilisés :** `search_spring_projects`
**Résultat :** Liste des projets Spring Security avec descriptions

---

### 2. Apprentissage d'un nouveau projet Spring

**Question à Claude :**
> "Peux-tu m'expliquer le projet Spring Cloud ?"

**Outils utilisés :** `get_spring_project`
**Résultat :** Documentation complète de Spring Cloud

---

### 3. Exploration des guides par domaine

**Question à Claude :**
> "Montre-moi tous les guides Spring Boot pour le développement web"

**Outils utilisés :** `get_all_spring_guides`
**Résultat :** Liste des guides web avec liens et descriptions

---

### 4. Résolution d'un problème spécifique

**Question à Claude :**
> "Comment créer une API REST avec Spring Boot ?"

**Outils utilisés :** `search_spring_docs`, `get_spring_guide`
**Résultat :** Guide détaillé et documentation de référence

---

### 5. Compréhension des concepts

**Question à Claude :**
> "Explique-moi l'auto-configuration dans Spring Boot"

**Outils utilisés :** `search_spring_concepts`
**Résultat :** Explication détaillée avec exemples

---

## 🎯 Exemples de requêtes spécifiques

### Recherche de documentation
```
Utilisateur: "Comment configurer Spring Security ?"
Claude utilise: search_spring_docs("Spring Security configuration")
```

### Exploration de projets
```
Utilisateur: "Quels sont les projets Spring pour les données ?"
Claude utilise: search_spring_projects("data")
```

### Guides spécialisés
```
Utilisateur: "Guides Spring Boot pour les tests"
Claude utilise: get_all_spring_guides(category="Testing")
```

### Documentation de référence
```
Utilisateur: "Documentation Spring Boot pour la sécurité web"
Claude utilise: get_spring_reference("security", "web")
```

### Concepts avancés
```
Utilisateur: "Qu'est-ce que Spring Actuator ?"
Claude utilise: search_spring_concepts("actuator", "production")
```

---

## 💡 Conseils d'utilisation optimale

### 1. Soyez spécifique dans vos questions
- ❌ "Spring Boot"
- ✅ "Comment configurer une base de données avec Spring Boot ?"

### 2. Utilisez des mots-clés pertinents
- ❌ "Aide"
- ✅ "REST API", "JPA", "Security", "Testing"

### 3. Explorez par domaine
- "Projets Spring pour le cloud"
- "Guides Spring Boot pour les microservices"
- "Documentation Spring Security"

### 4. Demandez des exemples pratiques
- "Montre-moi un exemple de contrôleur REST"
- "Comment tester une application Spring Boot ?"
- "Configuration d'une base de données H2"

---

## 🔧 Workflows recommandés

### Workflow 1: Découverte d'un nouveau domaine
1. **Rechercher les projets** → `search_spring_projects("domaine")`
2. **Explorer un projet** → `get_spring_project("nom-projet")`
3. **Trouver des guides** → `get_all_spring_guides(category="Domaine")`
4. **Lire un guide spécifique** → `get_spring_guide("guide-id")`

### Workflow 2: Résolution d'un problème
1. **Rechercher dans la doc** → `search_spring_docs("problème")`
2. **Comprendre les concepts** → `search_spring_concepts("concept")`
3. **Consulter la référence** → `get_spring_reference("section")`
4. **Suivre un guide pratique** → `get_spring_guide("guide-id")`

### Workflow 3: Apprentissage structuré
1. **Concepts de base** → `search_spring_concepts("core")`
2. **Guides pour débutants** → `get_all_spring_guides(category="Getting Started")`
3. **Documentation de référence** → `get_spring_reference("web")`
4. **Projets avancés** → `search_spring_projects("advanced")`

---

## 🌟 Cas d'usage avancés

### Développement d'une API REST complète
```
1. "Quels sont les guides pour créer une API REST ?"
2. "Montre-moi le guide pour créer un service REST"
3. "Comment sécuriser une API REST avec Spring Security ?"
4. "Documentation sur les tests d'API REST"
5. "Concepts de production pour les API REST"
```

### Migration vers Spring Boot 3
```
1. "Quels sont les projets Spring compatibles avec Boot 3 ?"
2. "Guide de migration Spring Boot 2 vers 3"
3. "Nouvelles fonctionnalités Spring Boot 3"
4. "Documentation de référence Spring Boot 3"
```

### Architecture microservices
```
1. "Projets Spring pour les microservices"
2. "Guides Spring Cloud"
3. "Concepts de configuration distribuée"
4. "Documentation Spring Cloud Gateway"
```

---

## 📖 Types de réponses attendues

### Listes de résultats (search_*)
- Titres des ressources
- Descriptions courtes
- URLs directes
- Types de contenu

### Contenu détaillé (get_*)
- Documentation complète en Markdown
- Exemples de code
- Configuration
- Bonnes pratiques

### Concepts (search_spring_concepts)
- Définitions claires
- Exemples concrets
- Mots-clés associés
- Cas d'usage

---

*Ce serveur MCP vous donne accès à l'ensemble de l'écosystème Spring directement dans Claude Desktop !*
