import { Request, Response } from 'express';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { Readable } from 'node:stream';
import { PassThrough } from 'stream';
import app from '../app';
import { addCatalogItem, deleteCatalogItem, getCatalog, updateCatalogItem } from '../catalog';
import { sendResponse } from '../middleware/validators/utils';
import { FileProps } from '../props/catalog';
import { calculateSHA256, formatItemForCatalog, isExpired } from '../utils/catalog';
import { convertToWebpBuffer, generateStream } from '../utils/file';
import { logger } from '../utils/logs/winston';

const streamToBuffer = (stream: PassThrough): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
    });
};

const checkSignature = async (file: FileProps, stream: PassThrough): Promise<{ isValidSignature: boolean; originSignature: string | null }> => {
    try {
        const buffer = await streamToBuffer(stream);
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

        const { isValidSignature, originSignature } = await checkSignature(item, streamForSignature);

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
            const formData = new FormData();

            const metadata = {
                unique_name: newItem.unique_name,
                base_url: newItem.base_host,
                destination: newItem.destination,
                filename: newItem.filename,
                mimetype: newItem.mimetype,
                size: newItem.size,
                namespace: newItem.namespace,
                version: newItem.version
            };
            formData.append('metadata', JSON.stringify([metadata]));
            formData.append('file', stream, { filename: uniqueName, contentType: file.mimetype });

            try {
                const apiUrl = `${process.env.DELEGATED_STORAGE_HOST}/file`;
                console.log('Sending request to:', apiUrl);

                console.log('===== Form : =====', formData);
                const postBackupFile = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`,
                        'x-version': req.query.version ? `${req.query.version}` : '',
                        'x-mimetype': req.query.mimetype ? `${req.query.mimetype}` : ''
                    },
                    body: formData
                });
                if (postBackupFile.status !== 200) {
                    let errorDetails = 'Failed to upload in backup /file';

                    try {
                        // Tenter de récupérer plus de détails sur l'erreur
                        const errorResponse = await postBackupFile.json();
                        errorDetails = errorResponse.error || errorResponse.details || errorDetails;
                    } catch (parseError) {
                        console.error('Error parsing error response:', parseError);
                    }

                    await deleteCatalogItem(uniqueName);
                    return sendResponse({
                        res,
                        status: 400,
                        data: ['Failed to upload in backup /file'],
                        errors: [errorDetails]
                    });
                }
                const responseData = await postBackupFile.json().catch(() => ({}));

                if (responseData.error || (responseData.result && responseData.result.status !== 200)) {
                    await deleteCatalogItem(uniqueName);
                    return sendResponse({
                        res,
                        status: 400,
                        errors: [responseData.error || 'Pipeline failed'],
                        data: responseData.details ? [responseData.details] : null
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

            const patchBackupFile = await fetch(
                `${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${itemToUpdate.unique_name}&version=${itemToUpdate.version}&mimetype=${itemToUpdate.mimetype}`,
                {
                    method: 'PATCH',
                    body: form
                }
            );

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
