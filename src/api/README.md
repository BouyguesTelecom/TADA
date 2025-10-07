# TADA - Transform And Deliver Assets 🎉

> **A modern, cloud-native media management API for storing, transforming, and delivering digital assets with enterprise-grade features.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Helm%20Charts-326ce5.svg)](https://helm.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

---

## 📑 Table of Contents

- [About TADA](#-about-tada)
- [Key Features](#-key-features)
- [Architecture Overview](#-architecture-overview)
- [Storage Backend Options](#-storage-backend-options)
- [API Endpoints & Data Models](#-api-endpoints--data-models)
- [Getting Started](#-getting-started)
- [Production Deployment](#-production-deployment)
- [Helm Chart Configuration](#-helm-chart-configuration)
- [Performance & Monitoring](#-performance--monitoring)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 About TADA

**TADA** (Transform And Deliver Assets) is an enterprise-ready media management API designed to handle digital assets at scale. Built with TypeScript and Express.js, it provides a comprehensive solution for uploading, storing, transforming, and delivering images and documents through a RESTful API.

### Why TADA?

- **🔧 Flexible Storage**: Support for multiple storage backends (S3, MinIO, standalone filesystem, or distant backend)
- **⚡ Optimized Delivery**: Automatic image optimization and WebP conversion with multiple delivery formats
- **🛡️ Enterprise Security**: Built-in rate limiting, authentication, and request validation
- **📊 Catalog Management**: Redis-powered catalog system for metadata and file tracking
- **🔄 Cache Management**: Multi-level caching with Nginx and Redis for optimal performance
- **☁️ Cloud Native**: Kubernetes-ready with Helm charts for production deployments
- **📈 Scalable**: Horizontal Pod Autoscaling and resource management

---

## ✨ Key Features

### 🖼️ **Image Processing & Delivery**
- **Multiple Format Support**: PNG, JPEG, WebP, SVG, PDF
- **Automatic Optimization**: WebP conversion with quality optimization
- **Dynamic Resizing**: On-demand image resizing with caching
- **Three Delivery Modes**:
  - `/assets/media/original/` - Original file without processing
  - `/assets/media/full/` - WebP optimized version
  - `/assets/media/optimise/{width}x{height}/` - Resized and optimized

### 📁 **File Management**
- **Upload Management**: Single and batch file uploads
- **Metadata Extraction**: Automatic file signature, size, and MIME type detection
- **Version Control**: File versioning system
- **Expiration Management**: Time-based file expiration
- **Namespace Organization**: Multi-tenant file organization

### 🗄️ **Storage Flexibility**
- **S3/MinIO**: AWS S3 compatible storage
- **Standalone**: Local filesystem storage
- **Distant Backend**: Custom external storage integration
- **Hybrid Support**: Mix and match storage types

### 🔐 **Security & Compliance**
- **Rate Limiting**: Configurable request rate limiting
- **Authentication**: Token-based authentication
- **CORS Support**: Cross-origin resource sharing
- **Input Validation**: Comprehensive request validation
- **Metadata Stripping**: Optional sensitive metadata removal

---

## 🏗️ Architecture Overview

TADA employs a multi-tier architecture designed for performance and scalability:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │  Load Balancer  │    │   CDN/Cache     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Nginx (Cache)  │ ── Cache: 1min
                    └─────────┬───────┘
                              │
                    ┌─────────────────┐
                    │ Nginx (Purge)   │ ── Cache: 30days + Purge
                    └─────────┬───────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ TADA API    │    │   Redis     │    │   Storage   │
    │ (Express)   │    │ (Catalog)   │    │  Backend    │
    └─────────────┘    └─────────────┘    └─────────────┘
```

### Components

- **Nginx Caching Layer**: Dual-layer caching with cache invalidation
- **TADA API**: Core Express.js application with TypeScript
- **Redis Catalog**: Metadata storage and file indexing
- **Storage Backend**: Pluggable storage system (S3, MinIO, filesystem, custom)

---

## 🗃️ Storage Backend Options

TADA supports multiple storage backends that can be configured via environment variables:

### 1. **S3/MinIO Storage** (`DELEGATED_STORAGE_METHOD=S3`)
```bash
# S3 Configuration
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_NAME=media
```

**Use Cases:**
- Production environments
- Cloud deployments (AWS, GCP, Azure)
- High availability requirements
- Object storage with unlimited scalability

### 2. **Standalone Filesystem** (`DELEGATED_STORAGE_METHOD=STANDALONE`)
```bash
# Filesystem Configuration
TMP_FILES_PATH=./tmp/files
```

**Use Cases:**
- Development environments
- Small deployments
- Local testing
- Traditional server setups

### 3. **Distant Backend** (`DELEGATED_STORAGE_METHOD=DISTANT_BACKEND`)
```bash
# External Storage Configuration
DELEGATED_STORAGE_HOST=https://your-storage-api.com
DELEGATED_STORAGE_TOKEN=your-api-token
DELEGATED_STORAGE_SINGLE_PATH=/api/v1/file
DELEGATED_STORAGE_MULTI_PATH=/api/v1/files
```

**Use Cases:**
- Integration with existing storage systems
- Custom storage backends
- Microservice architectures
- Legacy system integration

---

## 📊 API Endpoints & Data Models

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/catalog` | Retrieve file catalog |
| `POST` | `/file` | Upload single file |
| `POST` | `/files` | Upload multiple files |
| `PATCH` | `/file/:uuid` | Update file or metadata |
| `PATCH` | `/files` | Update multiple files |
| `DELETE` | `/file/:uuid` | Delete single file |
| `DELETE` | `/files` | Delete multiple files |

### File Catalog Data Model

```typescript
interface FileMetadata {
  uuid: string;                    // Unique identifier
  version: number;                 // File version
  namespace: string;               // Organization namespace
  public_url: string;              // Public access URL
  unique_name: string;             // Storage path
  filename: string;                // Display filename
  original_filename: string;       // Original upload name
  base_url: string;                // Base service URL
  external_id?: string;            // External system reference
  expired: boolean;                // Expiration status
  expiration_date?: string;        // ISO date string
  information?: any;               // Custom metadata
  original_mimetype: string;       // Original MIME type
  mimetype: string;                // Current MIME type
  signature: string;               // SHA-256 hash
  size: number;                    // File size in bytes
  created_date: string;            // Creation timestamp
  updated_date?: string;           // Last update timestamp
}
```

### Upload Response Format

```typescript
interface UploadResponse {
  status: number;
  datum?: FileMetadata;     // Single file response
  data?: FileMetadata[];    // Multiple files response
  error?: string;           // Error message
  errors?: string[];        // Multiple error messages
}
```

### Supported File Types

| Type | Extensions | MIME Types |
|------|------------|------------|
| Images | `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg` | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` |
| Documents | `.pdf` | `application/pdf` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Redis** 6.0+
- **Docker** & **Docker Compose** (optional)
- **Kubernetes** cluster (for production)

### Local Development Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/BouyguesTelecom/TADA.git
cd TADA
```

#### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install API dependencies
cd src/api
npm install
```

#### 3. Environment Configuration
```bash
# Decrypt environment file (development)
npm run decrypt-env

# Or create your own .env file based on the examples
cp local/compose/.env.s3 src/api/.env
```

#### 4. Choose Your Development Setup

**Option A: S3/MinIO Backend**
```bash
# Start with S3/MinIO storage
npm run start-s3

# This will:
# - Start MinIO server
# - Start Redis
# - Start TADA API with S3 backend
```

**Option B: Standalone Backend**
```bash
# Start API with standalone filesystem
cd src/api
npm run dev
```

**Option C: Distant Backend**
```bash
# Configure distant backend in .env, then:
npm run start-distant-backend
```

#### 5. Verify Installation
```bash
# Check API health
curl http://localhost:3001/readiness-check

# View API documentation
open http://localhost:3001/api-docs
```

### Development Commands

```bash
# Development mode with auto-reload
npm run dev:api

# Build production version
npm run build

# Start production server
npm start

# Format code
npm run format

# Docker development environment
npm run docker:dev
```

---

## 🌐 Production Deployment

### Docker Deployment

#### 1. Build and Deploy
```bash
# Build and start all services
docker compose up --build -d

# Or for development
docker compose -f docker-compose.dev.yml up --build -d
```

#### 2. Environment Variables
Create a production `.env` file:

```bash
# Core Configuration
NODE_ENV=production
PORT=3001
VERSION=1.0.0

# Redis Configuration
REDIS_SERVICE=redis-service
DUMP_FOLDER_PATH=/dumps

# Storage Configuration (choose one)
DELEGATED_STORAGE_METHOD=S3  # or STANDALONE or DISTANT_BACKEND

# S3 Configuration (if using S3)
S3_ENDPOINT=your-s3-endpoint
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_NAME=media

# Security
MEDIA_TOKEN=your-secure-token
ORIGINS_ALLOWED=your-domain.com
METHODS_ALLOWED=GET,POST,PATCH,DELETE

# Performance
PAYLOAD_MAX_SIZE=50mb
BASE_TIMEOUT_MS=30000
DELEGATED_STORAGE_RATE_LIMIT=10
```

---

## ⚙️ Helm Chart Configuration

TADA includes production-ready Helm charts for Kubernetes deployment.

### Quick Deploy

```bash
# Add the TADA Helm repository
helm repo add tada ./opensource

# Install with default values
helm install my-tada tada/media-tada

# Or with custom values
helm install my-tada tada/media-tada -f my-values.yaml
```

### Configuration Options

#### Core Application Settings
```yaml
# values.yaml
protocol: 'https'
env: 'production'
domain: 'media-api.yourdomain.com'
NAMESPACES_ALLOWED: 'PROD,STAGING'

mediaApi:
  imageName: 'yourdomain/tada'
  imageVersion: 'v1.0.0'
  mediaToken: 'your-secure-token'
  originsAllowed: 'yourdomain.com,*.yourdomain.com'
  methodsAllowed: 'GET,POST,PATCH,DELETE'
  payloadMaxSize: '50mb'
  requestTimeout: 300000
```

#### Storage Backend Configuration
```yaml
# S3/MinIO Configuration
delegatedStorage:
  storageMethod: 'S3'
  host: 'https://your-s3-endpoint'
  accessToken: 'your-access-token'

s3:
  accessKey: 'your-access-key'
  secretKey: 'your-secret-key'
  bucketName: 'media-production'
```

#### Redis Configuration
```yaml
redis:
  imageName: redis/redis-stack-server
  storage:
    storageClassName: fast-ssd
    requestedStorage: 10Gi
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi
```

#### Scaling & Performance
```yaml
# Horizontal Pod Autoscaler
mediaApi:
  hpa:
    replicaCountMin: 3
    replicaCountMax: 20
    metrics:
      cpu:
        averageUtilization: 70
      memory:
        averageUtilization: 80

# Rate Limiting
mediaApi:
  rateLimit:
    windowMs: 15000
    limit: 100
```

#### Nginx Caching Configuration
```yaml
nginx:
  cdn:
    enabled: true
    maxAge: 3600      # 1 hour cache
    expires: '1h'
  hpa:
    replicaCountMin: 2
    replicaCountMax: 10
```

### Production Considerations

#### Security
```yaml
# Network Policies
networkPolicy:
  enabled: true
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx
    - from:
      - podSelector:
          matchLabels:
            app: monitoring

# Pod Security Context
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
```

#### Monitoring & Observability
```yaml
# ServiceMonitor for Prometheus
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    labels:
      prometheus: main
  
# Health Checks
livenessProbe:
  httpGet:
    path: /readiness-check
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /readiness-check
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 📈 Performance & Monitoring

### Performance Features

- **Multi-layer Caching**: Nginx + Redis for optimal response times
- **Horizontal Scaling**: Kubernetes HPA for automatic scaling
- **Connection Pooling**: Redis connection management
- **Async Processing**: Non-blocking file operations
- **Memory Management**: Efficient stream handling for large files

### Monitoring Endpoints

```bash
# Health Check
GET /readiness-check

# Catalog Status
GET /catalog

# Application Metrics (if monitoring enabled)
GET /metrics
```

### Performance Tuning

#### API Configuration
```yaml
# High-performance settings
mediaApi:
  requestTimeout: 300000     # 5 minutes for large uploads
  payloadMaxSize: '100mb'    # Maximum file size
  baseTimeout: 1000          # Base timeout

# Rate Limiting
rateLimit:
  windowMs: 15000           # 15 second window
  limit: 100                # 100 requests per window
```

#### Redis Optimization
```yaml
redis:
  resources:
    requests:
      memory: 1Gi           # Adequate memory for catalog
    limits:
      memory: 4Gi
  
  # Redis configuration
  config: |
    maxmemory 3gb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
```

---

## 🤝 Contributing

We welcome contributions to TADA! Here's how you can help:

### Development Workflow

1. **Fork the Repository**
```bash
git clone https://github.com/yourusername/TADA.git
cd TADA
```

2. **Create Feature Branch**
```bash
git checkout -b feature/amazing-feature
```

3. **Development Setup**
```bash
npm install
cd src/api
npm install
npm run dev
```

4. **Testing**
```bash
# Run local tests
npm test

# Test with Bruno (API testing)
cd tests
# Import bruno.json into Bruno API client
```

5. **Submit Pull Request**
- Ensure code follows TypeScript standards
- Add tests for new features
- Update documentation
- Follow conventional commit messages

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow the provided configuration
- **Prettier**: Auto-formatting on save
- **Conventional Commits**: Use conventional commit format

### Testing

TADA uses Bruno for API testing. Import the test collection:
```bash
# Located at: tests/bruno.json
# Test environments available:
# - LOCAL
# - LOCAL-S3
# - LOCAL-DISTANT-BACKEND
# - K8S
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links & Resources

- **Documentation**: [API Docs](http://localhost:3001/api-docs) (when running locally)
- **Docker Images**: Available on Docker Hub
- **Helm Charts**: Located in `/opensource` directory
- **Issue Tracker**: [GitHub Issues](https://github.com/BouyguesTelecom/TADA/issues)
- **Discussions**: [GitHub Discussions](https://github.com/BouyguesTelecom/TADA/discussions)

---

## 🙏 Acknowledgments

- Built with ❤️ by Bouygues Telecom
- Powered by TypeScript, Express.js, Redis, and Node.js
- Special thanks to the open-source community

---

**Ready to transform and deliver your assets? Get started with TADA today!** 🚀