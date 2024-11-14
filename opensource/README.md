# BACKUP / DUMP Strategy

## Using default S3 method

Please, create a bucket in minio client interface named as your env S3_BUCKET_NAME (default: 'media')
BE SURE TO HAVE YOUR CUSTOM ENV S3 :

```markdown
DELEGATED_STORAGE_METHOD=S3

S3_ENDPOINT=minio
S3_PORT=9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=media

DELEGATED_STORAGE_HOST=http://[S3_ENDPOINT]:[S3_PORT]
```

If you want to create a dump from actual database when all is running :
Request media-api route /catalog/create-dump
