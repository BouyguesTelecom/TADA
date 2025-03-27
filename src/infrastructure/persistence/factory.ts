import { ICatalogRepository } from '../../core/interfaces/Icatalog';
import { logger } from '../../utils/logs/winston';
import { StandaloneCatalogRepository } from './standalone/standalone.persistence';

export class PersistenceFactory {
    static createRepository(storageType: string = process.env.PERSISTENCE_METHOD || 'STANDALONE'): ICatalogRepository {
        try {
            logger.info(`Creating repository with method: ${storageType}`);

            switch (storageType.toUpperCase()) {
                case 'STANDALONE':
                    return new StandaloneCatalogRepository();
                default:
                    logger.warn(`Unknown repository type: ${storageType}, defaulting to STANDALONE`);
                    return new StandaloneCatalogRepository();
            }
        } catch (error) {
            logger.error(`Error creating repository: ${error}`);
            const errorRepo: ICatalogRepository = {
                getAll: async () => ({ status: 500, data: null, errors: ['Repository not initialized'] }),
                getByUuid: async () => ({ status: 500, datum: null, error: 'Repository not initialized' }),
                add: async () => ({ status: 500, datum: null, error: 'Repository not initialized' }),
                addMany: async () => ({ status: 500, data: null, errors: ['Repository not initialized'] }),
                update: async () => ({ status: 500, datum: null, error: 'Repository not initialized' }),
                delete: async () => ({ status: 500, datum: null, error: 'Repository not initialized' }),
                deleteAll: async () => ({ status: 500, data: null, errors: ['Repository not initialized'] }),
                createDump: async () => ({ status: 500, data: null, errors: ['Repository not initialized'] })
            };
            return errorRepo;
        }
    }
}
