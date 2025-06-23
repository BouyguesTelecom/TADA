import crypto from 'crypto';
import app from '../../app';
import { FileProps, ICatalogResponse } from '../../props/catalog';
import { logger } from '../../utils/logs/winston';
import { filePathIsUnique, validateMultipleFile, validateOneFile } from '../validators';
import { redisClient } from './connection';
import { RedisJSON } from '@redis/json/dist/lib/commands';

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

export const getOneFile = async (param: string, key = 'uuid') => {
    try {
        if (key === 'uuid') {
            const file = await redisClient.json.get(`file:${ param }`);
            return {
                datum: file as FileProps || null,
                error: null
            };
        }
        const result: any = await redisClient.ft.search('idx:files', `@${ key }:"${ param }"`);
        return {
            datum: result?.documents.length && result?.documents[0]?.value as FileProps || null,
            error: null
        };
    } catch ( err ) {
        logger.error(`Error getting file: ${ err } WAZA`);
        return {
            datum: null,
            error: err
        };
    }
};

export const getAllFiles = async () => {
    try {
        // Effectuer une recherche avec RediSearch sans conditions pour récupérer tous les documents
        const result: any = await redisClient.ft.search('idx:files', '*', {
            LIMIT: { from: 0, size: 10000 } // Adaptable selon le nombre maximum d'attentes
        });

        const files = result.documents.map(doc => doc.value as FileProps);

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

export const addOneFile = async (file: any) => {
    try {
        // Valider le chemin unique etc.
        if (!( await filePathIsUnique(file) )) {
            return {
                datum: null,
                error: `${ file.filename } already exists in namespace ${ file.namespace }`
            };
        }
        const errorValidation = validateOneFile(file);
        if (!errorValidation) {
            await redisClient.json.set(`file:${ file.uuid }`, '$', file);
            const uploadedFile = await getOneFile(file.uuid, 'uuid');
            if (uploadedFile.datum) {
                return {
                    datum: uploadedFile.datum as FileProps,
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
            error: `File for catalog not valid: ${ JSON.stringify(errorValidation) }`
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
            errors: [ `Files for catalog not valid: ${ JSON.stringify(errorValidation) }` ]
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
        const existingFile: Object = await redisClient.json.get(`file:${ fileId }`);
        if (!existingFile) {
            return { error: `File with id ${ fileId } does not exist`, datum: null };
        }
        const updatedFile = { ...existingFile, ...updateData };
        await redisClient.json.set(`file:${ fileId }`, '$', updatedFile as RedisJSON);
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
        await redisClient.del(`file:${ id }`);
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