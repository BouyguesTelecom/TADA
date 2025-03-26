import { IStorage } from '../../core/interfaces/Istorage';
import { logger } from '../../utils/logs/winston';
import { StorageAdapter } from './adapter/storage.adapter';
import { BaseStorage } from './baseStorage';

export class StorageFactory {
    static createStorage(storageType: string = process.env.DELEGATED_STORAGE_METHOD || 'STANDALONE'): IStorage {
        logger.info(`Creating storage with method: ${storageType}`);

        let baseStorage: BaseStorage;

        switch (storageType.toUpperCase()) {
            case 'S3':
                const { S3Storage } = require('./s3/s3.storage');
                baseStorage = new S3Storage();
                break;

            case 'DISTANT':
            case 'DISTANT-BACKEND':
            case 'DISTANT_BACKEND':
                const { DistantBackendStorage } = require('./distant-backend/distantBackend.storage');
                baseStorage = new DistantBackendStorage();
                logger.info('Using DISTANT_BACKEND storage');
                break;

            case 'STANDALONE':
            default:
                const { StandaloneStorage } = require('./standalone/standalone.storage');
                baseStorage = new StandaloneStorage();
                logger.info('Using STANDALONE storage');
                break;
        }

        return new StorageAdapter(baseStorage);
    }
}
