# Guide CI/CD - Publication Automatique Spring Docs MCP

## 🎯 Objectif
Configurer une pipeline CI/CD pour publier automatiquement le package npm à chaque release/tag Git.

## 📋 Étapes à Suivre

### 1. 🔑 Configuration des Secrets GitHub

#### a) Créer un Token NPM
1. Aller sur [npmjs.com](https://www.npmjs.com/)
2. Se connecter à votre compte
3. Aller dans **Settings** → **Access Tokens**
4. Cliquer **Generate New Token** → **Classic Token**
5. Sélectionner scope: **Automation** (pour CI/CD)
6. Copier le token généré

#### b) Ajouter le Token aux Secrets GitHub
1. Aller sur votre repo GitHub: `https://github.com/tky0065/springdocs-mcp`
2. **Settings** → **Secrets and variables** → **Actions**
3. Cliquer **New repository secret**
4. Nom: `NPM_TOKEN`
5. Valeur: Le token NPM copié précédemment
6. Cliquer **Add secret**

### 2. 📁 Créer le Workflow GitHub Actions

Créer le fichier: `.github/workflows/publish.yml`

```yaml
name: Publish to NPM

on:
  # Déclenchement manuel
  workflow_dispatch:
  
  # Déclenchement sur push de tags
  push:
    tags:
      - 'v*'
  
  # Déclenchement sur release
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    
    steps:
    # 1. Checkout du code
    - name: Checkout repository
      uses: actions/checkout@v4
    
    # 2. Setup Node.js
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        registry-url: 'https://registry.npmjs.org'
    
    # 3. Installation des dépendances
    - name: Install dependencies
      run: npm ci
    
    # 4. Build du projet
    - name: Build project
      run: npm run build
    
    # 5. Run tests (optionnel)
    - name: Run tests
      run: npm test
      continue-on-error: true
    
    # 6. Publication sur NPM
    - name: Publish to NPM
      run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 3. 🔄 Workflow de Release Automatique

Créer le fichier: `.github/workflows/release.yml`

```yaml
name: Create Release

on:
  push:
    branches: [ main ]
    paths:
      - 'package.json'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
    # 1. Checkout
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    # 2. Lire la version du package.json
    - name: Get version from package.json
      id: version
      run: |
        VERSION=$(node -p "require('./package.json').version")
        echo "version=v$VERSION" >> $GITHUB_OUTPUT
        echo "Version detected: v$VERSION"
    
    # 3. Vérifier si le tag existe déjà
    - name: Check if tag exists
      id: tag_check
      run: |
        if git rev-parse "refs/tags/${{ steps.version.outputs.version }}" >/dev/null 2>&1; then
          echo "exists=true" >> $GITHUB_OUTPUT
        else
          echo "exists=false" >> $GITHUB_OUTPUT
        fi
    
    # 4. Créer le tag et la release
    - name: Create Release
      if: steps.tag_check.outputs.exists == 'false'
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ steps.version.outputs.version }}
        release_name: Release ${{ steps.version.outputs.version }}
        body: |
          ## Changes in ${{ steps.version.outputs.version }}
          
          - Automatic release from package.json version bump
          - Check CHANGELOG.md for detailed changes
          
          ## Installation
          ```bash
          npx @enokdev/springdocs-mcp@latest
          ```
        draft: false
        prerelease: false
```

### 4. 🛠️ Scripts NPM Additionnels

Ajouter dans `package.json`:

```json
{
  "scripts": {
    "version:patch": "npm version patch && git push origin main --follow-tags",
    "version:minor": "npm version minor && git push origin main --follow-tags", 
    "version:major": "npm version major && git push origin main --follow-tags",
    "release:dry": "npm publish --dry-run",
    "release:manual": "npm run build && npm publish"
  }
}
```

### 5. 📝 Processus de Publication

#### Option A: Release Automatique (Recommandée)
```bash
# 1. Faire des changements et commit
git add .
git commit -m "feat: nouvelle fonctionnalité"

# 2. Bumper la version (crée automatiquement tag + release)
npm run version:patch   # 1.2.3 → 1.2.4
npm run version:minor   # 1.2.3 → 1.3.0  
npm run version:major   # 1.2.3 → 2.0.0

# 3. La publication NPM se fait automatiquement via GitHub Actions
```

#### Option B: Release Manuelle
```bash
# 1. Créer un tag manuellement
git tag v1.2.4
git push origin v1.2.4

# 2. Aller sur GitHub → Releases → Draft a new release
# 3. Sélectionner le tag v1.2.4
# 4. La publication NPM se déclenche automatiquement
```

#### Option C: Publication Manuelle d'Urgence
```bash
# Test avant publication
npm run release:dry

# Publication directe
npm run release:manual
```

### 6. ✅ Vérifications Avant Publication

#### Checklist Pre-Release:
- [ ] Tests passent: `npm test`
- [ ] Build réussit: `npm run build`
- [ ] Version correcte dans `package.json`
- [ ] CHANGELOG.md mis à jour
- [ ] README.md à jour
- [ ] Secrets NPM_TOKEN configurés sur GitHub

#### Test du Workflow:
```bash
# Tester le build local
npm ci
npm run build
npm run release:dry

# Vérifier que tout est OK avant de push
```

### 7. 📊 Monitoring et Debug

#### Voir les logs GitHub Actions:
1. Aller sur GitHub → Actions
2. Cliquer sur le workflow qui a échoué
3. Examiner les logs de chaque étape

#### Commandes de debug:
```bash
# Vérifier la version NPM
npm view @enokdev/springdocs-mcp version

# Lister les tags Git
git tag -l

# Vérifier le statut de publication
npm view @enokdev/springdocs-mcp time --json
```

### 8. 🔄 Workflow Type pour Chaque Changement

#### 🐛 Bug Fix (patch: 1.2.3 → 1.2.4)
```bash
git checkout main
git pull origin main
# Faire les fixes
git add .
git commit -m "fix: correction bug getGuide"
npm run version:patch
```

#### ✨ Nouvelle Feature (minor: 1.2.3 → 1.3.0)
```bash
git checkout -b feature/nouvelle-feature
# Développer la feature
git add .
git commit -m "feat: ajout outil search avancé"
git checkout main
git merge feature/nouvelle-feature
npm run version:minor
```

#### 💥 Breaking Change (major: 1.2.3 → 2.0.0)
```bash
# Développer le breaking change
git add .
git commit -m "feat!: refactor API MCP tools"
npm run version:major
```

## 🎉 Résultat Final

Une fois configuré, votre workflow sera:
1. **Push code** → GitHub
2. **Bump version** → `npm run version:patch`
3. **Auto-release** → GitHub Actions
4. **Auto-publish** → NPM Registry
5. **Notification** → Package disponible via `npx @enokdev/springdocs-mcp@latest`

Temps de déploiement: **~2-3 minutes** 🚀

## 🛠️ Scripts de Configuration Créés

### Setup automatique
```bash
npm run cicd:setup
```
Script interactif qui configure automatiquement:
- ✅ Token NPM dans les secrets GitHub
- ✅ Vérification des workflows
- ✅ Tests de build et publication
- ✅ Instructions détaillées

### Vérification rapide
```bash
npm run cicd:check
```
Script de diagnostic qui vérifie:
- 📦 Versions (locale vs NPM)
- 🌿 Statut Git (branch, changements, tags)
- 🔄 Présence des workflows
- 🔐 Configuration des secrets
- 🧪 Tests de build et publication

## 📋 Checklist Finale

- [ ] **Configuration initiale**
  - [ ] Token NPM créé sur npmjs.com
  - [ ] Script setup exécuté: `npm run cicd:setup`
  - [ ] Workflows GitHub présents dans `.github/workflows/`

- [ ] **Première publication**
  - [ ] Code commité: `git add . && git commit -m "feat: setup CI/CD"`
  - [ ] Version bumpée: `npm run version:patch`
  - [ ] Vérification GitHub Actions: Repository → Actions

- [ ] **Vérification**
  - [ ] Package publié: `npm view @enokdev/springdocs-mcp`
  - [ ] Installation fonctionne: `npx @enokdev/springdocs-mcp@latest`
  - [ ] Tag GitHub créé: Repository → Releases

## 🚨 Troubleshooting

### Publication échoue
```bash
# Vérifier le status
npm run cicd:check

# Test local
npm run release:dry

# Vérifier les logs GitHub Actions
# Repository → Actions → [dernier workflow]
```

### Token NPM expiré
```bash
# Reconfigurer le token
npm run cicd:setup
# → Suivre les instructions pour mettre à jour le token
```

### Workflow ne se déclenche pas
```bash
# Vérifier que le tag a été poussé
git tag -l
git push origin --tags

# Déclencher manuellement
# Repository → Actions → Publish to NPM → Run workflow
```

**🎯 Avec cette configuration, vous avez un pipeline CI/CD professionnel pour votre serveur MCP !**
