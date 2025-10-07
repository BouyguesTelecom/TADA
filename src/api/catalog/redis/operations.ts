import { FileProps, ICatalogResponse } from '../../props/catalog';
import { logger } from '../../utils/logs/winston';
import { filePathIsUnique, validateMultipleFile, validateOneFile } from '../validators';
import { cache } from './connection';

export const getOneFile = async (id: string) => {
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
            return { datum: file, error: '' };
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


export const getCatalogRedis = async () => {
    const catalog = await getAllFiles();
    return catalog || { data: null };
};
