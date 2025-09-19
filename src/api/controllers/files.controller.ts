import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { logger } from '../utils/logs/winston';
import { deleteFilesBackup, patchFilesBackup,  postFilesBackup } from './delegated-storage.controller';
import {  generateStream } from '../utils/file';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { addCatalogItem, deleteCatalogItem, getCatalogItem, updateCatalogItem } from '../catalog';

export const postAssets = async (_req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const files = [];
    for (const file of validFiles) {
        const stream = await generateStream(file, file.toWebp);
        if (!stream) files.push({ ...file, message: 'Failed to generate stream' });

        const signature = calculateSHA256(stream);
        const newItem = await formatItemForCatalog(file.fileInfo, file.filename, file.fileInfo.namespace, file.uniqueName, file.mimetype, file.toWebp, signature, file.size);
        const { status, error, datum } = await addCatalogItem(newItem);

        if (status !== 200 || !datum) files.push({ ...file, message: `Failed to create catalog item: ${error}` });

        files.push({ ...file, catalogItem: newItem, stream, success: true });
    }

    const successFiles = files.filter((file) => file.success);
    const errorFiles = files.filter((file) => !file.success);
    try {
        const responseBackup: any = await postFilesBackup(successFiles);
        const items = await Promise.all(successFiles.map(async (file) => (await getCatalogItem({ uuid: file.catalogItem.uuid })).datum));
        return sendResponse({
            res,
            status: responseBackup.status,
            data: items,
            errors: [...errorFiles, ...invalidFiles],
            purge: 'catalog'
        });
    } catch (error) {
        logger.error('POST assets error:', error);
        const errorMessage = error instanceof Error ? `Process error: ${error.message}` : 'Unexpected error occurred';

        return sendResponse({
            res,
            status: 500,
            data: null,
            errors: [errorMessage],
            purge: 'catalog'
        });
    }
};

export const patchAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    console.log(validFiles, invalidFiles, 'WAZAAA PATCH');
    const files = [];
    for (const file of validFiles) {
        const stream = await generateStream(file, file.toWebp);
        if (!stream) files.push({ ...file, message: 'Failed to generate stream' });

        const signature = calculateSHA256(stream);
        const { status, error, datum } = await updateCatalogItem(file.catalogItem.uuid, {
            ...file.catalogItem,
            ...file.fileInfo,
            version: file ? file.catalogItem.version + 1 : file.catalogItem.version,
            ...(signature && { signature }),
            ...(file && { size: file.size })
        });
        console.log(status, error, datum, ' PATCH CATALOG ITEM');

        if (status !== 200 || !datum) files.push({ ...file, message: `Failed to create catalog item: ${error}` });

        files.push({ catalogItem: datum, fileInfo: file.fileInfo, stream, success: true });
    }

    const successFiles = files.filter((file) => file.success);
    const errorFiles = files.filter((file) => !file.success);
    console.log('SUCCESS FILES::::', successFiles);
    try {
        const responseBackup: any = await patchFilesBackup(successFiles);
        console.log(responseBackup, 'RESPONSE BACKUP ICI ???');
        return sendResponse({
            res,
            status: responseBackup.status,
            data: successFiles.map((file) => file.catalogItem),
            errors: [...errorFiles, ...invalidFiles],
            purge: 'catalog'
        });
    } catch (error) {
        logger.error('POST assets error:', error);
        const errorMessage = error instanceof Error ? `Process error: ${error.message}` : 'Unexpected error occurred';

        return sendResponse({
            res,
            status: 500,
            data: null,
            errors: [errorMessage],
            purge: 'catalog'
        });
    }
};

export const deleteAssets = async (_req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;

    try {
        console.log(validFiles, invalidFiles, 'WAZAAA DELETE');
        const { status, data, errors }: any = await deleteFilesBackup(validFiles);
        for (const file of validFiles) {
            await deleteCatalogItem(file.catalogItem.uuid);
        }
        console.log(status, data, errors, '????');
        return sendResponse({
            res,
            status,
            purge: 'true',
            data,
            errors
        });
    } catch (error) {
        logger.error('DELETE assets error:', error);
        const errorMessage = error instanceof Error ? `Process error: ${error.message}` : 'Unexpected error occurred';

        return sendResponse({
            res,
            status: 500,
            data: null,
            errors: [errorMessage],
            purge: 'true'
        });
    }
};
