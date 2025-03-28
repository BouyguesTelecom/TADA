import { IStorage } from '../../core/interfaces/Istorage';
import { logger } from '../../utils/logs/winston';
import { BaseStorage } from './baseStorage';

export class StorageFactory {
    static createStorage(storageType: string = process.env.DELEGATED_STORAGE_METHOD || 'STANDALONE'): IStorage {
        try {
            logger.info(`Creating storage with method: ${storageType}`);
            let storage: BaseStorage;

            switch (storageType.toUpperCase()) {
                case 'S3':
                    const { S3Storage } = require('./s3/s3.storage');
                    storage = new S3Storage();
                    break;

                case 'DISTANT':
                case 'DISTANT-BACKEND':
                case 'DISTANT_BACKEND':
                    const { DistantBackendStorage } = require('./distant-backend/distantBackend.storage');
                    storage = new DistantBackendStorage();
                    logger.info('Using DISTANT_BACKEND storage');
                    break;

                case 'STANDALONE':
                default:
                    const { StandaloneStorage } = require('./standalone/standalone.storage');
                    storage = new StandaloneStorage();
                    logger.info('Using STANDALONE storage');
                    break;
            }

            return storage as IStorage;
        } catch (error) {
            logger.error(`Error creating storage: ${error}`);
            throw new Error(`Failed to initialize storage: ${error}`);
        }
    }
}
