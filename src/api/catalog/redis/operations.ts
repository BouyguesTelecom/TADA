import { FileProps, ICatalogResponse } from '../../props/catalog';
import { filePathIsUnique, validateMultipleFile, validateOneFile } from '../validators';
import { logger } from '../../utils/logs/winston';
import { getCachedCatalog, redisHandler } from './connection';
import app from '../../app';
import crypto from 'crypto';

const parseDateVersion = (name: string): Date => {
    const prefix = `${ app.locals.PREFIXED_CATALOG }/`;
    const suffix = '.json';

    if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
        throw new Error('Le format du nom de fichier est incorrect.');
    }

    const timestamp = name.slice(prefix.length, -suffix.length);

    const regex = /^\d{8}T\d{6}$/;
    if (!regex.test(timestamp)) {
        throw new Error('Le format du timestamp est incorrect.');
    }

    const year = parseInt(timestamp.substring(0, 4));
    const month = parseInt(timestamp.substring(4, 6)) - 1; // Les mois commencent à 0
    const day = parseInt(timestamp.substring(6, 8));
    const hours = parseInt(timestamp.substring(9, 11));
    const minutes = parseInt(timestamp.substring(11, 13));
    const seconds = parseInt(timestamp.substring(13, 15));

    return new Date(year, month, day, hours, minutes, seconds);
};

export const getOneFile = async (id: string, redis = false) => {
    try {
        if (redis) {
            const file = await redisHandler.getAsync(id);
            return {
                datum: file ? JSON.parse(file) : null,
                error: null
            };
        }
        const catalogItem = await getCachedCatalog(id);
        return {
            datum: catalogItem ? catalogItem : null,
            error: null
        };
    } catch ( err ) {
        logger.error(`Error getting file: ${ err }`);
        return {
            datum: null,
            error: err
        };
    }
};

export const getAllFiles = async () => {
    try {
        const ids = await redisHandler.keysAsync('*');
        const files = [];

        if (ids && ids.length) {
            for ( let id of ids ) {
                const file = await redisHandler.getAsync(id);
                if (file && Object.keys(JSON.parse(file)).length) {
                    files.push(JSON.parse(file));
                }
            }
        }
        return {
            data: files,
            errors: null
        };
    } catch ( err ) {
        logger.error(`Error listing items: ${ err }`);
        return {
            data: null,
            errors: [ err ]
        };
    }
};

export const addOneFile = async (file: FileProps) => {
    try {
        if (!( await filePathIsUnique(file) )) {
            return {
                datum: null,
                error: `${ file.filename } already exists in namespace ${ file.namespace }`
            };
        }
        const errorValidation = validateOneFile(file);
        if (!errorValidation) {
            await redisHandler.setAsync(file.uuid, JSON.stringify({ ...file }));
            const uploadedFile = await getOneFile(file.uuid, true);
            if (uploadedFile.datum) {
                return {
                    datum: uploadedFile.datum,
                    error: ''
                };
            }
            return {
                datum: null,
                error: `Unable to retrieve file with id ${ file.uuid } after adding it...`
            };
        }
        return {
            datum: null,
            error: `File for catalog not valid : ${ JSON.stringify(errorValidation) }`
        };
    } catch ( err ) {
        logger.error(`Error adding item: ${ err }`);
        return {
            datum: null,
            error: err
        };
    }
};

export const addMultipleFiles = async (files: FileProps[]) => {
    try {
        const errorValidation = validateMultipleFile(files);
        if (!errorValidation) {
            const successfulUploadFiles: FileProps[] = [];
            const failedUploadFiles: string[] = [];
            for ( let file of files ) {
                const response = await addOneFile(file);
                if (response.datum && !response.error) {
                    successfulUploadFiles.push(response.datum);
                } else {
                    failedUploadFiles.push(response.error);
                }
            }
            return {
                data: successfulUploadFiles,
                errors: failedUploadFiles.length ? failedUploadFiles : null
            };
        }
        return {
            data: null,
            errors: [ `Files for catalog not valid : ${ JSON.stringify(errorValidation) }` ]
        };
    } catch ( err ) {
        logger.error(`Error adding items: ${ err }`);
        return {
            data: null,
            errors: [ err ]
        };
    }
};

export const updateOneFile = async (fileId: string, updateData: Partial<FileProps>): Promise<ICatalogResponse> => {
    try {
        const fileCatalog = await getCachedCatalog(fileId);
        const redisKeyMD5 = crypto.createHash('md5').update(fileCatalog.unique_name).digest('hex');
        const existingFile = await redisHandler.getAsync(redisKeyMD5);
        if (!existingFile) {
            return { error: `File with id ${ fileId } does not exist`, datum: null };
        }

        const parsedExistingFile = JSON.parse(existingFile);

        const updatedFile = { ...parsedExistingFile, ...updateData };
        await redisHandler.setAsync(fileId, JSON.stringify(updatedFile));

        return { datum: updatedFile, error: null };
    } catch ( err ) {
        return { error: err.message, datum: null };
    }
};

export const updateMultipleFiles = async (files: FileProps[]) => {
    try {
        const successfulUpdateFiles: FileProps[] = [];
        const failedUpdateFiles: string[] = [];

        for ( let file of files ) {
            const response = await updateOneFile(file.uuid, file);
            if (response.datum && !response.error) {
                successfulUpdateFiles.push(response.datum);
            } else {
                failedUpdateFiles.push(response.error);
            }
        }

        return {
            data: successfulUpdateFiles,
            errors: failedUpdateFiles.length ? failedUpdateFiles : null
        };
    } catch ( err ) {
        logger.error(`Error updating items: ${ err }`);
        return {
            data: null,
            errors: [ err ]
        };
    }
};


export const deleteOneFile = async (id: string): Promise<{ datum?: string; error?: string }> => {
    try {
        await redisHandler.delAsync(id);
        return { datum: `File with id ${ id } successfully deleted` };
    } catch ( err ) {
        return { error: err.message };
    }
};

export const deleteMultipleFiles = async (files: FileProps[]) => {
    try {
        const successfulDeleteFiles: FileProps[] = [];
        const failedDeleteFiles: string[] = [];

        for ( const file of files ) {
            const { datum, error } = await deleteOneFile(file.uuid);
            if (datum && !error) {
                successfulDeleteFiles.push(file);
            } else {
                failedDeleteFiles.push(`Failed to delete file ${ file.uuid }`);
            }
        }
        return {
            data: successfulDeleteFiles,
            errors: failedDeleteFiles.length ? failedDeleteFiles : null
        };
    } catch ( err ) {
        logger.error(`Error deleting items: ${ err }`);
        return {
            data: null,
            errors: [ err ]
        };
    }
};

export const getLastVersion = (list) => {
    return list.reduce((acc, curr) => {
        const currDate = parseDateVersion(curr);
        const accDate = parseDateVersion(acc);
        return currDate > accDate ? curr : acc;
    });
};

export const getCatalog = async () => {
    const catalog = await getAllFiles();
    return catalog || { data: null };
};
