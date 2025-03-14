import * as Minio from 'minio';
import { logger } from '../../../utils/logs/winston';

export class S3Connection {
    private static instance: S3Connection;
    private client: Minio.Client;

    private constructor() {
        this.client = new Minio.Client({
            endPoint: process.env.S3_ENDPOINT || 'localhost',
            port: parseInt(process.env.S3_PORT || '9000'),
            useSSL: process.env.S3_USE_SSL === 'true',
            accessKey: process.env.S3_ACCESS_KEY || '',
            secretKey: process.env.S3_SECRET_KEY || ''
        });

        logger.info('S3 client initialized');
    }

    public static getInstance(): S3Connection {
        if (!S3Connection.instance) {
            S3Connection.instance = new S3Connection();
        }
        return S3Connection.instance;
    }

    public getClient(): Minio.Client {
        return this.client;
    }

    public async getObject(bucket: string, objectName: string): Promise<NodeJS.ReadableStream> {
        return await this.client.getObject(bucket, objectName);
    }

    public async putObject(bucket: string, objectName: string, data: Buffer | string): Promise<any> {
        return await this.client.putObject(bucket, objectName, data);
    }

    public async removeObject(bucket: string, objectName: string): Promise<void> {
        await this.client.removeObject(bucket, objectName);
    }

    public async listObjects(bucket: string, prefix: string, recursive: boolean = true): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const objectsList: string[] = [];
            const stream = this.client.listObjectsV2(bucket, prefix, recursive);

            stream.on('data', (obj: Minio.BucketItem) => {
                if (obj.name) {
                    objectsList.push(obj.name);
                }
            });

            stream.on('end', () => {
                resolve(objectsList);
            });

            stream.on('error', (err: Error) => {
                reject(err);
            });
        });
    }

    public async bucketExists(bucket: string): Promise<boolean> {
        return await this.client.bucketExists(bucket);
    }

    public async createBucket(bucket: string): Promise<void> {
        if (!(await this.bucketExists(bucket))) {
            await this.client.makeBucket(bucket, process.env.S3_REGION || 'us-east-1');
            logger.info(`Bucket ${bucket} created`);
        }
    }
}

export const s3Connection = S3Connection.getInstance();
