# TADA K6 Load Testing Suite

Suite de tests de charge complète pour l'API TADA utilisant K6.

## Structure du projet

```
k6/
├── src/
│   ├── config/           # Configuration et environnements
│   ├── utils/            # Utilitaires partagés
│   ├── scenarios/        # Tests de charge par catégorie
│   └── data/            # Fichiers de données de test
├── dist/                # Code compilé TypeScript
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
cd k6/
npm install
```

## Configuration

### Environnements

Les environnements sont définis dans `src/config/environment.ts`:

- **local**: Tests en local (défaut)
- **dev**: Environnement de développement
- **staging**: Environnement de staging

### Variables d'environnement

```bash
export ENVIRONMENT=local
export BEARER_TOKEN=your-token
export NAMESPACE=DEV
export BASE_URL=http://localhost:3001
export API_URL=http://localhost:3001
export ASSETS_URL=http://localhost:8080
```

## Types de tests

### 1. Smoke Test
**Objectif**: Validation fonctionnelle de base
- 1 utilisateur virtuel
- 2 minutes de durée
- Tests basiques des endpoints principaux

```bash
npm run test:smoke
```

### 2. Load Test
**Objectif**: Performance sous charge normale
- Montée en charge progressive (10 VUs)
- Tests de téléchargement à haute fréquence (50 req/s)
- Tests catalog continu
- 20-25 minutes de durée

```bash
npm run test:load
```

### 3. Stress Test
**Objectif**: Limites du système
- Montée progressive jusqu'à 100 VUs
- Tests de téléchargement jusqu'à 400 req/s
- Tests mixtes de toutes les opérations
- ~40 minutes de durée

```bash
npm run test:stress
```

### 4. Spike Test
**Objectif**: Résilience aux pics de trafic
- Pics soudains de trafic (jusqu'à 500 req/s)
- Tests de récupération
- Monitoring de la santé du système

```bash
npm run test:spike
```

### 5. Catalog Test
**Objectif**: Tests spécialisés sur les opérations catalog
- CRUD complet sur le catalog
- Tests de lecture intensive
- Opérations de dump/restore

```bash
npm run test:catalog
```

## Métriques personnalisées

- `file_upload_errors`: Nombre d'erreurs d'upload
- `file_download_errors`: Nombre d'erreurs de téléchargement
- `catalog_errors`: Nombre d'erreurs catalog
- `rate_limit_hits`: Nombre de rate limits atteints
- `file_upload_duration`: Temps d'upload des fichiers
- `file_download_duration`: Temps de téléchargement
- `catalog_response_time`: Temps de réponse catalog
- `error_rate`: Taux d'erreur global
- `success_rate`: Taux de succès

## Utilisation

### Compilation

```bash
npm run build
```

### Tests individuels

```bash
# Test de fumée
npm run test:smoke

# Test de charge
npm run test:load

# Test de stress
npm run test:stress

# Test de pics
npm run test:spike

# Test catalog
npm run test:catalog
```

### Test complet

```bash
npm run test:all
```

### Avec options K6

```bash
# Test local
k6 run src/simple-smoke-test.js --env ENVIRONMENT=local

# Test sur Kubernetes
k6 run src/simple-smoke-test.js --env ENVIRONMENT=kubernetes

# Test personnalisé
k6 run src/simple-smoke-test.js \
  --env ENVIRONMENT=custom \
  --env BASE_URL=https://your-api.com \
  --env BEARER_TOKEN=your-token
```

## Seuils de performance

### Smoke Test
- 95% des requêtes < 2s
- Taux d'échec < 10%
- Taux d'erreur < 5%

### Load Test
- 95% des requêtes < 3s, 99% < 5s
- Taux d'échec < 5%
- Taux d'erreur < 2%
- Upload: 95% < 10s
- Download: 95% < 2s
- Catalog: 95% < 1s

### Stress Test
- 95% des requêtes < 5s, 99% < 10s
- Taux d'échec < 10%
- Taux d'erreur < 5%
- Upload: 95% < 15s, 99% < 30s
- Download: 95% < 3s, 99% < 8s
- Catalog: 95% < 2s, 99% < 5s

### Spike Test
- 95% des requêtes < 8s, 99% < 15s
- Taux d'échec < 20%
- Taux d'erreur < 15%

## Fichiers de test

Les tests utilisent les fichiers d'exemple situés dans `../../local/images/`:
- default.webp
- jpg.jpg
- test.png
- test.pdf
- test.svg

## Nettoyage

```bash
npm run clean
```

## ✅ Problèmes résolus
- **Erreurs TypeScript** : Imports K6 corrigés
- **Tests fonctionnels** : Scripts simplifiés sans modules complexes
- **Execution directe** : Plus besoin de compilation pour les tests de base

## 🚀 **Utilisation immédiate** :

```bash
cd TADA/k6
npm install             # Installation des dépendances
npm run test:smoke      # Test de fumée direct
npm run interactive     # Menu interactif
```

### Tests par Environnement :

```bash
# Tests Local (http://localhost:3001)
npm run test:smoke        # Test de validation
npm run test:load         # Test de charge
npm run test:quick        # Test rapide (30s)

# Tests Kubernetes (http://media-service.tada-api.media)
npm run test:smoke:k8s    # Test de validation sur K8s
npm run test:load:k8s     # Test de charge sur K8s
npm run test:quick:k8s    # Test rapide sur K8s

# Tests TypeScript compilés (nécessitent npm run build)
npm run test:stress       # Test de stress
npm run test:catalog      # Test catalog
```

### Mode Interactif Recommandé :

```bash
npm run interactive       # Menu interactif avec choix d'environnement
```

### Avec variables d'environnement personnalisées :

```bash
k6 run src/simple-smoke-test.js \
  --env ENVIRONMENT=kubernetes \
  --env BEARER_TOKEN=your-token \
  --env NAMESPACE=STAGING
```

## Environments disponibles

Les environnements sont configurés dans `environments.json` :

- **local** : `http://localhost:3001` (défaut)
- **dev** : Environment de développement
- **staging** : Environment de staging  
- **prod** : Environment de production ⚠️

## Troubleshooting

### Connection refused
Normal si le serveur TADA n'est pas démarré. Le test affichera les erreurs de connection mais fonctionnera correctement.

### Erreur "No test files available"
Les tests simples n'ont pas besoin de fichiers externes, ils créent leurs propres données de test.

### Rate limiting
Les tests gèrent automatiquement les status 429 (rate limit) et les comptent dans les métriques.

### Erreurs de serveur
Les tests tolèrent les erreurs serveur (503, 504) pendant les pics de charge.

### Tests qui ne démarrent pas
Vérifiez que K6 est installé : `brew install k6`