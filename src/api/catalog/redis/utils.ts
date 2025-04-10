import app from '../../app';
import { logger } from '../../utils/logs/winston';
import { addMultipleFiles, addOneFile, deleteMultipleFiles, deleteOneFile, getAllFiles, getCatalog, getOneFile, updateMultipleFiles, updateOneFile } from './operations';
import { FileProps, ICatalogResponse, ICatalogResponseMulti } from '../../props/catalog';
import { purgeData } from '../../middleware/validators/utils';
import { getCurrentDateVersion } from '../../utils/catalog';
import { getCachedCatalog, updateCacheCatalog } from './connection';

export const addFileInCatalog = async (item: FileProps): Promise<ICatalogResponse> => {
    try {
        const response: ICatalogResponse = await addOneFile(item);
        if (response.datum && ( !response.error || response.error.length === 0 )) {
            await updateCacheCatalog();
            await purgeData('catalog');
            return {
                status: 200,
                datum: response.datum,
                error: null
            };
        }
        return {
            status: 500,
            error: response.error || 'Unknown error',
            datum: null
        };
    } catch ( err: unknown ) {
        logger.error(`Error adding file: ${ err }`);
        return {
            status: 500,
            error: `Error adding file: ${ err }`,
            datum: null
        };
    }
};

export const addFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    try {
        const response = await addMultipleFiles(items);
        if (response.data && ( !response.errors || response.errors.length === 0 )) {
            await updateCacheCatalog();
            await purgeData('catalog');
            return {
                status: 200,
                data: response.data,
                errors: []
            };
        }
        logger.error(`⛔️ Errors adding files: ${ response.errors }`);
        return {
            status: 500,
            errors: response.errors || [ 'Unknown error' ],
            data: []
        };
    } catch ( err: unknown ) {
        logger.error(`Error adding file: ${ err }`);
        return {
            status: 500,
            errors: [ `Error adding file: ${ err }` ],
            data: []
        };
    }
};

export const getFiles = async (): Promise<ICatalogResponseMulti> => {
    try {
        const response = await getAllFiles();
        if (response.data && ( !response.errors || response.errors.length === 0 )) {
            return { status: 200, data: response.data, errors: null };
        }
        return {
            status: 500,
            data: null,
            errors: response.errors
        };
    } catch ( err: unknown ) {
        logger.error(`Error getting files: ${ err }`);
        return { status: 500, data: null, errors: [ `Error getting files: ${ err }` ] };
    }
};

export const getFile = async (uuid): Promise<ICatalogResponse> => {
    try {
        const response = await getOneFile(uuid);
        if (response.datum && ( !response.error || response.error.length === 0 )) {
            return { status: 200, datum: response.datum, error: null };
        }
        return {
            status: 404,
            datum: null,
            error: `Unable to find file with id ${ uuid } => ${ response.error }`
        };
    } catch ( err: unknown ) {
        logger.error(`Error getting file: ${ err }`);
        return { status: 500, datum: null, error: `Error getting files: ${ err }` };
    }
};

export const updateFileInCatalog = async (uuid: string, itemToUpdate: FileProps): Promise<ICatalogResponse> => {
    try {
        const updateItem = await updateOneFile(uuid, itemToUpdate);
        if (updateItem.datum && !updateItem.error) {
            await updateCacheCatalog();
            await purgeData('catalog');
            return { status: 200, datum: updateItem.datum, error: null };
        }
        logger.error(`⛔️ Errors adding files: ${ updateItem.error }`);
        return {
            status: 500,
            error: updateItem.error || 'Unknown error',
            datum: null
        };
    } catch ( err: unknown ) {
        logger.error(`Error updating file: ${ err }`);
        return {
            status: 500,
            error: `Error updating file: ${ err }`,
            datum: null
        };
    }
};

export const updateFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    try {
        const response = await updateMultipleFiles(items);
        if (response.data && ( !response.errors || response.errors.length === 0 )) {
            await updateCacheCatalog();
            await purgeData('catalog');
            return {
                status: 200,
                data: response.data,
                errors: []
            };
        }
        logger.error(`⛔️ Errors updating files: ${ response.errors }`);
        return {
            status: 500,
            errors: response.errors || [ 'Unknown error' ],
            data: []
        };
    } catch ( err: unknown ) {
        logger.error(`Error updating files: ${ err }`);
        return {
            status: 500,
            errors: [ `Error updating files: ${ err }` ],
            data: []
        };
    }
};

export const deleteFileFromCatalog = async (uuid: string): Promise<ICatalogResponse> => {
    try {
        const file = await getCachedCatalog(uuid)
        await deleteOneFile(file.uuid);
        await updateCacheCatalog();
        await purgeData('catalog');
        return { status: 200, datum: { ...file, message: `Successfully deleted ${ uuid }` }, error: null };
    } catch ( err: unknown ) {
        logger.error(`Error deleting file: ${ err }`);
        return {
            status: 500,
            datum: null,
            error: `Error deleting file: ${ ( err as Error ).message }`
        };
    }
};

export const deleteFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    try {
        const response = await deleteMultipleFiles(items);
        if (response.data && ( !response.errors || response.errors.length === 0 )) {
            await updateCacheCatalog();
            await purgeData('catalog');
            return {
                status: 200,
                data: response.data,
                errors: []
            };
        }
        logger.error(`⛔️ Errors deleting files: ${ response.errors }`);
        return {
            status: 500,
            errors: response.errors || [ 'Unknown error' ],
            data: []
        };
    } catch ( err: unknown ) {
        logger.error(`Error deleting files: ${ err }`);
        return {
            status: 500,
            errors: [ `Error deleting files: ${ err }` ],
            data: []
        };
    }
};


export const deleteCatalog = async (): Promise<ICatalogResponseMulti> => {
    const response = await getCachedCatalog();
    if (response) {
        for ( const item of Object.values(response) as any ) {
            await deleteFileFromCatalog(item.uuid);
        }
        await updateCacheCatalog();
        await purgeData('catalog');
    }
    return { status: 200, data: [], errors: null };
};

export const createDump = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    const { data: catalog } = await getCatalog();
    const fileVersion = getCurrentDateVersion();
    const filePath = `${ app.locals.PREFIXED_CATALOG }/${ fileVersion }.json`;
    if (!fileVersion) {
        return {
            status: 400,
            data: [ 'Error generating dump.json from Redis client' ],
            errors: null
        };
    }
    if (fileVersion) {
        const postBackupFileJson = await fetch(`${ app.locals.PREFIXED_API_URL }/delegated-storage?filepath=${ filePath }`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(catalog)
        });
        if (postBackupFileJson.status !== 200) {
            return {
                status: 400,
                data: null,
                errors: [ 'Failed to upload JSON  in backup' ]
            };
        }
        return {
            status: 200,
            data: [ 'DUMP backup successfully' ],
            errors: null
        };
    }
    return {
        status: 200,
        data: [ 'Successfully generated dump.rdb from Redis client' ],
        errors: null
    };
};
