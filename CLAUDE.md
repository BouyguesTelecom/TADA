# TADA - Agent context

## Project role

TADA (Transform And Deliver Assets) is an open source service for managing, storing, transforming and delivering media files. It exposes an Express/TypeScript API, a Redis catalog, a delegated storage and an Nginx caching layer.

TADA is independent from any client application or proprietary infrastructure. A consumer can use it on its own, behind a CMS, in a web application or as a shared media service.

## Architecture

```text
Client / CMS / application
          |
          | HTTP multipart and HTTP GET
          v
Public Nginx (short cache)
          |
          v
TADA API (Express)
      |          |
      |          +--> Redis (catalog and metadata)
      |
      +--> delegated storage
            |-- standalone filesystem
            |-- S3 / MinIO
            +-- remote HTTP backend
```

Nginx can be deployed as two layers: a public layer with a short cache and an internal layer able to purge the cache. The topology can be simplified for a development environment.

## API and integration contract

- `POST /file`, `POST /files`: single or multiple multipart upload.
- `PATCH /file/:uuid`, `PATCH /files`: replacement or update (requires the UUID returned at upload for a single file).
- `DELETE /file/:uuid`, `DELETE /files`: deletion.
- `GET /catalog`, `GET /catalog/:id`: catalog of exposed files, or a specific item.
- `POST /catalog`, `PATCH /catalog` (or `/catalog/:uuid`), `DELETE /catalog` (or `/catalog/:uuid`): direct management of catalog entries, independently of file upload.
- `GET /assets/media/:format/*`: read and transform a file (`format` = `original`, `full` or `optimise/{w}x{h}`).
- `GET /readiness-check` (path configurable via `HEALTHCHECK_ROUTE`): health check.

A client must provide at least a namespace and a file. It can also provide `external_id`, `destination`, `filename`, `information`, `expiration_date` and `toWebp`. The `external_id` field links the TADA item to the identifier of the calling system.

### Two notions of "dump" not to be confused

1. **Dump API exposed by TADA to its clients** (namespace `/catalog/...`), defined in `src/api/routes/dumps.routes.ts`:
   - `POST /catalog/create-dump`: creates a JSON+RDB dump of the Redis catalog.
   - `GET /catalog/get-dump/:version` (`:version` can be `latest` or a file name, `?format=json|rdb`): retrieves a dump.
   - `POST /catalog/restore-dump/:version`: restores the catalog from a dump.
2. **Outgoing contract to the delegated storage** (used only if `DELEGATED_STORAGE_METHOD=DISTANT_BACKEND`), configured via `URL_TO_GET_BACKUP` and `URL_TO_POST_BACKUP` (see `src/api/delegated-storage/distant-backend/utils.ts`). These variables point to routes exposed by the delegated backend itself (typically `/get-dump` and `/save-dump` on the Palpatine_Media side), which do not need to be named the same as TADA's internal `/catalog/...dump...` routes.

Do not document these two sets of routes as a single contract: the first is TADA's public API, the second is an implementation detail of the `DISTANT_BACKEND` backend.

## Storage options

### Standalone

The local filesystem is suited to development, tests and small installations. It does not automatically provide high availability nor sharing between replicas.

### S3 or MinIO

Object storage is recommended for production and distributed deployments. Configure the endpoint, port, credentials and bucket via the corresponding Helm values or environment variables.

### Remote HTTP backend

This option allows delegating files to an external service. The backend must implement the single file, multiple file, read, update and delete routes configured in TADA. The same mechanism is used for catalog dumps.

## Formats and transformation

- PNG and JPEG can be converted to WebP depending on `toWebp` and `CONVERT_TO_WEBP`.
- SVG, GIF and PDF must keep their original format and be served via `/original`.
- Animated GIFs must not go through a resizing pipeline that would rasterize them into WebP.
- `VALID_MIMETYPES` defines the types accepted at upload.
- If an Nginx `types {}` block is used, each type must be declared, for example `image/gif gif;`.
- Metadata processing must always return a valid stream for non-transformable formats.

The central set of non-transformable formats is in `src/api/utils/mimetypes.ts`. Any format change must reuse this helper instead of recreating local lists.

## Essential configuration

- `DELEGATED_STORAGE_METHOD`: `S3`, `STANDALONE` or `DISTANT_BACKEND`.
- `DELEGATED_STORAGE_HOST`, `DELEGATED_STORAGE_SINGLE_PATH`/`DELEGATED_STORAGE_MULTI_PATH`: contract with the delegated storage (see `src/api/delegated-storage/distant-backend/utils.ts`).
- `DELEGATED_STORAGE_TOKEN`: Bearer token sent to the delegated backend.
- `DELEGATED_STORAGE_READINESS_CHECK`: health check path of the delegated backend.
- `URL_TO_GET_BACKUP` / `URL_TO_POST_BACKUP`: delegated backend routes for dumps (see the dump section above).
- `VALID_MIMETYPES`: upload filter.
- `CONVERT_TO_WEBP`, `USE_STRIPMETADATA`, `SAVE_ORIGINAL_FILE`, `COMPRESS_WEBP`: processing, compression and preservation of the original.
- `NAMESPACES`: allowed namespaces.
- `PUBLIC_URL`, `API_PREFIX`, `DEV_ENV` (adds a `DEV/` prefix to the catalog): URL construction and dev namespace.
- `MEDIA_TOKEN`, `ORIGINS_ALLOWED`, `METHODS_ALLOWED`: HTTP security and access.
- `PAYLOAD_MAX_SIZE`, `REQUEST_TIMEOUT`, `BASE_TIMEOUT_MS`: service capacity and timeouts.
- `DELEGATED_STORAGE_RATE_LIMIT_WINDOW` / `DELEGATED_STORAGE_RATE_LIMIT`: rate limiting specific to calls toward the delegated storage.
- `REDIS_SERVICE`, `PORT`, `NODE_ENV`: server and catalog configuration.
- `NGINX_SERVICE`: URL of the internal Nginx, used for cache purge.
- S3/MinIO storage: `S3_ENDPOINT`, `S3_PORT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`.
- `DUMP_FOLDER_PATH`: local path of RDB dumps (default `/dumps`).

A queue middleware (`src/api/middleware/queues/queuesMiddleware.ts`) serializes dump operations (create/restore) to avoid concurrent access to Redis.

## Hosting

### Docker Compose

Use Docker Compose with Redis, an S3/MinIO storage or a filesystem volume, TADA API and Nginx. This option is suited to development and simple environments.

### Kubernetes with Helm

The chart is in `opensource/`. It allows configuring TADA API, Redis, Nginx, the storage, the probes, the resources, the HPA, the ingress and the dump jobs. A consumer can use the chart as an OCI dependency or install it locally with a values file.

Generic example:

```sh
helm dependency update ./opensource
helm upgrade --install tada ./opensource -f values.yaml --namespace media --create-namespace
```

### Docker image

The API image is built from `src/api/Dockerfile`. A deployment must pin a versioned tag rather than `latest` in production. The image and chart versions must stay aligned to ease rollbacks.

## Development and tests

From `src/api`:

```sh
npm install
npm run dev
```

Bruno tests are in `tests/`, the environments in `tests/environments/` and the sample files in `local/images/`. Tests must cover uploads, the catalog, reads, replacements, deletions and non-transformable formats.

To test a format: check the HTTP status, `mimetype`, `original_mimetype`, `public_url`, the binary content returned and the `Content-Type` header.

## Methodical debugging

1. Check the health check and the effective environment variables.
2. Check the MIME rejection, the size and the namespace.
3. Check the catalog item and its signature.
4. Check the delegated storage, the path, the version and the logs.
5. Check Nginx, the cache, the `/original` or `/full` route and the Content-Type.

A file missing from the catalog can come from a persistence failure, an invalid signature, an expiration or an unreachable delegated storage. Diagnose these causes before modifying image transformation.

## Integration with a client application

A client application must:

1. Choose a namespace and a storage backend.
2. Configure the API URL, the public URL and the authentication.
3. Send files via the `/file` or `/files` routes.
4. Keep `uuid`, `external_id`, `public_url` and the version information returned by the catalog.
5. Use `/original` for formats that must not be transformed and `/full` or the transformation routes for compatible images.

Never commit tokens, secrets, encrypted `.env` files or dumps containing real data.
