import * as redis from './redis/utils';
import * as standalone from './standalone';
import { logger } from '../utils/logs/winston';
import { ICatalogResponse, ICatalogResponseMulti } from '../props/catalog';

export const getCatalog = async (): Promise<ICatalogResponseMulti> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Retrieve files from catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.getFiles();
        default:
            return await redis.getFiles();
    }
};

export const getCatalogItem = async ({ uuid }): Promise<ICatalogResponse> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Retrieve file from catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.getFile(uuid);
        default:
            return await redis.getFile(uuid);
    }
};

export const addCatalogItem = async (item): Promise<ICatalogResponse> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Add file in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.addFileInCatalog(item);
        default:
            return await redis.addFileInCatalog(item);
    }
};

export const addCatalogItems = async (items): Promise<ICatalogResponseMulti> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Add files in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.addFilesInCatalog(items);
        default:
            return await redis.addFilesInCatalog(items);
    }
};

export const updateCatalogItem = async (uuid, itemToUpdate): Promise<ICatalogResponse> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Update file in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.updateFileInCatalog(uuid, itemToUpdate);
        default:
            return await redis.updateFileInCatalog(uuid, itemToUpdate);
    }
};

export const deleteCatalogItem = async (uniqueName): Promise<ICatalogResponse> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Delete file in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.deleteFileFromCatalog(uniqueName);
        default:
            return await redis.deleteFileFromCatalog(uniqueName);
    }
};

export const deleteAllCatalog = async (): Promise<ICatalogResponseMulti> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Delete catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.deleteCatalog();
        default:
            return await redis.deleteCatalog();
    }
};

export const createDumpCatalog = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';
    logger.info(`Create dump catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.createDump();
        default:
            return await redis.createDump();
    }
};
