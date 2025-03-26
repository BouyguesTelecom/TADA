import { logger } from '../../utils/logs/winston';
import { IStorage } from '../interfaces/Istorage';

export class StorageFactory {
    static create(storageType: string = process.env.DELEGATED_STORAGE_METHOD || 'STANDALONE'): IStorage {
        const { StorageFactory } = require('../../infrastructure/storage/factory');
        logger.info(`StorageFactory.create called with type: ${storageType}`);
        return StorageFactory.createStorage(storageType);
    }
}
