import app from '../../app';
import { purgeData } from '../../middleware/validators/utils';
import { FileProps, ICatalogResponse, ICatalogResponseMulti } from '../../props/catalog';
import { getCurrentDateVersion } from '../../utils/catalog';
import { logger } from '../../utils/logs/winston';
import { addMultipleFiles, addOneFile, deleteOneFile, getAllFiles, getCatalog, getOneFile, updateOneFile } from './operations';

export const addFileInCatalog = async (item: FileProps): Promise<ICatalogResponse> => {
    try {
        const response: ICatalogResponse = await addOneFile(item);
        await purgeData('catalog');
        if (response.datum && (!response.error || response.error.length === 0)) {
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
    } catch (err: unknown) {
        logger.error(`Error adding file: ${err}`);
        return {
            status: 500,
            error: `Error adding file: ${err}`,
            datum: null
        };
    }
};

export const addFilesInCatalog = async (items: FileProps[]): Promise<ICatalogResponseMulti> => {
    try {
        const response = await addMultipleFiles(items);
        await purgeData('catalog');
        if (response.data && (!response.errors || response.errors.length === 0)) {
            return {
                status: 200,
                data: response.data,
                errors: null
            };
        }
        logger.error(`⛔️ Errors adding files: ${response.errors}`);
        return {
            status: 500,
            errors: response.errors || ['Unknown error'],
            data: null
        };
    } catch (err: unknown) {
        logger.error(`Error adding file: ${err}`);
        return {
            status: 500,
            errors: [`Error adding file: ${err}`],
            data: null
        };
    }
};

export const getFiles = async (): Promise<ICatalogResponseMulti> => {
    try {
        const response = await getAllFiles();
        if (response.data && (!response.errors || response.errors.length === 0)) {
            return { status: 200, data: response.data, errors: null };
        }
        return {
            status: 500,
            data: null, // tableau vide
            errors: response.errors
        };
    } catch (err: unknown) {
        logger.error(`Error getting files: ${err}`);
        return { status: 500, data: null, errors: [`Error getting files: ${err}`] };
    }
};

export const getFile = async (uuid): Promise<ICatalogResponse> => {
    try {
        const response = await getOneFile(uuid);
        if (response.datum && (!response.error || response.error.length === 0)) {
            return { status: 200, datum: response.datum, error: null };
        }
        return {
            status: 404,
            datum: null,
            error: `Unable to find file with id ${uuid} => ${response.error?.join(', ')}`
        };
    } catch (err: unknown) {
        logger.error(`Error getting file: ${err}`);
        return { status: 500, datum: null, error: `Error getting files: ${err}` };
    }
};

export const updateFileInCatalog = async (uuid: string, itemToUpdate: FileProps): Promise<ICatalogResponse> => {
    const updateItem = await updateOneFile(uuid, itemToUpdate);

    await purgeData('catalog');
    return { status: 200, datum: updateItem.datum, error: null };
};

export const deleteFileFromCatalog = async (uniqueName: string): Promise<ICatalogResponse> => {
    try {
        const catalog = await getCatalog();
        const itemFound = catalog.data.find((item) => item.unique_name === uniqueName);
        if (!itemFound) {
            return { status: 404, datum: null, error: `Item not found: ${uniqueName}` };
        }

        await deleteOneFile(itemFound.uuid);
        await purgeData('catalog');
        return { status: 200, datum: { ...itemFound, message: `Successfully deleted ${uniqueName}` }, error: null };
    } catch (err: unknown) {
        logger.error(`Error deleting file: ${err}`);
        return {
            status: 500,
            datum: null,
            error: `Error deleting file: ${(err as Error).message}`
        };
    }
};

export const deleteCatalog = async (): Promise<ICatalogResponseMulti> => {
    const response = await getAllFiles();
    if (response.data) {
        await purgeData('catalog');
        for (const item of response.data) {
            await deleteFileFromCatalog(item.unique_name);
        }
    }
    return { status: 200, data: [], errors: null };
};

export const createDump = async (): Promise<{ status: number; data: string[]; errors: string[] }> => {
    const { data: catalog } = await getCatalog();
    const fileVersion = getCurrentDateVersion();
    const filePath = `${app.locals.PREFIXED_CATALOG}/${fileVersion}.json`;
    if (!fileVersion) {
        return {
            status: 400,
            data: ['Error generating dump.json from Redis client'],
            errors: null
        };
    }
    if (fileVersion) {
        const postBackupFileJson = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${filePath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(catalog)
        });
        if (postBackupFileJson.status !== 200) {
            return {
                status: 400,
                data: null,
                errors: ['Failed to upload JSON  in backup']
            };
        }
        return {
            status: 200,
            data: ['DUMP backup successfully'],
            errors: null
        };
    }
    return {
        status: 200,
        data: ['Successfully generated dump.rdb from Redis client'],
        errors: null
    };
};
