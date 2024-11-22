import { Request, Response } from 'express';
import { uploadFile } from '../utils/file';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { addFileInCatalog, deleteFileFromCatalog, updateFileInCatalog } from './catalog.controller';
import { sendResponse } from '../middleware/validators/utils';
import { generateFileInfo } from '../middleware/validators/oneFileValidators';
import app from '../app';
import FormData from 'form-data';
import fetch from 'node-fetch';

export const postAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
            const upload = await uploadFile(file, file.uniqueName, file.toWebp);
            if (upload) {
                const signature = calculateSHA256(upload);
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

                const { status, message, data: catalogItem } = await addFileInCatalog(newItem);
                if (status !== 200) {
                    errors.push(message);
                }
                if (catalogItem) {
                    const form = new FormData();
                    form.append('file', upload, {
                        filename: file.uniqueName,
                        contentType: file.mimetype
                    });

                    const postBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/backup?filepath=${newItem.unique_name}`, { method: 'POST', body: form });

                    if (postBackupFile.status !== 200) {
                        await deleteFileFromCatalog(newItem.unique_name);
                        errors.push('Failed to upload in backup');
                    }
                }
                return { data: [...data, catalogItem], errors };
            }
            return { data, errors: [...errors, file] };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );
    return sendResponse({ res, status: 200, data, errors });
};

export const patchAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
            let signature;
            if (req.files) {
                const upload = await uploadFile(file, file.catalogItem.unique_name, file.toWebp);
                if (upload) {
                    const form = new FormData();
                    form.append('file', upload, {
                        filename: file.catalogItem.unique_name,
                        contentType: file.mimetype
                    });
                    const patchBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/backup?filepath=${file.catalogItem.unique_name}`, {
                        method: 'PATCH',
                        body: form
                    });
                    if (patchBackupFile.status !== 200) {
                        await deleteFileFromCatalog(file.catalogItem.unique_name);
                        return {
                            data,
                            errors: [...errors, 'Failed to upload in backup']
                        };
                    }
                    signature = calculateSHA256(upload);
                }
            }
            const fileInfo = generateFileInfo(req.body);
            const version = req.files ? file.catalogItem.version + 1 : file.catalogItem.version;
            const updatedItem = await updateFileInCatalog(file.uuid, {
                ...file.catalogItem,
                ...file.fileInfo,
                ...fileInfo,
                version,
                ...(signature && { signature }),
                ...(file && { size: file.size })
            });
            if (updatedItem.data) {
                return { data: [...data, updatedItem.data], errors };
            }
            return { data, errors: [...errors, updatedItem.error] };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );

    return sendResponse({ res, status: 200, data, errors });
};

export const deleteAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
            const { status } = await deleteFileFromCatalog(file.catalogItem.unique_name);
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

            const deleteBackupFile = await fetch(`${app.locals.PREFIXED_API_URL}/backup?filepath=${file.catalogItem.unique_name}`, { method: 'DELETE' });
            if (deleteBackupFile.status !== 200) {
                await deleteFileFromCatalog(file.catalogItem.unique_name);
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
    return sendResponse({ res, status: 200, data, errors });
};
