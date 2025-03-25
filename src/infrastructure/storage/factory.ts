import { IStorage } from '../../core/interfaces/Istorage';
import { logger } from '../../utils/logs/winston';
import { DistantBackendStorage } from './distant-backend/distantBackend.storage';
import { S3Storage } from './s3/s3.storage';
import { StandaloneStorage } from './standalone/standalone.storage';

export class StorageFactory {
    public static createStorage(): IStorage {
        const storageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
        logger.info(`Creating storage with method: ${storageMethod}`);

        switch (storageMethod.toUpperCase()) {
            case 'S3':
                return new S3Storage() as unknown as IStorage;

            case 'DISTANT':
            case 'DISTANT-BACKEND':
                logger.warning('DISTANT storage not fully implemented, falling back to STANDALONE');
                return new DistantBackendStorage() as unknown as IStorage;

            case 'STANDALONE':
            default:
                return new StandaloneStorage() as unknown as IStorage;
        }
    }
}
