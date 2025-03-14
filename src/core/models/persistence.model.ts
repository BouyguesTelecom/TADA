import { ICatalogRepository } from '../interfaces/Icatalog';

export class PersistenceFactory {
    static create(persistenceType: string = process.env.DELEGATED_STORAGE_METHOD || 'STANDALONE'): ICatalogRepository {
        switch (persistenceType.toUpperCase()) {
            case 'REDIS':
                const { RedisCatalogRepository } = require('../../infrastructure/persistence/redis/RedisCatalogRepository');
                return new RedisCatalogRepository();

            case 'STANDALONE':
            default:
                const { StandaloneCatalogRepository } = require('../../infrastructure/persistence/standalone/StandaloneCatalogRepository');
                return new StandaloneCatalogRepository();
        }
    }
}
