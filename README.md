<a id="readme-top"></a>

# Transform And Deliver Assets - TADA 🎉

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#discover-TADA">Discover TADA 🎉</a>
      <ul>
        <li><a href="#context">Context </a></li>
        <li><a href="#project-structure-and-architecture">Project structure and architecture 🚧</a></li>   
        <li><a href="#global-flow-architecture">Global flow architecture</a></li>  
        <li><a href="#use-cases">Use cases</a></li>  
        <li><a href="#catalog">Catalog</a></li>  
        <li><a href="#daily-jobs">Daily jobs</a></li>  
    </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## Discover TADA

### Context

The image service allows any utils service to send files to be publicly hosted. Through an utils interface, such as
Directus for example, a user can utils an image and obtain a public URL to use to access their file.
The user can either use the original image via a specific URL or process the image for optimization.

### Project structure and architecture

The image service (more generally files) consists of a first Nginx server whose configuration contains 3 types of locations:

- /catalog
- /assets/media/\*
- /purge/assets/media/\*

This first web server is caching resource 1m,
then proxy pass to the nginx purge server that contains the same locations but configured with proxy_purge_module.
This server caching 30d and can invalidate cache with purge location.

To retrieve an uploaded file, 3 ways :

- /assets/media/**original**/`image_name.extension` : no processing on the image
- /assets/media/**full**/`image_name.extension` : transform to webp and serve as webp
- /assets/media/**optimise**/200x0/`image_name.extension` : resizing to with 200 and transform to webp and serve as webp

And finally an Express Node API whose roles are:

- providing the list of files exposed by the catalog/reference on a GET route
- uploading new files
- updating existing files

An important point is also the notion of catalog. The catalog serves as a reference & truth for the express API, containing information indicating not to serve it (either it has been deleted from the catalog, or it has expired for example).

### API architecture

```bash
src/
├── core/                  # Core business logic
│   ├── models/            # Entity/class definitions
│   │   ├── file.model.ts        # File model representation
│   │   ├── catalog.model.ts     # Catalog model representation
│   │   ├── response.model.ts    # Response model representation
│   │   ├── persistence.model.ts # Persistence model factory
│   │   └── storage.model.ts     # Storage model factory
│   ├── interfaces/        # Interfaces and types
│   │   ├── Ifile.ts       # File interface
│   │   ├── Icatalog.ts    # Catalog interface
│   │   └── Istorage.ts    # Storage interface
│   └── services/          # Business services
│       ├── catalog.service.ts  # Catalog management service
│       ├── file.service.ts     # File management service
│       └── storage.service.ts  # Storage management service
├── infrastructure/        # Technical implementations
│   ├── storage/           # Storage adapters (S3, etc.)
│   │   ├── baseStorage.ts    # Abstract storage class
│   │   ├── factory.ts        # Storage factory
│   │   ├── s3/
│   │   │   ├── s3.storage.ts  # S3 specific implementation
│   │   │   └── connection.ts  # S3 connection handler
│   │   ├── standalone/
│   │   │   └── standalone.storage.ts  # Local storage
│   │   └── distant-backend/
│   │       └── distantBackend.storage.ts  # Remote storage
│   └── persistence/       # Catalog persistence adapters
│       ├── basePersistence.ts  # Abstract persistence class
│       ├── factory.ts          # Persistence factory
│       ├── redis/
│       │   ├── redis.persistence.ts  # Redis persistence
│       │   ├── connection.ts         # Redis connection handler
│       │   └── operation.ts          # Redis operations
│       ├── standalone/
│       │   ├── standalone.persistence.ts  # File-based persistence
│       │   ├── operation.ts               # Standalone operations
│       │   └── utils.ts                   # Standalone utilities
│       └── validators/
│           └── file.validator.ts          # File validation
├── api/                  # API layer
│   ├── routes/           # Route definitions
│   │   ├── base.route.ts      # Base route class
│   │   ├── catalog.route.ts   # Catalog routes
│   │   ├── file.route.ts      # Single file routes
│   │   ├── files.route.ts     # Multiple files routes
│   │   └── index.ts           # Routes aggregation
│   ├── controllers/      # REST controllers
│   │   ├── catalog.controller.ts  # Catalog operations
│   │   ├── file.controller.ts     # Single file operations
│   │   └── files.controller.ts    # Multiple files operations
│   ├── middleware/       # Express middlewares
│   │   ├── auth.ts           # Authentication middleware
│   │   ├── redisMiddleware.ts # Redis connection
│   │   ├── timeoutMiddleware.ts # Request timeout
│   │   └── validators/       # Request validation
│   │       ├── oneFileValidators.ts    # Single file validation
│   │       └── multipleFilesValidators.ts # Multiple files validation
│   ├── app.ts            # Express application setup
│   ├── server.ts         # Server startup
│   └── swaggerConfig.ts  # API documentation
├── utils/                 # Shared utilities
│   ├── logs/              # Logging utilities
│   │   ├── winston.ts     # Winston logger configuration
│   │   └── morgan.ts      # Morgan HTTP logger
│   ├── catalog.ts         # Catalog utilities
│   ├── file.ts            # File utilities
│   ├── date.ts            # Date utilities
│   └── index.ts           # Exported utilities
├── backup-and-clean/      # Maintenance jobs
│   └── src/
│       ├── server.ts      # Job entry point
│       └── utils/
│           └── backup_and_clean.ts  # Backup and cleanup logic
├── .env                   # Environment variables
├── Dockerfile             # Docker build configuration
```

### Global flow architecture

![global.png](readme/global.png)

### Use cases

![img.png](./readme/GET.png)
![img.png](./readme/POST.png)
![img.png](./readme/PATCH.png)
![img.png](./readme/PATCH_INFO.png)
![img.png](./readme/DELETE.png)

### Catalog

To track the images that we have uploaded/deleted/updated we use a Redis server and serve catalog list to json format. Here's a glimpse of it's
structure:

```json
[
    {
        "uuid": "e080a953-5300-427b-bd39-6e235d8238a2",
        "version": 1,
        "namespace": "DEV",
        "public_url": "http://localhost:8080/palpatine/assets/media/full/image/DEV/default.webp",
        "unique_name": "/DEV/default.webp",
        "filename": "default.webp",
        "original_filename": "default.webp",
        "base_url": "http://localhost:8080/palpatine/assets/media",
        "external_id": null,
        "expired": false,
        "expiration_date": null,
        "information": null,
        "original_mimetype": "image/webp",
        "mimetype": "image/webp",
        "signature": "ca71754acda70e41cb23e465fbb5ecc683186cf779a2bae2cbf290527b1f6671",
        "size": 16730,
        "destination": "DEV"
    },
    {
        "uuid": "d26a191f-1087-4169-b6cd-3db96f38ece4",
        "version": 1,
        "namespace": "DEV",
        "public_url": "http://localhost:8080/palpatine/assets/media/full/image/DEV/error.webp",
        "unique_name": "/DEV/error.webp",
        "filename": "error.webp",
        "original_filename": "error.webp",
        "base_url": "http://localhost:8080/palpatine/assets/media",
        "external_id": null,
        "expired": false,
        "expiration_date": null,
        "information": null,
        "original_mimetype": "image/webp",
        "mimetype": "image/webp",
        "signature": "368ba95afb311edfe0cb7f3b4a221e8b2a3edeb4e16fc5683762791f9619b28a",
        "size": 10614
    }
]
```

### Daily jobs

3 daily jobs associated with TADA (Transform And Deliver Assets 🎉):

- a job to synchronize the state of our API in relation to YOUR delegated_storage: if the image is in the catalog, but not in your storage, it deletes the image from the catalog.
- a catalog publication job on your delegated storage: the status of the catalog once a day is published on your storage which allows you to retrieve the most up-to-date list in the event of a new API instance.
- a job to check the expiration of the files in the catalog with an expiration date.

## How to use TADA ? 🎉

### Using Chart Helm dependencie :

```yaml
apiVersion: v2
name: chart
description: A Helm chart for Kubernetes

type: application
version: 0.1.0

appVersion: '0.0.1'
dependencies:
    - name: transform-and-deliver-assets
      version: latest
      repository: oci://registry-1.docker.io/bouyguestelecomcharts/tada
```

All releases :
https://hub.docker.com/r/bouyguestelecom/tada/tags

### CHANGE VALUES / CUSTOMIZE SERVICES

```yaml
transform-and-deliver-assets:
    local: true
    redis: ...
    delegatedStorage: ...
    s3: ...
    mediaApi: ...
    rateLimit: ...
    domain: .media
    env: media-service
    # SEE BELOW ALL VALUES
```

| Clé                                         | Description                                | Exemples de Valeurs       |
| ------------------------------------------- | ------------------------------------------ | ------------------------- |
| local                                       | Enable or disable the local mode           | true / false              |
| redis.service                               | Redis service name                         | 'redis-service'           |
| redis.dumpFolderPath                        | Redis dump folder path                     | '/dumps'                  |
| redis.storage.storageClassName              | Redis storage class name                   | 'hostpath'                |
| redis.storage.resources.requests.storage    | Redis storage requested space              | '500Mi'                   |
| delegatedStorage.rateLimitWindow            | Delegated storage rate limit window (ms)   | 30000                     |
| delegatedStorage.rateLimit                  | Delegated storage rate limit               | 5                         |
| delegatedStorage.host                       | Custom service API host                    | 'your_custom_service_api' |
| delegatedStorage.routes.readinessCheck      | Readiness check path                       | '/readiness-check'        |
| delegatedStorage.accessToken                | Access token for the delegated storage     | 'your_access_token'       |
| delegatedStorage.storageMethod              | Storage method                             | 'DISTANT_BACKEND'         |
| s3.routes.readinessCheck                    | Readiness check path for MinIO             | '/minio/health/live'      |
| s3.endpoint                                 | Endpoint for S3/MinIO                      | 'minio'                   |
| s3.port                                     | Port for S3/MinIO                          | '9000'                    |
| s3.accessKey                                | Access key for S3/MinIO                    | 'minioadmin'              |
| s3.secretKey                                | Secret key for S3/MinIO                    | 'minioadmin'              |
| s3.bucketName                               | Bucket name for S3/MinIO                   | 'media'                   |
| s3.storage.storageClassName                 | Storage class name for S3/MinIO            | 'hostpath'                |
| s3.storage.resources.requests.storage       | Requested storage space for S3/MinIO       | '500Mi'                   |
| mediaApi.service                            | URL for the media service                  | 'http://media-service'    |
| mediaApi.apiPrefix                          | API prefix for the media service           | '/palpatine'              |
| mediaApi.routes.healthcheck.get             | Media healthcheck endpoint                 | '/readiness-check'        |
| mediaApi.routes.file.get                    | Endpoint to get files                      | '/assets/media/'          |
| mediaApi.routes.file.post                   | Endpoint to upload a file                  | '/upload'                 |
| mediaApi.routes.files.post                  | Endpoint to upload multiple files          | '/uploads'                |
| mediaApi.routes.catalog.get                 | Endpoint to get the file catalog           | '/catalog'                |
| mediaApi.payloadMaxSize                     | Maximum payload size                       | '10mb'                    |
| mediaApi.rateLimit.windowMs                 | Rate limit window (ms)                     | 30000                     |
| mediaApi.rateLimit.limit                    | Rate limit                                 | 5                         |
| mediaApi.originsAllowed                     | Allowed origins                            | 'localhost,\*'            |
| mediaApi.methodsAllowed                     | Allowed HTTP methods                       | 'GET,POST'                |
| mediaApi.storage.storageClassName           | Storage class name for media provider      | 'hostpath'                |
| mediaApi.storage.resources.requests.storage | Requested storage space for media provider | '500Mi'                   |
| rateLimit.windowMs                          | Rate limit window (ms)                     | 30000                     |
| rateLimit.limit                             | Rate limit                                 | 5                         |
| domain                                      | Domain for the service                     | '.media'                  |
| env                                         | Environment for the service                | 'media-service'           |
| NAMESPACES_ALLOWED                          | Allowed namespaces                         | 'DEV'                     |
| version                                     | Chart version                              | '1.0.6'                   |

### Using docker image API :

You can use our docker image API from [docker hub](https://hub.docker.com/r/bouyguestelecom/tada/tags)

```shell
 docker pull bouyguestelecom/tada:api-latest
```

## Want to collaborate or test locally ?

### Prerequisites

- docker
- kubernetes

### Installation

#### With Make and kubernetes dashboard

Prerequisites :

- Make installed
- Docker
- Kubernetes

1. Launch Makefile
    ```sh
    make start
    ```
2. Stop services
    ```sh
    make stop
    ```

#### With Helm

Prerequisites :

- Helm installed
- Docker
- Kubernetes

1. Helm install
    ```sh
    helm upgrade --install media-release opensource/. -f opensource/values.local.yaml
    ```
2. Helm uninstall
    ```sh
    helm uninstall media-release
    ```

#### With Docker Compose

Prerequisites :

- Docker compose
- Docker

1. Build and run services (image docker api from [docker hub](https://hub.docker.com/r/bouyguestelecom/tada/tags))
    ```sh
    docker compose up --build -d
    ```
2. Build and run services locally
    ```sh
    docker compose -f docker-compose.dev.yml up --build -d
    ```
3. Stop services
    ```sh
    docker compose down
    ```

#### To test locally without docker :

Prerequisites:

- npm
- node

2. Install NPM packages
    ```sh
    npm install --prefix src/api/
    ```
3. Run api
    ```sh
    npm run dev:api
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [x] Add Changelog
- [x] Add waza
- [ ] Add waza 2

See the [open issues]() for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Maintainer name - Bouygues Telecom

Project Link: [https://github.com/](https://github.com/BouyguesTelecom/TADA)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
