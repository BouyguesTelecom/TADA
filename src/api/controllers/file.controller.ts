import { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { PassThrough } from 'stream';
import { addCatalogItem, deleteCatalogItem, getCatalog, updateCatalogItem } from '../catalog';
import { sendResponse } from '../middleware/validators/utils';
import { FileProps } from '../props/catalog';
import { calculateSHA256, formatItemForCatalog, isExpired } from '../utils/catalog';
import { convertToWebpBuffer, generateStream, returnDefaultImage } from '../utils/file';
import { logger } from '../utils/logs/winston';
import { deleteFileBackup, getBackup, patchFileBackup, postFileBackup } from './delegated-storage.controller';

const checkSignature = async (file: FileProps, buffer: Buffer): Promise<{ isValidSignature: boolean; originSignature: string | null }> => {
    try {
        const signature = calculateSHA256(buffer);
        return {
            isValidSignature: file.signature === signature,
            originSignature: signature
        };
    } catch (error) {
        logger.error('Error checking signature:', error);
        return {
            isValidSignature: false,
            originSignature: null
        };
    }
};

export interface Locals {
    uniqueName: string;
    file: FileProps;
}

const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

export const getAsset = async (req: Request, res: Response & { locals: Locals }) => {
    const { uniqueName, file } = res.locals;
    const fileIsExpired = isExpired(file);

    if (!fileIsExpired) {
        const getBackupFile: Readable | null = await getBackup(uniqueName, file.version.toString(), file.mimetype);
        if (!getBackupFile) {
            await deleteCatalogItem(file.uuid);
            return res.status(404).end();
        }
        const bodyBuffer = await streamToBuffer(getBackupFile);
        const bodyStream = Readable.from(bodyBuffer);

        const streamForSignature = new PassThrough();
        const streamForResponse = new PassThrough();

        bodyStream.pipe(streamForSignature);
        bodyStream.pipe(streamForResponse);

        const { data: catalog } = await getCatalog();
        const item = catalog.find((item: FileProps) => item.unique_name === uniqueName);

        bodyStream.on('error', (err) => {
            logger.error('Error in originalStream: ', err);
            return res.status(500).end();
        });

        const { isValidSignature, originSignature } = await checkSignature(item, bodyBuffer);

        if (!isValidSignature) {
            logger.error(`Invalid signatures (catalog: ${item.signature}, origin: ${originSignature})`);
            return res.status(418).end();
        }
        if (req.url.includes('/original/')) {
            res.setHeader('Content-Type', file.mimetype);
            res.setHeader('Content-Disposition', `inline; filename="${uniqueName}"`);
            return streamForResponse.pipe(res, { end: true });
        }
        if (req.url.includes('/full/')) {
            try {
                const webpBuffer = await convertToWebpBuffer(bodyBuffer);
                res.setHeader('Content-Type', 'image/webp');
                return res.send(webpBuffer);
            } catch (error) {
                console.error('Error during WebP conversion:', error);
                return res.status(500).send('Internal Server Error');
            }
        }
        if (req.url.includes('/optimise/')) {
            const filePathRegex = /\/optimise\/(.*?)\//;
            const match = req.url.match(filePathRegex);
            if (match && match[1]) {
                const extractedPart = match[1];
                if (extractedPart.includes('x')) {
                    const width = extractedPart.split('x')[0];
                    const height = extractedPart.split('x')[1];
                    const params = { width: Number(width), height: Number(height) };
                    const webpBuffer = await convertToWebpBuffer(Buffer.from(bodyBuffer), params);
                    res.setHeader('Content-Type', 'image/webp');
                    return res.send(webpBuffer);
                }
            }
        }
    }
    if (fileIsExpired) {
        return returnDefaultImage(res, '/default.webp');
    }
    return res.status(404).end();
};
export const postAsset = async (req: Request, res: Response) => {
    const { uniqueName, fileInfo, toWebp, namespace, file } = res.locals;
    const stream = await generateStream(file, uniqueName, toWebp);
    if (stream) {
        const signature = calculateSHA256(stream);
        const newItem = await formatItemForCatalog(fileInfo, file.filename, namespace, uniqueName, fileInfo?.destination || '', file.mimetype, toWebp, signature, file.size);
        const { status, error, datum } = await addCatalogItem(newItem);
        if (status !== 200) {
            return sendResponse({
                res,
                status: 400,
                data: datum ? [datum] : [],
                errors: error ? [error] : []
            });
        }
        if (datum) {
            try {
                const postBackupFile = await postFileBackup(stream, file, datum);
                if (postBackupFile.status !== 200) {
                    await deleteCatalogItem(datum.uuid);
                    return sendResponse({
                        res,
                        status: 400,
                        data: [],
                        errors: ['Failed to upload in backup ']
                    });
                }
                return sendResponse({ res, status: 200, data: [datum], purge: 'catalog' });
            } catch (error) {
                await deleteCatalogItem(datum.uuid);
                return sendResponse({
                    res,
                    status: 500,
                    errors: ['Error during backup upload'],
                    purge: 'catalog'
                });
            }
        }
    }
    return sendResponse({
        res,
        status: 400,
        errors: ['Failed to upload file']
    });
};

export const patchAsset = async (req: Request, res: Response) => {
    const { itemToUpdate, uuid, fileInfo, uniqueName, toWebp, file } = res.locals;
    const stream = file && (await generateStream(file, uniqueName, toWebp));
    if ((file && stream) || !file) {
        const signature = stream && calculateSHA256(stream);
        const { datum: catalogData, error } = await updateCatalogItem(uuid, {
            ...itemToUpdate,
            ...fileInfo,
            version: file ? itemToUpdate.version + 1 : itemToUpdate.version,
            ...(signature && { signature }),
            ...(file && { size: file.size })
        });

        if (stream) {
            const patchBackupFile = await patchFileBackup(file, stream, catalogData);
            if (patchBackupFile.status !== 200) {
                await deleteCatalogItem(itemToUpdate.uuid);
            }
        }
        const data = catalogData ? [catalogData] : [];
        const errors = error ? [error] : [];
        return sendResponse({ res, status: 200, data, errors, purge: 'true' });
    }
    return sendResponse({
        res,
        status: 400,
        errors: ['Failed to upload file in backup']
    });
};

export const deleteAsset = async (req: Request, res: Response) => {
    const { itemToUpdate } = res.locals;
    const { status, datum } = await deleteCatalogItem(itemToUpdate.uuid);

    if (status !== 200) {
        return sendResponse({
            res,
            status: 500,
            errors: [`Failed to remove file from catalog `]
        });
    }

    const deleteBackupFile = await deleteFileBackup(itemToUpdate);

    if (deleteBackupFile.status !== 200) {
        return sendResponse({
            res,
            status: 500,
            data: [{ message: `File not removed from backup` }]
        });
    }

    return sendResponse({
        res,
        status: 200,
        data: [datum],
        purge: 'true'
    });
};
