# Guide de Contribution - Spring Boot MCP Server

Merci de votre intérêt pour contribuer au projet Spring Boot MCP Server ! Ce guide vous aidera à comprendre comment participer au développement.

## 🛠️ Configuration de l'environnement de développement

### Prérequis
- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript >= 5.0.0
- Git

### Installation
```bash
# Cloner le repository
git clone <votre-fork>
cd springdocsmcp

# Installer les dépendances
npm install

# Compiler le projet
npm run build

# Exécuter les tests
./test.sh
```

## 📝 Structure du projet

```
springdocsmcp/
├── src/
│   ├── index.ts              # Point d'entrée du serveur MCP
│   ├── services/
│   │   └── springboot-docs.ts # Service de documentation Spring Boot
│   └── tools/
│       └── index.ts          # Définitions des outils MCP
├── build/                    # Fichiers compilés TypeScript
├── package.json              # Configuration npm
├── tsconfig.json            # Configuration TypeScript
└── README.md                # Documentation principale
```

## 🔧 Développement

### Scripts disponibles
- `npm run build` - Compile le TypeScript
- `npm run dev` - Mode développement avec rechargement automatique
- `npm run test` - Exécute les tests (ou utilisez `./test.sh`)
- `npm run lint` - Vérifie le style de code

### Ajouter un nouvel outil

1. **Définir l'outil dans `src/tools/index.ts`** :
```typescript
export const NOUVEAU_OUTIL: Tool = {
  name: "nouveau_outil",
  description: "Description de votre nouvel outil",
  inputSchema: {
    type: "object",
    properties: {
      parametre: {
        type: "string",
        description: "Description du paramètre"
      }
    },
    required: ["parametre"]
  }
};
```

2. **Implémenter la logique dans `src/services/springboot-docs.ts`** :
```typescript
public async nouveauOutil(parametre: string): Promise<string> {
  // Votre logique ici
  return "Résultat de l'outil";
}
```

3. **Ajouter le gestionnaire dans `src/index.ts`** :
```typescript
case "nouveau_outil":
  const result = await this.docsService.nouveauOutil(args.parametre);
  return { content: [{ type: "text", text: result }] };
```

### Ajouter une nouvelle source de documentation

1. **Étendre le service** dans `src/services/springboot-docs.ts`
2. **Ajouter les nouvelles URLs** dans les constantes
3. **Implémenter les méthodes de parsing** spécifiques
4. **Tester avec le script de test**

## 🧪 Tests

### Tests automatisés
Exécutez le script de test pour vérifier que tous les outils fonctionnent :
```bash
./test.sh
```

### Tests manuels
Testez individuellement avec des requêtes JSON-RPC :
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "search_spring_docs", "arguments": {"query": "test"}}}' | node build/index.js
```

### Tests d'intégration
Testez avec Claude Desktop en ajoutant la configuration MCP et en utilisant les outils dans une conversation.

## 📋 Standards de code

### Style TypeScript
- Utilisez des types stricts
- Préférez `interface` pour les objets
- Documentez les fonctions publiques avec JSDoc
- Utilisez `async/await` pour les opérations asynchrones

### Nommage
- Fonctions et variables : `camelCase`
- Classes : `PascalCase`
- Constantes : `UPPER_SNAKE_CASE`
- Fichiers : `kebab-case.ts`

### Gestion d'erreurs
```typescript
try {
  // Opération risquée
} catch (error) {
  console.error('Erreur détaillée:', error);
  throw new Error('Message d'erreur utilisateur');
}
```

## 🐛 Signalement de bugs

### Template de bug report
```markdown
**Description du bug**
Description claire et concise du problème.

**Étapes pour reproduire**
1. Étape 1
2. Étape 2
3. Voir l'erreur

**Comportement attendu**
Ce qui devrait se passer.

**Environnement**
- OS: [ex: macOS 14.0]
- Node.js: [ex: 18.17.0]
- Version du serveur: [ex: 1.0.0]

**Logs d'erreur**
```
Logs ou messages d'erreur
```

## ✨ Demandes de fonctionnalités

### Template de feature request
```markdown
**Fonctionnalité désirée**
Description claire de la fonctionnalité.

**Problème résolu**
Quel problème cette fonctionnalité résoudrait-elle ?

**Solution proposée**
Description de votre solution idéale.

**Alternatives considérées**
Autres solutions que vous avez envisagées.
```

## 🔄 Processus de contribution

1. **Fork** le repository
2. **Créez une branche** pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. **Committez** vos changements (`git commit -am 'Ajoute nouvelle fonctionnalité'`)
4. **Poussez** vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. **Créez une Pull Request**

### Checklist pour les Pull Requests
- [ ] Le code compile sans erreur (`npm run build`)
- [ ] Les tests passent (`./test.sh`)
- [ ] La documentation est mise à jour si nécessaire
- [ ] Les nouveaux outils sont documentés
- [ ] Le code suit les standards du projet

## 📚 Ressources utiles

- [Documentation MCP](https://modelcontextprotocol.io/docs)
- [Spécification MCP](https://spec.modelcontextprotocol.io/)
- [Documentation Spring Boot](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Code de conduite

Nous nous engageons à créer un environnement accueillant et inclusif pour tous. Merci de :
- Être respectueux et professionnel
- Accepter les critiques constructives
- Se concentrer sur ce qui est le mieux pour la communauté
- Faire preuve d'empathie envers les autres

## 📞 Contact

Pour toute question ou discussion, n'hésitez pas à :
- Ouvrir une issue sur GitHub
- Participer aux discussions
- Contacter les mainteneurs

Merci pour votre contribution ! 🎉
