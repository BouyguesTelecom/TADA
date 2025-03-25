import { ICatalogRepository } from '../../core/interfaces/Icatalog';
import { logger } from '../../utils/logs/winston';
import { RedisCatalogRepository } from './redis/redis.persistence';
import { StandaloneCatalogRepository } from './standalone/standalone.persistence';

export class PersistenceFactory {
    public static createRepository(): ICatalogRepository {
        const storageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
        logger.info(`Creating catalog repository with storage method: ${storageMethod}`);

        switch (storageMethod) {
            case 'STANDALONE':
                return new StandaloneCatalogRepository();
            case 'REDIS':
                return new RedisCatalogRepository();
            default:
                logger.warning(`Unknown storage method ${storageMethod}, falling back to STANDALONE`);
                return new StandaloneCatalogRepository();
        }
    }
}
