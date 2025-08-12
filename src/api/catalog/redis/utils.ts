import { purgeData } from '../../middleware/validators/utils';
import { FileProps, ICatalogResponse, ICatalogResponseMulti } from '../../props/catalog';
import { logger } from '../../utils/logs/winston';
import { addMultipleFiles, addOneFile, deleteOneFile, getAllFiles, getOneFile, updateOneFile } from './operations';

export const addFileInCatalog = async (item: FileProps): Promise<ICatalogResponse> => {
    try {
        const response: ICatalogResponse = await addOneFile(item);
        if (response.datum && (!response.error || response.error.length === 0)) {
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
        if (response.data && (!response.errors || response.errors.length === 0)) {
            await purgeData('catalog');
            return {
                status: 200,
                data: response.data,
                errors: []
            };
        }
        logger.error(`⛔️ Errors adding files: ${response.errors}`);
        return {
            status: 500,
            errors: response.errors || ['Unknown error'],
            data: []
        };
    } catch (err: unknown) {
        logger.error(`Error adding file: ${err}`);
        return {
            status: 500,
            errors: [`Error adding file: ${err}`],
            data: []
        };
    }
};

export const getFiles = async (): Promise<ICatalogResponseMulti> => {
    try {
        const response = await getAllFiles();
        if (response.data && (!response.errors || response.errors.length === 0)) {
            return { status: 200, data: response.data, errors: [] };
        }
        return {
            status: 500,
            data: null,
            errors: response.errors
        };
    } catch (err: unknown) {
        logger.error(`Error getting files: ${err}`);
        return { status: 500, data: null, errors: [`Error getting files: ${err}`] };
    }
};

export const getFile = async (uuid): Promise<ICatalogResponse> => {
    try {
        const response = await getOneFile(uuid, true);
        if (response.datum && (!response.error || response.error.length === 0)) {
            return { status: 200, datum: response.datum, error: null };
        }
        return {
            status: 404,
            datum: null,
            error: `Unable to find file with id ${uuid} => ${response.error}`
        };
    } catch (err: unknown) {
        logger.error(`Error getting file: ${err}`);
        return { status: 500, datum: null, error: `Error getting files: ${err}` };
    }
};

export const updateFileInCatalog = async (uuid: string, itemToUpdate: FileProps): Promise<ICatalogResponse> => {
    try {
        const updatedItemToUpdate = {
            ...itemToUpdate,
            updated_date: new Date().toISOString()
        };
        logger.info(uuid, updatedItemToUpdate);
        const updateItem = await updateOneFile(uuid, updatedItemToUpdate);
        if (updateItem.datum && !updateItem.error) {
            await purgeData('catalog');
            return { status: 200, datum: updateItem.datum, error: null };
        }
        logger.error(`⛔️ Errors adding files: ${updateItem.error}`);
        return {
            status: 500,
            error: updateItem.error || 'Unknown error',
            datum: null
        };
    } catch (err: unknown) {
        logger.error(`Error updating file: ${err}`);
        return {
            status: 500,
            error: `Error updating file: ${err}`,
            datum: null
        };
    }
};

export const deleteFileFromCatalog = async (uuid: string): Promise<ICatalogResponse> => {
    try {
        const { datum: file, error } = await getOneFile(uuid, true);

        if (!file || error) {
            return {
                status: 404,
                datum: null,
                error: `File with UUID ${uuid} not found`
            };
        }
        await deleteOneFile(file.uuid);
        await purgeData('catalog');
        return { status: 200, datum: { ...file, message: `Successfully deleted ${uuid}` }, error: null };
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
    const { data: files } = await getAllFiles();

    if (files && files.length > 0) {
        for (const item of files) {
            await deleteFileFromCatalog(item.uuid);
        }
        await purgeData('catalog');
    }

    return { status: 200, data: [], errors: [] };
};
