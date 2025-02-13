import { Request, Response } from 'express';
import { generateStream } from '../utils/file';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { sendResponse } from '../middleware/validators/utils';
import { generateFileInfo } from '../middleware/validators/oneFileValidators';
import app from '../app';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { addCatalogItem, deleteCatalogItem, updateCatalogItem } from '../catalog';

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
                    file.size,
                    file.status
                );

                const { status, error: errorCatalog, datum: catalogItem } = await addCatalogItem(newItem);
                if (status !== 200) {
                    errors.push(errorCatalog);
                }
                if (catalogItem) {
                    const form = new FormData();
                    form.append('file', stream, {
                        filename: file.uniqueName,
                        contentType: file.mimetype
                    });

                    forms.push({ form, uniqueName: newItem.unique_name });
                    return { data: [...data, catalogItem], errors, forms };
                }
            }
            return { data, errors: [...errors, file], forms };
        },
        Promise.resolve({ data: [], errors: invalidFiles, forms: [] })
    );

    const { data, errors, forms } = accumulatedResult;
    try {
        const response = await fetch(`${req.app.locals.PREFIXED_API_URL}/delegated-storage/files`, {
            ...req,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-version': req.query.version ? `${req.query.version}` : '',
                'x-mimetype': req.query.mimetype ? `${req.query.mimetype}` : ''
            }
        });

        if (response.status !== 200) {
            for (const form of forms) {
                await deleteCatalogItem(form.uniqueName);
            }
            errors.push('Failed to upload images in backup');
        }
    } catch (error) {
        errors.push('An error occurred during the backup process');
    }

    return sendResponse({ res, status: 200, data, errors, purge: 'catalog' });
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
                            errors: [...errors, 'Failed to upload in backup']
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
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
            const { status } = await deleteCatalogItem(file.catalogItem.unique_name);
            if (status !== 200) {
                return {
                    data,
                    errors: [
                        ...errors,
                        {
                            ...file,
                            message: `Failed to remove file from catalog`
                        }
                    ]
                };
            }

            const deleteBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/delegated-storage?filepath=${file.catalogItem.unique_name}`, { method: 'DELETE' });
            if (deleteBackupFile.status !== 200) {
                await deleteCatalogItem(file.catalogItem.unique_name);
                return {
                    data,
                    errors: [
                        ...errors,
                        {
                            ...file,
                            message: `Failed to remove file from backup`
                        }
                    ]
                };
            }

            return {
                data: [
                    ...data,
                    {
                        ...file.catalogItem,
                        message: 'Item deleted successfully.'
                    }
                ],
                errors
            };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );
    return sendResponse({ res, status: 200, data, errors, purge: 'true' });
};
