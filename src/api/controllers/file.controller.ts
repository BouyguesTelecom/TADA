import { Request, Response } from 'express';
import { calculateSHA256, formatItemForCatalog, isExpired } from '../utils/catalog';
import { convertToWebpBuffer, generateStream } from '../utils/file';
import { sendResponse } from '../middleware/validators/utils';
import { FileProps } from '../props/catalog';
import { logger } from '../utils/logs/winston';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { PassThrough } from 'stream';
import { Readable } from 'node:stream';
import app from '../app';
import { addCatalogItem, deleteCatalogItem, updateCatalogItem, getCatalog } from '../catalog';
import { redisHandler } from '../catalog/redis/connection';

const streamToBuffer = (stream: PassThrough): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
    });
};

const checkSignature = async (file: FileProps, stream: PassThrough): Promise<boolean> => {
    try {
        const buffer = await streamToBuffer(stream);
        const signature = calculateSHA256(buffer);
        return file.signature === signature;
    } catch (error) {
        logger.error('Error checking signature:', error);
        return false;
    }
};

export interface Locals {
    uniqueName: string;
    file: FileProps;
}

export const getAsset = async (req: Request, res: Response & { locals: Locals }) => {
    const { uniqueName, file } = res.locals;
    const fileIsExpired = isExpired(file);

    if (!fileIsExpired) {
        const getBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${uniqueName}&version=${file.version}&mimetype=${file.mimetype}`);

        if (getBackupFile.status !== 200) {
            if (getBackupFile.status !== 429) {
                await deleteCatalogItem(uniqueName);
            }
            return res.status(getBackupFile.status).end();
        }
        const bodyBuffer = await getBackupFile.arrayBuffer();
        const bodyStream = Readable.from(Buffer.from(bodyBuffer));

        const streamForSignature = new PassThrough();
        const streamForResponse = new PassThrough();

        bodyStream.pipe(streamForSignature);
        bodyStream.pipe(streamForResponse);

        const { data: catalog } = await getCatalog();
        const item = catalog.find((item: FileProps) => item.unique_name === uniqueName);

        bodyStream.on('error', (err) => {
            logger.error('Error in originalStream:', err);
            return res.status(500).end();
        });

        const isValidSignature = await checkSignature(item, streamForSignature);

        if (!isValidSignature) {
            return res.status(418).end();
        }

        if (req.url.includes('/original/')) {
            res.setHeader('Content-Type', file.mimetype);
            res.setHeader('Content-Disposition', `inline; filename="${uniqueName}"`);
            return streamForResponse.pipe(res, { end: true });
        }
        if (req.url.includes('/full/')) {
            try {
                const webpBuffer = await convertToWebpBuffer(Buffer.from(bodyBuffer));
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
        return res.status(404).end();
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
                data: datum ? [datum] : null,
                errors: error ? [error] : null
            });
        }

        if (datum) {
            const form = new FormData();
            form.append('file', stream, { filename: uniqueName, contentType: file.mimetype });
            try {
                const postBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${uniqueName}&version=1&mimetype=${file.mimetype}`, {
                    method: 'POST',
                    body: form
                });
                if (postBackupFile.status !== 200) {
                    await deleteCatalogItem(uniqueName);
                    return sendResponse({
                        res,
                        status: 400,
                        data: ['Failed to upload in backup']
                    });
                }
                return sendResponse({ res, status: 200, data: [datum], purge: 'catalog' });
            } catch (error) {
                await deleteCatalogItem(uniqueName);
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

        const form = new FormData();
        if (stream) {
            form.append('file', stream, {
                filename: uniqueName,
                contentType: file.mimetype
            });

            const patchBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${itemToUpdate.unique_name}&version=${itemToUpdate.version}&mimetype=${itemToUpdate.mimetype}`, {
                method: 'PATCH',
                body: form
            });

            if (patchBackupFile.status !== 200) {
                await deleteCatalogItem(uniqueName);
            }
        }
        const data = catalogData ? [catalogData] : null;
        const errors = error ? [error] : null;
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

    const { status, datum } = await deleteCatalogItem(itemToUpdate.unique_name);

    if (status !== 200) {
        return sendResponse({
            res,
            status: 500,
            errors: [`Failed to remove file from catalog `]
        });
    }

    const deleteBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${itemToUpdate.unique_name}&version=${itemToUpdate.version}&mimetype=${itemToUpdate.mimetype}`, {
        method: 'DELETE'
    });

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
