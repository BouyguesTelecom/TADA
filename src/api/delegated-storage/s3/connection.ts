import * as Minio from 'minio';

export const minioClient =
    process.env.DELEGATED_STORAGE_METHOD === 'S3' &&
    new Minio.Client({
        endPoint: process.env.S3_ENDPOINT,
        port: parseInt(process.env.S3_PORT),
        useSSL: false,
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY
    });
