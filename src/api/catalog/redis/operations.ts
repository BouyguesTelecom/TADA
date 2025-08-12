import app from '../../app';
import { FileProps, ICatalogResponse } from '../../props/catalog';
import { logger } from '../../utils/logs/winston';
import { filePathIsUnique, validateMultipleFile, validateOneFile } from '../validators';
import { cache } from './connection';

const parseDateVersion = (name: string): Date => {
    const prefix = `${app.locals.PREFIXED_CATALOG}/`;
    const suffix = '.json';

    if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
        throw new Error('Filename format is incorrect');
    }

    const timestamp = name.slice(prefix.length, -suffix.length);

    const regex = /^\d{8}T\d{6}$/;
    if (!regex.test(timestamp)) {
        throw new Error('Timestamp format is incorrect');
    }

    const year = parseInt(timestamp.substring(0, 4));
    const month = parseInt(timestamp.substring(4, 6)) - 1;
    const day = parseInt(timestamp.substring(6, 8));
    const hours = parseInt(timestamp.substring(9, 11));
    const minutes = parseInt(timestamp.substring(11, 13));
    const seconds = parseInt(timestamp.substring(13, 15));

    return new Date(year, month, day, hours, minutes, seconds);
};

export const getOneFile = async (id: string, redis = false) => {
    try {
        const file = await cache.get(id);
        return { datum: file, error: null };
    } catch (err) {
        logger.error(`Error getting file: ${err}`);
        return { datum: null, error: err };
    }
};

export const getAllFiles = async () => {
    try {
        const files = await cache.getAll();
        return { data: files, errors: [] };
    } catch (err) {
        logger.error(`Error listing items: ${err}`);
        return { data: null, errors: [err] };
    }
};

export const addOneFile = async (file: FileProps) => {
    try {
        if (!(await filePathIsUnique(file))) {
            return {
                datum: null,
                error: `${file.filename} already exists in namespace ${file.namespace}`
            };
        }
        const errorValidation = validateOneFile(file);
        if (!errorValidation) {
            await cache.set(file);
            return { datum: { ...file, id: file.uuid }, error: '' };
        }
        return {
            datum: null,
            error: `File for catalog not valid : ${JSON.stringify(errorValidation)}`
        };
    } catch (err) {
        logger.error(`Error adding item: ${err}`);
        return { datum: null, error: err };
    }
};

export const addMultipleFiles = async (files: FileProps[]) => {
    try {
        const errorValidation = validateMultipleFile(files);
        if (!errorValidation) {
            const successfulUploadFiles: FileProps[] = [];
            const failedUploadFiles: string[] = [];
            for (let file of files) {
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
            errors: [`Files for catalog not valid : ${JSON.stringify(errorValidation)}`]
        };
    } catch (err) {
        logger.error(`Error adding items: ${err}`);
        return {
            data: null,
            errors: [err]
        };
    }
};

export const updateOneFile = async (fileId: string, updateData: Partial<FileProps>): Promise<ICatalogResponse> => {
    try {
        const existingFile = await cache.get(fileId);
        if (!existingFile) {
            return { error: `File with id ${fileId} does not exist`, datum: null };
        }

        const updatedFile = { ...existingFile, ...updateData };
        await cache.set(updatedFile);

        return { datum: updatedFile, error: null };
    } catch (err) {
        return { error: err.message, datum: null };
    }
};

export const deleteOneFile = async (id: string): Promise<{ datum?: string; error?: string }> => {
    try {
        await cache.delete(id);
        return { datum: `File with id ${id} successfully deleted` };
    } catch (err) {
        return { error: err.message };
    }
};

export const getLastVersion = (list) => {
    return list.reduce((acc, curr) => {
        const currDate = parseDateVersion(curr);
        const accDate = parseDateVersion(acc);
        return currDate > accDate ? curr : acc;
    });
};

export const getCatalogRedis = async () => {
    const catalog = await getAllFiles();
    return catalog || { data: null };
};
