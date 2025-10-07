import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { logger } from '../utils/logs/winston';
import { deleteFilesBackup, patchFilesBackup, postFilesBackup } from './delegated-storage.controller';
import { generateStream } from '../utils/file';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { addCatalogItem, deleteCatalogItem, getCatalogItem, updateCatalogItem } from '../catalog';
import { _deleteTmpFolder } from './file.controller';

const _saveOriginal = process.env.SAVE_ORIGINAL_FILE;

export const postAssets = async (_req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const files = [];
    for (const file of validFiles) {
        const isImageFile = !['application/pdf', 'image/svg+xml'].includes(file.mimetype);
        const { stream: originalStream } = _saveOriginal && isImageFile && (await generateStream(file, false, true));
        const { stream, file: newFile } = await generateStream(file, file.toWebp);

        _deleteTmpFolder(file.path);

        if (!stream) files.push({ ...file, message: 'Failed to generate stream' });

        const originalSignature = _saveOriginal && isImageFile && calculateSHA256(originalStream);
        const signature = calculateSHA256(stream);

        const { mimetype, size, originalname } = file;

        const transformedFile = {
            unique_name: file.uniqueName,
            namespace: file.fileInfo.namespace,
            signature,
            mimetype: newFile.mimetype,
            size: newFile.size,
            filename: newFile.filename
        };

        const originalFile = _saveOriginal && isImageFile ? { signature: originalSignature, filename: originalname, mimetype, size } : transformedFile;

        const newItem = await formatItemForCatalog(file.fileInfo, originalFile, transformedFile);
        const { status, error, datum } = await addCatalogItem(newItem);

        if (status !== 200 || !datum) files.push({ ...file, message: `Failed to create catalog item: ${error}` });
        if (_saveOriginal && isImageFile) {
            files.push({
                stream: originalStream,
                file,
                fileInfo: file.fileInfo,
                catalogItem: datum,
                original: true,
                success: true
            });
        }
        files.push({ stream, file: newFile, fileInfo: file.fileInfo, catalogItem: datum, success: true });
    }

    const successFiles = files.filter((file) => file.success);
    const errorFiles = files.filter((file) => !file.success);
    try {
        const responseBackup: any = await postFilesBackup(successFiles);
        const items = await Promise.all(successFiles.filter((file) => !file.original).map(async (file) => (await getCatalogItem({ uuid: file.catalogItem.uuid })).datum));
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
    const files = [];
    for (const file of validFiles) {
        const {stream} = await generateStream(file, file.toWebp);

        if (!stream) files.push({ ...file, message: 'Failed to generate stream' });

        const signature = calculateSHA256(stream);
        const { status, error, datum } = await updateCatalogItem(file.catalogItem.uuid, {
            ...file.catalogItem,
            ...file.fileInfo,
            version: file ? file.catalogItem.version + 1 : file.catalogItem.version,
            ...(signature && { signature }),
            ...(file && { size: file.size })
        });

        if (status !== 200 || !datum) files.push({ ...file, message: `Failed to create catalog item: ${error}` });

        files.push({ catalogItem: datum, fileInfo: file.fileInfo, stream, success: true });
    }

    const successFiles = files.filter((file) => file.success);
    const errorFiles = files.filter((file) => !file.success);
    try {
        const responseBackup: any = await patchFilesBackup(successFiles);
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
        const { status, data, errors }: any = await deleteFilesBackup(validFiles);
        for (const file of validFiles) {
            await deleteCatalogItem(file.catalogItem.uuid);
        }
        return sendResponse({
            res,
            status,
            purge: 'true',
            data,
            errors: [...errors, ...invalidFiles]
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
