import { Request, Response } from 'express';
import { addCatalogItem, deleteCatalogItem, deleteCatalogItems, updateCatalogItem } from '../catalog';
import { generateFileInfo } from '../middleware/validators/oneFileValidators';
import { sendResponse } from '../middleware/validators/utils';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { generateStream } from '../utils/file';
import { logger } from '../utils/logs/winston';
import { deleteFilesBackup } from './delegated-storage.controller';
import { generateStreams, updateFiles } from '../delegated-storage';

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
        const filespath = forms
            .map((formItem) => {
                const catalogItem = data.find((item) => item.unique_name === formItem.uniqueName);
                return catalogItem ? catalogItem.unique_name : null;
            })
            .filter(Boolean);

        const files = forms.map((formItem) => formItem.stream);
        console.log(forms, '????koko');
        const { status } = await generateStreams({
            filespath,
            files,
            version: req.query.version ? `${req.query.version}` : null,
            mimetype: req.query.mimetype ? `${req.query.mimetype}` : null
        });

        if (status !== 200) {
            for (const form of forms) {
                logger.info('Deleting catalog item due to failed upload:', form.uniqueName);
                const catalogItem = data.find((item) => item.unique_name === form.uniqueName);
                if (catalogItem) {
                    await deleteCatalogItem(catalogItem.uuid);
                }
            }
            errors.push('Failed to upload files in backup');

            return sendResponse({
                res,
                status: status || 500,
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
    } catch (error) {
        logger.error('Backup process error:', error);
        logger.error('Error details:', error instanceof Error ? error.stack : String(error));

        for (const form of forms) {
            try {
                logger.info('Deleting catalog item due to exception:', form.uniqueName);
                const catalogItem = data.find((item) => item.unique_name === form.uniqueName);
                if (catalogItem) {
                    await deleteCatalogItem(catalogItem.uuid);
                }
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
                    console.log(file, 'FILE ICIIIII');
                    const { status, error } = await updateFiles({
                        filespath: [file.catalogItem.unique_name],
                        files: [stream],
                        version: req.query.version ? `${req.query.version}` : null,
                        mimetype: file.mimetype
                    });

                    if (status !== 200) {
                        return {
                            data,
                            errors: [...errors, error ?? 'Failed to upload in backup /files']
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
    const { validFiles } = res.locals;
    const { data, errors } = await deleteCatalogItems(validFiles);
    const { status: backupStatus } = await deleteFilesBackup(data.map((item: any) => ({ ...item.catalogItem })));
    return sendResponse({
        res,
        status: backupStatus,
        purge: 'true',
        data,
        errors
    });
};
