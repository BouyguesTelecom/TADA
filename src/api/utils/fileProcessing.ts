import { Readable } from 'node:stream';
import { PassThrough } from 'stream';
import { addCatalogItem, deleteCatalogItem, updateCatalogItem } from '../catalog';
import { FileProps } from '../props/catalog';
import { GetAssetResult, PostAssetResult, PatchAssetResult, DeleteAssetResult } from '../props/api-responses';
import { calculateSHA256, formatItemForCatalog, isExpired } from '../utils/catalog';
import { convertToWebpBuffer, deleteFile, generateStream } from '../utils/file';
import { logger } from '../utils/logs/winston';
import { deleteFileBackup, getBackup, patchFileBackup, postFileBackup } from '../controllers/delegated-storage.controller';

const checkSignature = async (file: FileProps, buffer: Buffer): Promise<{ isValidSignature: boolean; originSignature: string | null }> => {
    try {
        const signature = calculateSHA256(buffer);
        return { isValidSignature: file.signature === signature, originSignature: signature };
    } catch (error) {
        logger.error('Error checking signature:', error);
        return { isValidSignature: false, originSignature: null };
    }
};

const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

export const processGetAsset = async (uniqueName: string, file: FileProps, version: number, requestUrl: string): Promise<GetAssetResult> => {
    const fileIsExpired = isExpired(file);

    if (!fileIsExpired) {
        const getBackupFile: Readable | null = await getBackup(uniqueName, version.toString(), file.mimetype);

        if (!getBackupFile) {
            await deleteCatalogItem(file.uuid);
            return { status: 404, error: 'File not found' };
        }

        const bodyBuffer = await streamToBuffer(getBackupFile);
        const bodyStream = Readable.from(bodyBuffer);

        const streamForResponse = new PassThrough();
        bodyStream.pipe(streamForResponse);

        const { isValidSignature, originSignature } = await checkSignature(file, bodyBuffer);

        if (!isValidSignature && !version) {
            logger.error(`Invalid signatures (catalog: ${file.signature}, origin: ${originSignature})`);
            return { status: 418, error: 'Invalid signature' };
        }

        if (requestUrl.includes('/original/') || file.mimetype === 'application/pdf' || file.mimetype === 'image/svg+xml' || (requestUrl.includes('/full/') && file.mimetype === 'image/webp')) {
            return {
                status: 200,
                stream: streamForResponse,
                contentType: file.mimetype ?? 'image/webp',
                contentDisposition: `inline; filename="${uniqueName}"`
            };
        }

        if (requestUrl.includes('/full/')) {
            try {
                const webpBuffer = await convertToWebpBuffer(bodyBuffer, null, file.mimetype);
                return {
                    status: 200,
                    buffer: webpBuffer,
                    contentType: 'image/webp'
                };
            } catch (error) {
                logger.error('Error during WebP conversion:', error);
                return { status: 500, error: 'WebP conversion failed' };
            }
        }

        if (requestUrl.includes('/optimise/')) {
            const filePathRegex = /\/optimise\/(.*?)\//;
            const match = requestUrl.match(filePathRegex);
            if (match && match[1]) {
                const extractedPart = match[1];
                if (extractedPart.includes('x')) {
                    const width = extractedPart.split('x')[0];
                    const height = extractedPart.split('x')[1];
                    const params = { width: Number(width), height: Number(height) };
                    const webpBuffer = await convertToWebpBuffer(Buffer.from(bodyBuffer), params);
                    return {
                        status: 200,
                        buffer: webpBuffer,
                        contentType: 'image/webp'
                    };
                }
            }
        }
    }

    if (fileIsExpired) {
        return { status: 200, error: 'expired' }; // Special case for default image
    }

    return { status: 404, error: 'Not found' };
};

export const processPostAsset = async (uniqueName: string, fileInfo: any, toWebp: boolean, namespace: string, file: any): Promise<PostAssetResult> => {
    const stream = await generateStream(file, toWebp);
    if (!stream) {
        return {
            status: 400,
            errors: ['Failed to generate stream']
        };
    }

    const signature = calculateSHA256(stream);
    const newItem = await formatItemForCatalog(fileInfo, file.filename, namespace, uniqueName, file.mimetype, toWebp, signature, file.size);
    const { status, error, datum } = await addCatalogItem(newItem);

    if (status !== 200) {
        return {
            status: 400,
            data: datum ? [datum] : [],
            errors: error ? [error] : []
        };
    }

    if (!datum) {
        return {
            status: 400,
            errors: ['Failed to create catalog item']
        };
    }

    try {
        const postBackupFile = await postFileBackup(stream, file, datum);
        if (postBackupFile.status !== 200) {
            await deleteCatalogItem(datum.uuid);
            return {
                status: 400,
                data: [],
                errors: ['Failed to upload in backup']
            };
        }

        await deleteFile(file.path);
        return {
            status: 200,
            data: [datum],
            purge: 'catalog'
        };
    } catch (error) {
        await deleteCatalogItem(datum.uuid);
        await deleteFile(file.path);
        return {
            status: 500,
            errors: ['Error during backup upload'],
            purge: 'catalog'
        };
    }
};

export const processPatchAsset = async (itemToUpdate: any, uuid: string, fileInfo: any, toWebp: boolean, file?: any): Promise<PatchAssetResult> => {
    const stream = file && (await generateStream(file, toWebp));

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
        const patchBackupFile = await patchFileBackup(catalogData.uuid, stream, {
            publicUrl: catalogData.public_url,
            unique_name: catalogData.unique_name,
            version: catalogData.version,
            mimetype: catalogData.mimetype
        });
        if (patchBackupFile.status !== 200) {
            await deleteCatalogItem(itemToUpdate.uuid);
        }
    }

    const data = catalogData ? [catalogData] : [];
    const errors = error ? [error] : [];

    if (file?.path) await deleteFile(file.path);

    return {
        status: 200,
        data,
        errors,
        purge: 'true'
    };
};

export const processDeleteAsset = async (itemToUpdate: any): Promise<DeleteAssetResult> => {
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

    return {
        status: 200,
        data: [datum],
        purge: 'true'
    };
};
