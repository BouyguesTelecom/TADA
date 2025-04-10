import * as redis from './redis/utils';
import * as standalone from './standalone';
import { logger } from '../utils/logs/winston';
import { ICatalogResponse, ICatalogResponseMulti } from '../props/catalog';

const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';

export const getCatalog = async (): Promise<ICatalogResponseMulti> => {
    logger.info(`Retrieve files from catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.getFiles();
        default:
            return await redis.getFiles();
    }
};

export const getCatalogItem = async ({ uuid }): Promise<ICatalogResponse> => {
    logger.info(`Retrieve file from catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.getFile(uuid);
        default:
            return await redis.getFile(uuid);
    }
};

export const addCatalogItem = async (item): Promise<ICatalogResponse> => {
    logger.info(`Add file in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.addFileInCatalog(item);
        default:
            return await redis.addFileInCatalog(item);
    }
};

export const addCatalogItems = async (items): Promise<ICatalogResponseMulti> => {
    logger.info(`Add files in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.addFilesInCatalog(items);
        default:
            return await redis.addFilesInCatalog(items);
    }
};

export const updateCatalogItem = async (uuid, itemToUpdate): Promise<ICatalogResponse> => {
    logger.info(`Update file in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.updateFileInCatalog(uuid, itemToUpdate);
        default:
            return await redis.updateFileInCatalog(uuid, itemToUpdate);
    }
};

export const updateCatalogItems = async (items): Promise<ICatalogResponseMulti> => {
    logger.info(`Update files in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.updateFilesInCatalog(items);
        default:
            return await redis.updateFilesInCatalog(items);
    }
};

export const deleteCatalogItem = async (uuid): Promise<ICatalogResponse> => {
    logger.info(`Delete file in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.deleteFileFromCatalog(uuid);
        default:
            return await redis.deleteFileFromCatalog(uuid);
    }
};

export const deleteCatalogItems = async (items): Promise<ICatalogResponseMulti> => {
    logger.info(`Update files in catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.deleteFilesInCatalog(items);
        default:
            return await redis.deleteFilesInCatalog(items);
    }
};


export const deleteAllCatalog = async (): Promise<ICatalogResponseMulti> => {
    logger.info(`Delete catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.deleteCatalog();
        default:
            return await redis.deleteCatalog();
    }
};

export const createDumpCatalog = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    logger.info(`Create dump catalog ${backupStorageMethod === 'STANDALONE' ? 'catalog.json' : 'REDIS'} ...`);
    switch (backupStorageMethod) {
        case 'STANDALONE':
            return await standalone.createDump();
        default:
            return await redis.createDump();
    }
};
