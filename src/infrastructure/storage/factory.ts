import { BaseStorage } from './baseStorage';
import { StandaloneStorage } from './standalone/standalone.storage';
import { S3Storage } from './s3/s3.storage';
import { logger } from '../../utils/logs/winston';
import { DistantBackendStorage } from './distant-backend/distantBackend.storage';

export class StorageFactory {
    // Create appropriate storage instance based on environment variable
    public static createStorage(): BaseStorage {
        const storageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
        logger.info(`Creating storage with method: ${storageMethod}`);

        switch (storageMethod.toUpperCase()) {
            case 'S3':
                return new S3Storage();

            case 'DISTANT':
            case 'DISTANT-BACKEND':
                logger.warn('DISTANT storage not fully implemented, falling back to STANDALONE');
                return new DistantBackendStorage();

            case 'STANDALONE':
            default:
                return new StandaloneStorage();
        }
    }
}
