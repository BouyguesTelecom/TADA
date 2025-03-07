import app from '../../app';
import { logger } from '../../utils/logs/winston';
import { addMultipleFiles, addOneFile, deleteOneFile, getAllFiles, getCatalog, getOneFile, updateOneFile } from './operations';
import { FileProps, ICatalogResponse, ICatalogResponseMulti } from '../../props/catalog';
import { purgeData } from '../../middleware/validators/utils';
import { getCurrentDateVersion } from '../../utils/catalog';

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
    try {
        const { data: catalog } = await getCatalog();
        if (!catalog || catalog.length === 0) {
            return {
                status: 400,
                data: null,
                errors: ['No catalog data to dump']
            };
        }

        const fileVersion = getCurrentDateVersion();
        const fileName = `${fileVersion}.json`;
        const destination = 'catalog';
        const namespace = 'DEV';
        const uniqueName = `/${namespace}/${destination}/${fileName}`;

        const catalogJson = JSON.stringify(catalog, null, 2);

        const formData = new FormData();

        const metadata = {
            unique_name: uniqueName,
            base_url: process.env.NGINX_INGRESS || 'http://localhost:8080',
            destination: destination,
            filename: fileName,
            mimetype: 'application/json',
            size: new Blob([catalogJson]).size,
            namespace: namespace,
            version: 1
        };

        formData.append('metadata', JSON.stringify([metadata]));

        const blob = new Blob([catalogJson], { type: 'application/json' });
        formData.append('file', blob, fileName);

        console.log(`Creating dump file: ${uniqueName}`);
        console.log('Metadata:', metadata);

        const postBackupFileJson = await fetch(`${process.env.DELEGATED_STORAGE_HOST}/dump`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN || ''}`
            },
            body: formData
        });

        if (postBackupFileJson.status !== 200) {
            let errorDetails = 'Failed to upload catalog dump';

            try {
                const errorResponse = await postBackupFileJson.json();
                errorDetails = errorResponse.error || (errorResponse.details ? JSON.stringify(errorResponse.details) : null) || errorDetails;
                console.error('Error details from backup service:', errorResponse);
            } catch (parseError) {
                console.error('Error parsing error response:', parseError);
            }

            return {
                status: postBackupFileJson.status,
                data: null,
                errors: [errorDetails]
            };
        }

        const responseData = await postBackupFileJson.json().catch(() => ({}));

        if (responseData.error || (responseData.result && responseData.result.status !== 200)) {
            const errorMsg = responseData.error || (responseData.result && responseData.result.error) || 'Pipeline failed for catalog dump';

            return {
                status: 400,
                data: null,
                errors: [errorMsg]
            };
        }

        return {
            status: 200,
            data: [`Catalog dump created successfully: ${uniqueName}`],
            errors: null
        };
    } catch (error) {
        console.error('Error creating catalog dump:', error);
        return {
            status: 500,
            data: null,
            errors: [`Error creating catalog dump: ${error.message}`]
        };
    }
};
