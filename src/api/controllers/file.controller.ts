import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { FileControllerLocals } from '../props/file-operations';
import { deleteFile, generateStream, returnDefaultImage } from '../utils/file';
import { logger } from '../utils/logs/winston';
import { streamToBuffer, checkSignature } from '../utils/fileProcessing';
import { calculateSHA256, formatItemForCatalog, isExpired } from '../utils/catalog';
import { Readable } from 'node:stream';
import { deleteFileBackup, getBackup, patchFileBackup, postFileBackup, postFilesBackup } from './delegated-storage.controller';
import { addCatalogItem, deleteCatalogItem, updateCatalogItem } from '../catalog';
import { PassThrough } from 'stream';
import { getProcessedFilename, isImageMimetype, processImageOnTheFly } from '../utils/imageOptimization';
import path from 'path';
import fs from 'fs';

const _saveOriginal = process.env.SAVE_ORIGINAL_FILE;

export const getAsset = async (req: Request, res: Response & { locals: FileControllerLocals }) => {
    const { uniqueName, file, original } = res.locals;
    const { width, height, quality } = req.query;

    const needProcessing = Boolean(width || height || quality);
    const fileIsExpired = isExpired(file);
    try {
        if (fileIsExpired) {
            return returnDefaultImage(res, '/default.svg');
        }

        const originalFile = req.url.includes('/original/') && original;
        const version = originalFile ? Number(file.original_version) : Number(file.version);
        const mimetype = originalFile ? file.original_mimetype : file.mimetype;
        const uniqueNameForBackup = originalFile ? uniqueName.replace(file.filename, file.original_filename) : uniqueName;

        const getBackupFile: Readable | null = await getBackup(uniqueNameForBackup, version?.toString(), originalFile ? file.original_mimetype : file.mimetype, original);

        if (!getBackupFile) {
            await deleteCatalogItem(file.uuid);
            return res.status(404).end();
        }

        const bodyBuffer = await streamToBuffer(getBackupFile);
        const bodyStream = Readable.from(bodyBuffer);

        const streamForResponse = new PassThrough();
        bodyStream.pipe(streamForResponse);
        const { isValidSignature, originSignature } = await checkSignature(file, bodyBuffer, originalFile);
        if (!isValidSignature) {
            logger.error(`Invalid signatures (catalog: ${file.signature}, origin: ${originSignature})`);
            return res.status(418).end();
        }

        if (needProcessing && isImageMimetype(mimetype)) {
            logger.info(`🔄 Processing image on-the-fly: w=${width}, h=${height}, q=${quality}`);

            const processedBuffer = await processImageOnTheFly(bodyBuffer, {
                width: width ? parseInt(width as string) : undefined,
                height: height ? parseInt(height as string) : undefined,
                quality: quality ? parseInt(quality as string) : undefined
            });

            if (processedBuffer) {
                const processedStream = Readable.from(processedBuffer);
                const streamForResponse = new PassThrough();
                processedStream.pipe(streamForResponse);

                res.setHeader('Content-Type', 'image/webp');
                res.setHeader('Content-Disposition', `inline; filename="${getProcessedFilename(uniqueNameForBackup, width?.toString(), height?.toString(), quality?.toString())}"`);

                return streamForResponse.pipe(res, { end: true });
            }
        }

        res.setHeader('Content-Type', mimetype);
        res.setHeader('Content-Disposition', `inline; filename="${uniqueNameForBackup}"`);
        return streamForResponse.pipe(res, { end: true });
    } catch (error) {
        logger.error('Error in getAsset:', error);
        return res.status(500).end();
    }
};

export const _deleteTmpFolder = (filepath) => {
    const directory = path.dirname(filepath);
    if (fs.existsSync(directory)) {
        fs.rmSync(directory, { recursive: true, force: true });
        logger.info(`🗑️  Deleted folder: ${directory}`);
    } else {
        logger.info(`⚠️  Folder not found: ${directory}`);
    }
};

export const postAsset = async (_req: Request, res: Response) => {
    const { uniqueName, fileInfo, toWebp, namespace, file } = res.locals;
    try {
        const isImageFile = !['application/pdf', 'image/svg+xml'].includes(file.mimetype);
        const { stream: originalStream } = _saveOriginal && isImageFile ? await generateStream(file, false, true) : { stream: null };
        const { stream, file: newFile } = await generateStream(file, toWebp);

        // clean TMP directory (multer file path and webp transformation path)
        _deleteTmpFolder(file.path);

        if (!stream) return sendResponse({ res, status: 400, errors: ['Failed to generate stream'] });

        const originalSignature = _saveOriginal && isImageFile && calculateSHA256(originalStream);
        const signature = calculateSHA256(stream);

        const { mimetype, size, originalname } = file;

        const transformedFile = {
            unique_name: uniqueName,
            namespace,
            signature,
            mimetype: newFile.mimetype,
            size: newFile.size,
            filename: newFile.filename
        };

        const originalFile = _saveOriginal && isImageFile ? { signature: originalSignature, filename: originalname, mimetype, size } : transformedFile;

        const newItem = await formatItemForCatalog(fileInfo, originalFile, transformedFile);
        const { status, datum } = await addCatalogItem(newItem);

        if (status !== 200 || !datum)
            return sendResponse({
                res,
                status: 400,
                errors: ['Failed to create catalog item']
            });

        if (_saveOriginal && isImageFile) {
            const backupObjectOriginal = { stream: originalStream, file, catalogItem: datum, original: true };
            const backupObject = { stream, file: newFile, catalogItem: datum };
            const postBackupFileOriginal = await postFilesBackup([backupObjectOriginal, backupObject]);
            if (postBackupFileOriginal.status !== 200) {
                await deleteCatalogItem(datum.uuid);
                return sendResponse({ res, status: 400, errors: ['Failed to upload original file in backup'] });
            }
        }
        const backupObject = { stream, file: newFile, catalogItem: datum };
        const postBackupFile = await postFileBackup(backupObject);
        if (postBackupFile.status !== 200) {
            await deleteCatalogItem(datum.uuid);
            return sendResponse({ res, status: 400, errors: ['Failed to upload processed file in backup'] });
        }
        return sendResponse({ res, status: 200, data: [datum], purge: 'catalog' });
    } catch (error) {
        await deleteFile(file.path);
        return sendResponse({ res, status: 500, errors: ['Error during backup upload'] });
    }
};

export const patchAsset = async (_req: Request, res: Response) => {
    const { itemToUpdate, uuid, fileInfo, toWebp, file } = res.locals;
    try {
        const { stream } = file && (await generateStream(file, toWebp));
        if (file && !stream) {
            if (file?.path) await deleteFile(file.path);
            return {
                status: 400,
                errors: ['Failed to generate stream']
            };
        }

        const signature = stream && calculateSHA256(stream);
        const { datum: catalogData, error } = await updateCatalogItem(uuid, {
            ...itemToUpdate,
            ...fileInfo,
            version: file ? itemToUpdate.version + 1 : itemToUpdate.version,
            ...(signature && { signature }),
            ...(file && { size: file.size })
        });

        if (stream && catalogData) {
            const backupObject = { stream, file, catalogItem: catalogData };
            const patchBackupFile = await patchFileBackup(backupObject);
            if (patchBackupFile.status !== 200) {
                await deleteCatalogItem(itemToUpdate.uuid);
            }
        }

        const data = catalogData ? [catalogData] : [];
        const errors = error ? [error] : [];

        if (file?.path) await deleteFile(file.path);
        return sendResponse({ res, status: 200, data, errors, purge: 'true' });
    } catch (error) {
        await deleteFile(file.path);
        return sendResponse({ res, status: 500, errors: ['Error during backup patch'] });
    }
};

export const deleteAsset = async (_req: Request, res: Response) => {
    const { itemToUpdate } = res.locals;

    try {
        const { status, datum } = await deleteCatalogItem(itemToUpdate.uuid);

        if (status !== 200) {
            return {
                status: 500,
                errors: ['Failed to remove file from catalog']
            };
        }

        const deleteBackupFile = await deleteFileBackup(itemToUpdate);

        if (deleteBackupFile.status !== 200) {
            return {
                status: 500,
                data: [{ message: 'File not removed from backup' }]
            };
        }
        return sendResponse({ res, status: 200, data: [datum], purge: 'true' });
    } catch (error) {
        logger.error('Error in deleteAsset:', error);
        return sendResponse({ res, status: 500, errors: ['Internal server error'] });
    }
};
