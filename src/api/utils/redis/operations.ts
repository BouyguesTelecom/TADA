import { FileProps } from './types';
import { v4 as uuidv4 } from 'uuid';
import { filePathIsUnique, validateMultipleFile, validateOneFile } from './validators';
import { logger } from '../logs/winston';
import { connectClient, disconnectClient } from './connection';
import { redisClient } from './connection';
import app from '../../app';
const parseDateVersion = (name: string): Date => {
    const prefix = `${app.locals.PREFIXED_CATALOG}/`;
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

export const getOneFile = async (id: string) => {
    try {
        const file = await redisClient.get(id);
        return {
            data: file ? JSON.parse(file) : null,
            errors: null
        };
    } catch (err) {
        logger.error(`Error getting file: ${err}`);
        return {
            data: null,
            errors: err
        };
    }
};

export const getAllFiles = async () => {
    try {
        const ids = await redisClient.keys('*');
        const files = [];

        if (ids && ids.length) {
            for (let id of ids) {
                const file = await redisClient.get(id);
                if (file) {
                    files.push(JSON.parse(file));
                }
            }
        }
        return {
            data: files,
            errors: null
        };
    } catch (err) {
        logger.error(`Error listing items: ${err}`);
        return {
            data: null,
            errors: err
        };
    }
};

export const addOneFile = async (file: FileProps) => {
    try {
        if (!(await filePathIsUnique(file))) {
            return {
                data: null,
                errors: `${file.filename} already exists in namespace ${file.namespace}`
            };
        }
        const errorValidation = validateOneFile(file);
        if (!errorValidation) {
            const uuid = uuidv4();
            await redisClient.set(uuid, JSON.stringify({ ...file, uuid }));
            const uploadedFile = await getOneFile(uuid);
            if (uploadedFile.data) {
                return {
                    data: uploadedFile.data,
                    errors: ''
                };
            }
            return {
                data: null,
                errors: [`Unable to retrieve file with id ${uuid} after adding it...`]
            };
        }
        return {
            data: null,
            errors: [`File for catalog not valid : ${JSON.stringify(errorValidation)}`]
        };
    } catch (err) {
        logger.error(`Error adding item: ${err}`);
        return {
            data: null,
            errors: err
        };
    }
};

export const addMultipleFiles = async (files: FileProps[]) => {
    try {
        const errorValidation = validateMultipleFile(files);
        if (!errorValidation) {
            await connectClient();
            const successfulUploadFiles: FileProps[] = [];
            const failedUploadFiles: string[] = [];
            for (let file of files) {
                const response = await addOneFile(file);
                if (response.data && !response.errors) {
                    successfulUploadFiles.push(response.data);
                } else {
                    failedUploadFiles.push(response.errors);
                }
            }
            await disconnectClient();
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
            errors: err
        };
    }
};

export const updateOneFile = async (fileId: string, updateData: Partial<FileProps>): Promise<{ data?: FileProps; errors?: string[] }> => {
    try {
        const existingFile = await redisClient.get(fileId);
        if (!existingFile) {
            return { errors: [`File with id ${fileId} does not exist`] };
        }

        const parsedExistingFile = JSON.parse(existingFile);

        const updatedFile = { ...parsedExistingFile, ...updateData };

        await redisClient.set(fileId, JSON.stringify(updatedFile));

        return { data: updatedFile };
    } catch (err) {
        return { errors: [err.message] };
    }
};

export const deleteOneFile = async (namespace: string, identifier: string): Promise<{ status?: number; errors?: string[] }> => {
    try {
        const catalog = await getCatalog();

        let existingFileKey = null;

        const item = catalog.data.find((entry) => {
            if ((entry.uuid === identifier || entry.filename === identifier) && entry.namespace === namespace) {
                existingFileKey = entry.uuid;
                return true;
            }
            return false;
        });

        if (!item) {
            return {
                status: 404,
                errors: [`File with id or name ${identifier} does not exist in namespace ${namespace}`]
            };
        }

        await redisClient.del(existingFileKey);
        return { status: 200 };
    } catch (err) {
        return { status: 500, errors: [err.message] };
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
    await connectClient();
    const catalog = await getAllFiles();
    await disconnectClient();
    return catalog || { data: null };
};
