# Exemple de Distant Backend pour TADA

Ce dossier contient un **exemple d'implémentation** d'un serveur backend distant compatible avec TADA. Il démontre comment créer un serveur de stockage délégué qui peut être utilisé avec l'API TADA.

## 🎯 Objectif de l'exemple

Cet exemple montre comment implémenter un serveur backend distant qui :
- Reçoit et stocke les fichiers envoyés par TADA
- Organise les fichiers par namespace et destination
- Fournit les APIs nécessaires pour l'intégration avec TADA
- Peut être lancé localement pour les tests et le développement

## 🚀 Comment lancer l'exemple localement

### Prérequis
- Node.js 18+
- npm

### Étapes de lancement

1. **Naviguer vers le dossier de l'exemple**
   ```bash
   cd examples/distant-backend
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Créer la configuration**

   Créez un fichier `.env` dans le dossier `examples/distant-backend/` :
   ```env
   UPLOAD_DIR=./uploads
   TOKEN=NinjaDesIles
   ```

4. **Lancer le serveur en mode développement**
   ```bash
   npm run dev
   ```

   Le serveur démarre sur **http://localhost:3002**

### Vérification

Une fois lancé, testez que l'exemple fonctionne :
```bash
curl http://localhost:3002/readiness-check
# Réponse attendue : "Serveur OK"
```

## 📡 API Routes

Cet exemple implémente les routes définies dans [server3.ts](server3.ts) :

- **GET `/readiness-check`** : Vérification de santé
- **POST `/files`** : Upload de fichiers avec métadonnées
- **GET `/file`** : Récupération par filepath ou uuid
- **PATCH `/file`** : Modification de fichier existant
- **DELETE `/file`** : Suppression de fichier

## 🧪 Test rapide

```bash
# Vérification
curl http://localhost:3002/readiness-check

# Upload (via TADA - génère une public_url)
curl -X POST http://localhost:3001/file \
  -H "Authorization: Bearer your-token" \
  -F "file=@mon-image.jpg" \
  -F "namespace=DEV" \
  -F "destination=tests"

# Récupération (utiliser la public_url générée par TADA)
# Exemple: http://localhost:3001/assets/media/full/DEV/tests/mon-image.webp
```

## 📋 Tests avancés

Pour tester les autres routes (PATCH, DELETE, etc.), consultez la **configuration Bruno** dans le dossier `tests/single/` du repository :

- `POST FILE.bru` - Upload de fichiers
- `GET FILE.bru` - Récupération de fichiers
- `PATCH FILE.bru` - Modification de fichiers
- `DELETE FILE.bru` - Suppression de fichiers

Ces fichiers Bruno contiennent la configuration exacte des requêtes à utiliser avec cet exemple.