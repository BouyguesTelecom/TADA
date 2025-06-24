import { Request, Response } from 'express';
import FormData from 'form-data';
import fetch from 'node-fetch';
import app from '../app';
import { addCatalogItem, deleteCatalogItem, deleteCatalogItems, updateCatalogItem } from '../catalog';
import { generateFileInfo } from '../middleware/validators/oneFileValidators';
import { sendResponse } from '../middleware/validators/utils';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { generateStream } from '../utils/file';
import { logger } from '../utils/logs/winston';
import { deleteFilesBackup } from './delegated-storage.controller';
import crypto from 'crypto';

export const postAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const accumulatedResult = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors, forms } = await accumulator;
            const stream = await generateStream(file, file.uniqueName, file.toWebp);
            if (stream) {
                const signature = calculateSHA256(stream);
                const newItem = await formatItemForCatalog(
                    file.fileInfo,
                    file.filename,
                    res.locals.namespace,
                    file.uniqueName,
                    file.fileInfo?.destination,
                    file.mimetype,
                    file.toWebp,
                    signature,
                    file.size
                );
                const { status, error: errorCatalog, datum: catalogItem } = await addCatalogItem(newItem);
                if (status !== 200) {
                    errors.push(errorCatalog);
                }
                if (catalogItem) {
                    forms.push({
                        stream,
                        uniqueName: newItem.unique_name,
                        filename: file.uniqueName,
                        mimetype: file.mimetype,
                        publicUrl: newItem.public_url
                    });
                    return { data: [...data, catalogItem], errors, forms };
                }
            } else {
                logger.error('Failed to generate stream for file:', file.filename);
            }
            return { data, errors: [...errors, file], forms };
        },
        Promise.resolve({ data: [], errors: invalidFiles, forms: [] })
    );

    const { data, errors, forms } = accumulatedResult;

    try {
        const apiUrl = `${process.env.DELEGATED_STORAGE_HOST}/files`;

        const formData = new FormData();
        const filesData = forms
            .map((formItem) => {
                const catalogItem = data.find((item) => item.unique_name === formItem.uniqueName);
                if (!catalogItem) return null;

                return {
                    file: formItem.stream,
                    metadata: {
                        unique_name: catalogItem.unique_name,
                        base_host: catalogItem.base_host,
                        base_url: catalogItem.base_url,
                        destination: catalogItem.destination,
                        filename: catalogItem.filename,
                        mimetype: catalogItem.mimetype,
                        size: catalogItem.size,
                        namespace: catalogItem.namespace,
                        version: catalogItem.version,
                        publicUrl: catalogItem.public_url
                    }
                };
            })
            .filter(Boolean);

        formData.append('metadata', JSON.stringify(filesData.map((item) => item.metadata)));
        filesData.forEach((fileData) => {
            formData.append('files', fileData.file, {
                filename: fileData.metadata.unique_name,
                contentType: fileData.metadata.mimetype
            });
        });
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`,
                'x-version': req.query.version ? `${req.query.version}` : '',
                'x-mimetype': req.query.mimetype ? `${req.query.mimetype}` : ''
            },
            body: formData
        });

        if (response.status !== 200) {
            let errorDetails = 'Failed to upload images in backup';

            try {
                const errorResponse: any = await response.json().catch(() => response.text());
                if (typeof errorResponse === 'object') {
                    errorDetails = errorResponse.error || (errorResponse.details ? JSON.stringify(errorResponse.details) : null) || errorDetails;
                    logger.error('Delegated storage structured error:', errorResponse);
                } else {
                    errorDetails = errorResponse || errorDetails;
                    logger.error('Delegated storage text error:', errorResponse);
                }
            } catch (parseError) {
                logger.error('Error parsing error response:', parseError);
            }

            for (const form of forms) {
                logger.info('Deleting catalog item due to failed upload:', form.uniqueName);
                const redisKeyMD5 = crypto.createHash('md5').update(form.uniqueName).digest('hex');
                await deleteCatalogItem(redisKeyMD5);
            }
            errors.push(errorDetails);

            return sendResponse({
                res,
                status: 200,
                data: null,
                errors
            });
        } else {
            const responseData: any = await response.json().catch(() => ({}));
            logger.info('Delegated storage success response:', responseData);

            if (responseData.error || (responseData.result && responseData.result.status !== 200) || (responseData.status && responseData.status !== 200)) {
                const errorMsg = responseData.error || (responseData.result && responseData.result.error) || 'Pipeline failed';

                const errorDetails = responseData.details || (responseData.data && responseData.data.message) || (responseData.result && responseData.result.data);

                logger.error('Pipeline error:', { errorMsg, errorDetails });

                for (const form of forms) {
                    logger.info('Deleting catalog item due to pipeline failure:', form.uniqueName);
                    await deleteCatalogItem(form.uniqueName);
                }

                errors.push(errorMsg);
                if (errorDetails) {
                    errors.push(JSON.stringify(errorDetails));
                }

                return sendResponse({
                    res,
                    status: 400,
                    data: null,
                    errors
                });
            }

            return sendResponse({
                res,
                status: 200,
                data,
                errors: errors.length > 0 ? errors : [],
                purge: 'catalog'
            });
        }
    } catch (error) {
        logger.error('Backup process error:', error);
        logger.error('Error details:', error instanceof Error ? error.stack : String(error));

        for (const form of forms) {
            try {
                logger.info('Deleting catalog item due to exception:', form.uniqueName);
                await deleteCatalogItem(form.uniqueName);
            } catch (deleteError) {
                logger.error('Error deleting catalog item:', deleteError);
            }
        }

        const errorMessage = error instanceof Error ? `Backup process error: ${error.message}` : 'An unexpected error occurred during the backup process';

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
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
            let signature;
            if (req.files) {
                const stream = await generateStream(file, file.catalogItem.unique_name, file.toWebp);
                if (stream) {
                    const form = new FormData();
                    form.append('file', stream, {
                        filename: file.catalogItem.unique_name,
                        contentType: file.mimetype
                    });
                    const patchBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${file.catalogItem.unique_name}`, {
                        method: 'PATCH',
                        body: form
                    });
                    if (patchBackupFile.status !== 200) {
                        await deleteCatalogItem(file.catalogItem.unique_name);
                        return {
                            data,
                            errors: [...errors, 'Failed to upload in backup /files']
                        };
                    }
                    signature = calculateSHA256(stream);
                }
            }
            const fileInfo = generateFileInfo(file);
            const version = req.files ? file.catalogItem.version + 1 : file.catalogItem.version;
            const updatedItem = await updateCatalogItem(file.uuid ?? file.catalogItem.uuid, {
                ...file.catalogItem,
                ...file.fileInfo,
                ...fileInfo,
                version,
                ...(signature && { signature }),
                ...(file?.size && { size: file.size })
            });
            if (updatedItem.datum) {
                return { data: [...data, updatedItem.datum], errors };
            }
            return { data, errors: [...errors, updatedItem.error] };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );

    return sendResponse({ res, status: 200, data, errors, purge: 'true' });
};

export const deleteAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const { status, data, errors } = await deleteCatalogItems(validFiles);
    const { status: backupStatus } = await deleteFilesBackup(data.map((item: any) => ({ ...item.catalogItem })));
    return sendResponse({
        res,
        status: backupStatus,
        purge: 'true',
        data,
        errors
    });
};
