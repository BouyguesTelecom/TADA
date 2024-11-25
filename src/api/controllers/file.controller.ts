import { Request, Response } from 'express';
import { calculateSHA256, formatItemForCatalog, isExpired } from '../utils/catalog';
import { convertToWebpBuffer, generateStream } from '../utils/file';
import proxy from 'express-http-proxy';
import { addFileInCatalog, deleteFileFromCatalog, updateFileInCatalog } from '../controllers/catalog.controller';
import { sendResponse } from '../middleware/validators/utils';
import { FileProps } from '../utils/redis/types';
import { getCatalog } from '../utils/redis/operations';
import { logger } from '../utils/logs/winston';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { PassThrough } from 'stream';
import { Readable } from 'node:stream';
import app from '../app';
import { randomUUID } from 'node:crypto';
import { fileHandler } from '../objects/file';
import { catalogHandler } from '../objects/catalog';

const streamToBuffer = (stream: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
    });
};

const checkSignature = async (file: FileProps, stream: any): Promise<boolean> => {
    try {
        const buffer = await streamToBuffer(stream);
        const signature = calculateSHA256(buffer);
        return file.signature === signature;
    } catch ( error ) {
        logger.error('Error checking signature:', error);
        return false;
    }
};

export const getAsset = async (req: Request, res: Response) => {
    const { uniqueName, file } = res.locals;
    const fileIsExpired = isExpired(file);

    if (!fileIsExpired) {
        const { status, streamBuffer } = await fileHandler.getFile(uniqueName, file);

        if (status !== 200) {
            if (status !== 429) {
                await catalogHandler.deleteItem(uniqueName);
            }
            return res.status(status).end();
        }
        const bodyStream = Readable.from(Buffer.from(streamBuffer));

        const streamForSignature = new PassThrough();
        const streamForResponse = new PassThrough();

        bodyStream.pipe(streamForSignature);
        bodyStream.pipe(streamForResponse);

        const catalog = await catalogHandler.getAll();
        const item = catalog.data.find((item) => item.unique_name === uniqueName);

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
            res.setHeader('Content-Disposition', `inline; filename="${ uniqueName }"`);
            return streamForResponse.pipe(res, { end: true });
        }
        if (req.url.includes('/full/')) {
            try {
                const webpBuffer = await convertToWebpBuffer(Buffer.from(streamBuffer));
                res.setHeader('Content-Type', 'image/webp');
                return res.send(webpBuffer);
            } catch ( error ) {
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
                    const webpBuffer = await convertToWebpBuffer(Buffer.from(streamBuffer), params);
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

        const { status, message, data } = await catalogHandler.addItem(newItem);

        if (status !== 200) {
            return sendResponse({ res, status: 400, errors: [ message ] });
        }

        if (data) {
            try {
                const { status, errors, purge } = await fileHandler.postFile(uniqueName, file, stream);
                return sendResponse({
                    res,
                    status, ...( !errors && { data } ), ...( errors && { errors } ), ...( purge && { purge } )
                });
            } catch ( error ) {
                await catalogHandler.deleteItem(uniqueName);
                return sendResponse({
                    res,
                    status: 500,
                    errors: [ 'Error during backup upload' ],
                    purge: 'catalog'
                });
            }
        }
    }
    return sendResponse({
        res,
        status: 400,
        errors: [ 'Failed to upload file' ]
    });
};

export const patchAsset = async (req: Request, res: Response) => {
    const { itemToUpdate, uuid, fileInfo, uniqueName, toWebp, file } = res.locals;
    const stream = file && ( await generateStream(file, uniqueName, toWebp) );

    if (( file && stream ) || !file) {
        const signature = stream && calculateSHA256(stream);
        const { data: catalogData, error } = await catalogHandler.updateItem(uuid, {
            ...itemToUpdate,
            ...fileInfo,
            version: file ? itemToUpdate.version + 1 : itemToUpdate.version,
            ...( signature && { signature } ),
            ...( file && { size: file.size } )
        });


        if (stream) {
            fileHandler.patchFile(uniqueName, file, stream, itemToUpdate);
        }

        const data = catalogData ? [ catalogData ] : null;
        const errors = error ? [ error ] : null;
        return sendResponse({ res, status: 200, data, errors, purge: 'true' });
    }
    return sendResponse({
        res,
        status: 400,
        errors: [ 'Failed to upload file in backup' ]
    });
};

export const deleteAsset = async (req: Request, res: Response) => {
    const { itemToUpdate } = res.locals;

    const { status, message } = await catalogHandler.deleteItem(itemToUpdate.unique_name);

    if (status !== 200) {
        return sendResponse({
            res,
            status: 500,
            errors: [ `Failed to remove file from catalog : ${ message }` ]
        });
    }

    const { status: statusFile, errors } = await fileHandler.deleteFile(itemToUpdate.unique_name, itemToUpdate);

    return sendResponse({
        res,
        status: statusFile,
        ...( !errors && {
            data: [ { message: `File removed successfully` } ],
            purge: 'true'
        } ),
        ...( errors && { errors } )
    });
};
