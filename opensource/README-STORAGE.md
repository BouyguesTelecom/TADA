# Storage Configuration Guide

This document describes the different storage options available for TADA and how to deploy them using the provided Helm charts.

## Available Storage Types

TADA supports three different storage backends:

### 1. STANDALONE (Default Local Storage)
- **File**: `values.local-standalone.yaml`
- **Description**: Files are stored locally within the application pod
- **Use case**: Development, testing, single-node deployments
- **Dependencies**: None (Redis only)
- **Deployment**: `make start-standalone`

**Characteristics:**
- No external storage dependencies
- Data persists only within the pod lifecycle
- Simplest setup for development

### 2. S3 (MinIO Compatible Storage)
- **File**: `values.local-s3.yaml`
- **Description**: Files are stored in S3-compatible storage (MinIO in local setup)
- **Use case**: Production, scalable deployments
- **Dependencies**: MinIO (or AWS S3)
- **Deployment**: `make start-s3`

**Characteristics:**
- Scalable and persistent storage
- Compatible with AWS S3 and MinIO
- Requires S3 credentials and configuration

### 3. DISTANT_BACKEND (Remote File Service)
- **File**: `values.local-distant-backend.yaml`
- **Description**: Files are managed by a remote backend service
- **Use case**: Microservices architecture, external file management
- **Dependencies**: External file management service
- **Deployment**: `make start-distant-backend`

**Characteristics:**
- Delegates file storage to external service
- Requires authentication token
- Flexible integration with existing systems

## Deployment Commands

### Quick Start
```bash
# Deploy with S3 storage (default)
make start

# Deploy with standalone storage
make start-standalone

# Deploy with S3 storage (explicit)
make start-s3

# Deploy with distant backend storage
make start-distant-backend
```

### Individual Components
```bash
# Install only the Helm chart with specific storage
make helm-install-standalone
make helm-install-s3
make helm-install-distant-backend
```

## Configuration Details

### Environment Variables by Storage Type

#### STANDALONE
```yaml
delegatedStorage:
    storageMethod: 'STANDALONE'
    connect: false
```

#### S3
```yaml
delegatedStorage:
    storageMethod: 'S3'
    connect: true
    host: 'http://minio:9000'
    accessToken: 'NinjaDesIles'

s3:
    accessKey: 'minioadmin'
    secretKey: 'minioadmin'
    bucketName: 'media'
```

#### DISTANT_BACKEND
```yaml
delegatedStorage:
    storageMethod: 'DISTANT_BACKEND'
    connect: true
    host: 'http://distant-backend-service:3000'
    accessToken: 'your-distant-backend-token'
```

## Switching Between Storage Types

To change storage types:

1. **Stop current deployment**:
   ```bash
   make stop
   ```

2. **Start with new storage type**:
   ```bash
   make start-[storage-type]
   ```

## Notes

- The `start` command defaults to S3 storage for backward compatibility
- Each storage type has its own values file in the `opensource/` directory
- All storage types use the same Redis configuration for metadata
- Tests run automatically after deployment with `make start-*` commands

## Troubleshooting

### STANDALONE Issues
- Check pod storage limits
- Verify Redis connectivity

### S3 Issues
- Verify MinIO is running and accessible
- Check S3 credentials and bucket configuration
- Ensure network connectivity between pods

### DISTANT_BACKEND Issues
- Verify external service is accessible
- Check authentication token
- Validate API endpoints are responding