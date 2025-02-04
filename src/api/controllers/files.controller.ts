import { Request, Response } from 'express';
import { generateStream } from '../utils/file';
import { calculateSHA256, formatItemForCatalog } from '../utils/catalog';
import { sendResponse } from '../middleware/validators/utils';
import { generateFileInfo } from '../middleware/validators/oneFileValidators';
import app from '../app';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { addCatalogItems, deleteCatalogItems, updateCatalogItems } from '../catalog';

export const postAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
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

                const form = new FormData();
                form.append('file', stream, {
                    filename: file.uniqueName,
                    contentType: file.mimetype
                });

                const postBackupFile = await fetch(`${ app.locals.PREFIXED_API_URL }/delegated-storage?filepath=${ newItem.unique_name }`, {
                    method: 'POST',
                    body: form
                });

                if (postBackupFile.status !== 200) {
                    return { data, errors: [ ...errors, file ] };
                }

                return { data: [ ...data, newItem ], errors };
            }
            return { data, errors: [ ...errors, file ] };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );
    const { errors: errorsCatalog, data: catalogItems } = await addCatalogItems(data);
    return await sendResponse({
        res,
        status: 200,
        data: [ ...data, ...catalogItems ],
        errors: [ ...errors, ...errorsCatalog ],
        purge: 'catalog'
    });
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
                    const patchBackupFile = await fetch(`${ app.locals.PREFIXED_API_URL }/delegated-storage?filepath=${ file.catalogItem.unique_name }`, {
                        method: 'PATCH',
                        body: form
                    });
                    signature = calculateSHA256(stream);
                }
            }
            const fileInfo = generateFileInfo(file);
            const version = req.files ? file.catalogItem.version + 1 : file.catalogItem.version;
            const updatedItem = {
                ...file.catalogItem,
                ...file.fileInfo,
                ...fileInfo,
                version,
                ...( signature && { signature } ),
                ...( file?.size && { size: file.size } )
            };
            return { data: [ ...data, updatedItem ], errors };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );

    const { errors: errorsCatalog, data: catalogItems } = await updateCatalogItems(data);
    return sendResponse({
        res,
        status: 200,
        data: [ ...data, ...catalogItems ],
        errors: [ ...errors, ...errorsCatalog ],
        purge: 'catalog'
    });
};

export const deleteAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;
    const { data, errors } = await validFiles.reduce(
        async (accumulator, file) => {
            const { data, errors } = await accumulator;
            const deleteBackupFile = await fetch(`${ app.locals.PREFIXED_API_URL }/delegated-storage?filepath=${ file.catalogItem.unique_name }`, { method: 'DELETE' });
            if (deleteBackupFile.status !== 200) {
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
                        message: 'Item deleted successfully from backup.'
                    }
                ],
                errors
            };
        },
        Promise.resolve({ data: [], errors: invalidFiles })
    );

    const { errors: errorsCatalog, data: catalogItems } = await deleteCatalogItems(data);
    return sendResponse({
        res,
        status: 200,
        data: [ ...data, ...catalogItems ],
        errors: [ ...errors, ...errorsCatalog ],
        purge: 'catalog'
    });
};
