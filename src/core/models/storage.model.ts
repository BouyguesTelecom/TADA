import { IStorage } from '../interfaces/Istorage';

export class StorageFactory {
    static create(storageType: string = process.env.DELEGATED_STORAGE_METHOD || 'STANDALONE'): IStorage {
        switch (storageType.toUpperCase()) {
            case 'S3':
                const { S3Storage } = require('../../infrastructure/storage/s3/s3.storage');
                return new S3Storage();

            case 'DISTANT':
            case 'DISTANT-BACKEND':
                const { DistantBackendStorage } = require('../../infrastructure/storage/distant-backend/distantBackend.storage');
                return new DistantBackendStorage();

            case 'STANDALONE':
            default:
                const { StandaloneStorage } = require('../../infrastructure/storage/standalone/standalone.storage');
                return new StandaloneStorage();
        }
    }
}
