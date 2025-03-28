import { ICatalogRepository } from '../../core/interfaces/Icatalog';
import { logger } from '../../utils/logs/winston';
import { RedisCatalogRepository } from './redis/redis.persistence';
import { StandaloneCatalogRepository } from './standalone/standalone.persistence';
export class PersistenceFactory {
    static createRepository(storageType: string = process.env.PERSISTENCE_METHOD || 'STANDALONE'): ICatalogRepository {
        try {
            logger.info(`Creating repository with method: ${storageType}`);

            switch (storageType.toUpperCase()) {
                case 'STANDALONE':
                    return new StandaloneCatalogRepository();
                case 'REDIS':
                    return new RedisCatalogRepository();
                default:
                    logger.warn(`Unknown repository type: ${storageType}, defaulting to STANDALONE`);
                    return new StandaloneCatalogRepository();
            }
        } catch (error) {
            logger.error(`Error creating repository: ${error}`);
            const errorRepo: ICatalogRepository = {
                find: async () => null,
                findAll: async () => [],
                save: async () => null,
                addMany: async () => ({ status: 500, data: null, error: 'Repository not initialized', errors: [] }),
                delete: async () => {},
                deleteAll: async () => ({ status: 500, data: null, error: 'Repository not initialized', errors: [] }),
                createDump: async () => ({ status: 500, data: [], errors: [] }),
                getByUuid: async () => ({ status: 500, data: null, error: 'Repository not initialized', datum: null, errors: null }),
                add: async () => ({ status: 500, data: null, error: 'Repository not initialized', datum: null, errors: null }),
                update: async () => ({ status: 500, data: null, error: 'Repository not initialized', datum: null, errors: null })
            };
            return errorRepo;
        }
    }
}
