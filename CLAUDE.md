# TADA - Contexte agent

## Role du projet

TADA (Transform And Deliver Assets) est un service open source de gestion, stockage, transformation et diffusion de fichiers media. Il expose une API Express/TypeScript, un catalogue Redis, un stockage delegue et une couche Nginx de cache.

TADA est independant de toute application cliente ou infrastructure proprietaire. Un consommateur peut l'utiliser seul, derriere un CMS, dans une application web ou comme service media partage.

## Architecture

```text
Client / CMS / application
          |
          | HTTP multipart et HTTP GET
          v
Nginx public (cache court)
          |
          v
TADA API (Express)
      |          |
      |          +--> Redis (catalogue et metadonnees)
      |
      +--> stockage delegue
            |-- filesystem standalone
            |-- S3 / MinIO
            +-- backend HTTP distant
```

Nginx peut etre deploye en deux couches : une couche publique avec un cache court et une couche interne capable de purger le cache. La topologie peut etre simplifiee pour un environnement de developpement.

## API et contrat d'integration

- `POST /file`, `POST /files` : upload simple ou multiple en multipart.
- `PATCH /file/:uuid`, `PATCH /files` : remplacement ou mise a jour (necessite l'UUID retourne a l'upload pour le fichier simple).
- `DELETE /file/:uuid`, `DELETE /files` : suppression.
- `GET /catalog`, `GET /catalog/:id` : catalogue des fichiers exposes, ou un item precis.
- `POST /catalog`, `PATCH /catalog` (ou `/catalog/:uuid`), `DELETE /catalog` (ou `/catalog/:uuid`) : gestion directe d'entrees de catalogue, independamment de l'upload de fichier.
- `GET /assets/media/:format/*` : lecture et transformation d'un fichier (`format` = `original`, `full` ou `optimise/{w}x{h}`).
- `GET /readiness-check` (path configurable via `HEALTHCHECK_ROUTE`) : health check.

Un client doit fournir au minimum un namespace et un fichier. Il peut aussi fournir `external_id`, `destination`, `filename`, `information`, `expiration_date` et `toWebp`. Le champ `external_id` permet de relier l'item TADA a l'identifiant du systeme appelant.

### Deux notions de "dump" a ne pas confondre

1. **API de dump exposee par TADA a ses clients** (namespace `/catalog/...`), definie dans `src/api/routes/dumps.routes.ts` :
   - `POST /catalog/create-dump` : cree un dump JSON+RDB du catalogue Redis.
   - `GET /catalog/get-dump/:version` (`:version` peut etre `latest` ou un nom de fichier, `?format=json|rdb`) : recupere un dump.
   - `POST /catalog/restore-dump/:version` : restaure le catalogue depuis un dump.
2. **Contrat sortant vers le stockage delegue** (utilise seulement si `DELEGATED_STORAGE_METHOD=DISTANT_BACKEND`), configure via `URL_TO_GET_BACKUP` et `URL_TO_POST_BACKUP` (voir `src/api/delegated-storage/distant-backend/utils.ts`). Ces variables pointent vers des routes exposees par le backend delegue lui-meme (typiquement `/get-dump` et `/save-dump` cote Palpatine_Media), qui n'ont pas besoin de s'appeler pareil que les routes internes `/catalog/...dump...` de TADA.

Ne pas documenter ces deux ensembles de routes comme un seul contrat : le premier est l'API publique de TADA, le second est un detail d'implementation du backend `DISTANT_BACKEND`.

## Options de stockage

### Standalone

Le filesystem local est adapte au developpement, aux tests et aux petites installations. Il n'offre pas automatiquement la haute disponibilite ni le partage entre replicas.

### S3 ou MinIO

Le stockage objet est recommande pour la production et les deploiements distribues. Configurer l'endpoint, le port, les identifiants et le bucket via les valeurs Helm ou les variables d'environnement correspondantes.

### Backend HTTP distant

Cette option permet de deleguer les fichiers a un service externe. Le backend doit implementer les routes de fichier simple, fichier multiple, lecture, mise a jour et suppression configurees dans TADA. Le meme mecanisme est utilise pour les dumps du catalogue.

## Formats et transformation

- PNG et JPEG peuvent etre convertis en WebP selon `toWebp` et `CONVERT_TO_WEBP`.
- SVG, GIF et PDF doivent conserver leur format d'origine et etre servis via `/original`.
- Les GIF animes ne doivent pas passer dans un pipeline de redimensionnement qui les rasteriserait en WebP.
- `VALID_MIMETYPES` definit les types acceptes a l'upload.
- Si un bloc Nginx `types {}` est utilise, chaque type doit etre declare, par exemple `image/gif gif;`.
- Le traitement des metadonnees doit toujours retourner un flux valide pour les formats non transformables.

Le set central des formats non transformables est dans `src/api/utils/mimetypes.ts`. Toute evolution de format doit reutiliser ce helper au lieu de recreer des listes locales.

## Configuration essentielle

- `DELEGATED_STORAGE_METHOD` : `S3`, `STANDALONE` ou `DISTANT_BACKEND`.
- `DELEGATED_STORAGE_HOST`, `DELEGATED_STORAGE_SINGLE_PATH`/`DELEGATED_STORAGE_MULTI_PATH` : contrat avec le stockage delegue (voir `src/api/delegated-storage/distant-backend/utils.ts`).
- `DELEGATED_STORAGE_TOKEN` : Bearer token envoye au backend delegue.
- `DELEGATED_STORAGE_READINESS_CHECK` : path de health check du backend delegue.
- `URL_TO_GET_BACKUP` / `URL_TO_POST_BACKUP` : routes du backend delegue pour les dumps (voir section dump ci-dessus).
- `VALID_MIMETYPES` : filtre d'upload.
- `CONVERT_TO_WEBP`, `USE_STRIPMETADATA`, `SAVE_ORIGINAL_FILE`, `COMPRESS_WEBP` : traitement, compression et conservation de l'original.
- `NAMESPACES` : namespaces autorises.
- `PUBLIC_URL`, `API_PREFIX`, `DEV_ENV` (ajoute un prefixe `DEV/` au catalogue) : construction des URLs et namespace de dev.
- `MEDIA_TOKEN`, `ORIGINS_ALLOWED`, `METHODS_ALLOWED` : securite et acces HTTP.
- `PAYLOAD_MAX_SIZE`, `REQUEST_TIMEOUT`, `BASE_TIMEOUT_MS` : capacite et timeouts du service.
- `DELEGATED_STORAGE_RATE_LIMIT_WINDOW` / `DELEGATED_STORAGE_RATE_LIMIT` : rate limiting specifique aux appels vers le stockage delegue.
- `REDIS_SERVICE`, `PORT`, `NODE_ENV` : configuration serveur et catalogue.
- `NGINX_SERVICE` : URL du Nginx interne, utilisee pour la purge de cache.
- Stockage S3/MinIO : `S3_ENDPOINT`, `S3_PORT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`.
- `DUMP_FOLDER_PATH` : chemin local des dumps RDB (defaut `/dumps`).

Un middleware de queue (`src/api/middleware/queues/queuesMiddleware.ts`) serialise les operations de dump (create/restore) pour eviter les acces concurrents a Redis.

## Hebergement

### Docker Compose

Utiliser Docker Compose avec Redis, un stockage S3/MinIO ou un volume filesystem, TADA API et Nginx. Cette option convient au developpement et aux environnements simples.

### Kubernetes avec Helm

Le chart est dans `opensource/`. Il permet de configurer TADA API, Redis, Nginx, le stockage, les probes, les ressources, le HPA, l'ingress et les jobs de dump. Un consommateur peut utiliser le chart comme dependance OCI ou l'installer localement avec un fichier de valeurs.

Exemple generique :

```sh
helm dependency update ./opensource
helm upgrade --install tada ./opensource -f values.yaml --namespace media --create-namespace
```

### Image Docker

L'image API est construite depuis `src/api/Dockerfile`. Un deploiement doit pinner un tag versionne plutot que `latest` en production. Les versions de l'image et du chart doivent rester alignes pour faciliter les rollbacks.

## Developpement et tests

Depuis `src/api` :

```sh
npm install
npm run dev
```

Les tests Bruno sont dans `tests/`, les environnements dans `tests/environments/` et les fichiers d'exemple dans `local/images/`. Les tests doivent couvrir les uploads, le catalogue, la lecture, les remplacements, les suppressions et les formats non transformables.

Pour tester un format : verifier le statut HTTP, `mimetype`, `original_mimetype`, `public_url`, le contenu binaire retourne et le header `Content-Type`.

## Debug methodique

1. Verifier le health check et les variables d'environnement effectives.
2. Verifier le rejet MIME, la taille et le namespace.
3. Verifier l'item du catalogue et sa signature.
4. Verifier le stockage delegue, le chemin, la version et les logs.
5. Verifier Nginx, le cache, la route `/original` ou `/full` et le Content-Type.

Un fichier absent du catalogue peut venir d'un echec de persistance, d'une signature invalide, d'une expiration ou d'un stockage delegue inaccessible. Diagnostiquer ces causes avant de modifier la transformation d'image.

## Integration avec une application cliente

Une application cliente doit :

1. Choisir un namespace et un backend de stockage.
2. Configurer l'URL de l'API, l'URL publique et l'authentification.
3. Envoyer les fichiers via les routes `/file` ou `/files`.
4. Conserver `uuid`, `external_id`, `public_url` et les informations de version retournes par le catalogue.
5. Utiliser `/original` pour les formats qui ne doivent pas etre transformes et `/full` ou les routes de transformation pour les images compatibles.

Ne jamais commiter de tokens, secrets, fichiers `.env` chiffres ou dumps contenant des donnees reelles.
