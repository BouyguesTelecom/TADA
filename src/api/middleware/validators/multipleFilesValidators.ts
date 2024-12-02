import multer from 'multer';
import { isFileNameInvalid, storage } from './utils/multer';
import { fileIsTooLarge, generateUniqueName, sendResponse } from './utils';
import { generateFileInfo } from './oneFileValidators';
import { NextFunction, Request, Response } from 'express';
import { findFileInCatalog } from '../../utils/catalog';

export const validatorFiles = multer({
    storage: storage
}).array('files');

export const validatorFilesFilter = async (req: Request, res: Response, next: NextFunction) => {
    const filesFromMulter = req.files;
    const { uuids } = res.locals;
    const allowedMimetypes = process.env.VALID_MIMETYPES?.split(',');
    if (Array.isArray(filesFromMulter)) {
        const { validFiles, invalidFiles } = filesFromMulter.reduce(
            (acc, file, index) => {
                const { validFiles, invalidFiles } = acc;
                const uuid = uuids && uuids.split(',')[index];

                const mimeTypeIsAllowed = allowedMimetypes.length ? allowedMimetypes.includes(file.mimetype) : true;
                const errorFileName = isFileNameInvalid(file);

                if (errorFileName || !mimeTypeIsAllowed) {
                    const message = mimeTypeIsAllowed ? errorFileName : `File type ${file.mimetype} unauthorized.`;
                    return {
                        ...acc,
                        invalidFiles: [...invalidFiles, { ...file, message, uuid }]
                    };
                }

                return {
                    validFiles: [...validFiles, { ...file, uuid }],
                    invalidFiles
                };
            },
            { validFiles: [], invalidFiles: [] }
        );

        res.locals = { ...res.locals, validFiles, invalidFiles };
        return next();
    }
    res.locals = { ...res.locals, validFiles: [], invalidFiles: [] };
    next();
};

export const validatorUUIds = (req: Request, res: Response, next: NextFunction) => {
    const { contentType } = res.locals;

    if (contentType === 'multipart/form-data') {
        const uuidsFromBody = req.body.uuids;
        if (!uuidsFromBody) {
            return sendResponse({
                res,
                status: 400,
                errors: ['No uuids provided']
            });
        }
        const numberOfFiles = req.files.length;
        const uuids = uuidsFromBody.split(',');

        if (numberOfFiles !== uuids.length) {
            return sendResponse({
                res,
                status: 400,
                errors: ['Number of UUIDs and number of files provided different']
            });
        }
        res.locals.uuids = uuidsFromBody;
    }

    next();
};

export const validatorFilesSize = async (req: Request, res: Response, next: NextFunction) => {
    const { invalidFiles: invalidFilesFromLocal, validFiles: validFilesFromLocal } = res.locals;
    if (validFilesFromLocal.length) {
        const { invalidFiles, validFiles } = await validFilesFromLocal.reduce(
            async (accumulator, file) => {
                const { invalidFiles, validFiles } = await accumulator;
                const fileTooLarge = await fileIsTooLarge(file, req.params, req.method);
                if (fileTooLarge) {
                    return {
                        invalidFiles: [...invalidFiles, fileTooLarge],
                        validFiles
                    };
                }
                return { invalidFiles, validFiles: [...validFiles, file] };
            },
            Promise.resolve({
                invalidFiles: invalidFilesFromLocal,
                validFiles: []
            })
        );

        res.locals = { ...res.locals, invalidFiles, validFiles };
        return next();
    }
    next();
};

export const validatorFilesBody = async (req: Request, res: Response, next: NextFunction) => {
    if (res.locals.contentType === 'application/json' && !Array.isArray(req.body)) {
        return sendResponse({
            res,
            status: 400,
            errors: [`Body has to be an array`]
        });
    }

    const { namespace, validFiles: validFilesFromLocal, invalidFiles: invalidFilesFromLocal } = res.locals;
    const toWebp = req.body.toWebp !== 'false';

    const { validFiles, invalidFiles } = await validFilesFromLocal.reduce(
        async (accumulator, file) => {
            const { validFiles, invalidFiles } = await accumulator;
            const uniqueName = !file.uuid && generateUniqueName(file, req.body, namespace, toWebp);
            const itemFound = await findFileInCatalog(file.uuid ? file.uuid : uniqueName, file.uuid ? 'uuid' : 'unique_name');
            if (itemFound && req.method === 'POST') {
                return {
                    validFiles,
                    invalidFiles: [
                        ...invalidFiles,
                        {
                            ...file,
                            message: 'Already exists with the same path.'
                        }
                    ]
                };
            }
            const fileInfo: Object = generateFileInfo(file, req.method);
            if (!fileInfo && !req.files) {
                return {
                    validFiles,
                    invalidFiles: [
                        ...invalidFiles,
                        {
                            uuid: file.uuid,
                            message: 'No allowed changes detected'
                        }
                    ]
                };
            }
            return {
                validFiles: [
                    ...validFiles,
                    {
                        ...file,
                        uniqueName: itemFound ? itemFound.unique_name : generateUniqueName(file, req.body, namespace, toWebp),
                        fileInfo,
                        toWebp,
                        catalogItem: itemFound
                    }
                ],
                invalidFiles
            };
        },
        Promise.resolve({
            validFiles: [],
            invalidFiles: invalidFilesFromLocal
        })
    );

    if (!validFiles.length && !req.files) {
        return sendResponse({ res, status: 400, errors: invalidFiles });
    }

    res.locals = { ...res.locals, validFiles, invalidFiles };
    next();
};

const _checkFilesInCatalog = async (files: any[], invalidFilesFromNamespace) => {
    return await files.reduce(
        async (accumulator, file) => {
            const { validFiles, invalidFiles } = await accumulator;
            const itemFound = await findFileInCatalog(file.uuid, 'uuid');
            if (!itemFound) {
                return {
                    validFiles,
                    invalidFiles: [...invalidFiles, { ...file, message: 'Not found in catalog' }]
                };
            }
            return {
                validFiles: [...validFiles, { ...file, catalogItem: itemFound }],
                invalidFiles
            };
        },
        Promise.resolve({
            validFiles: [],
            invalidFiles: invalidFilesFromNamespace
        })
    );
};

export const validatorCatalog = async (req: Request, res: Response, next: NextFunction) => {
    const { validFiles: validFilesFromLocal, invalidFiles: invalidFilesFromLocal } = res.locals;
    const { validFiles, invalidFiles } = await _checkFilesInCatalog(validFilesFromLocal?.length ? validFilesFromLocal : req.body, invalidFilesFromLocal || []);
    if (!validFiles.length) {
        return sendResponse({ res, status: 400, errors: invalidFiles });
    }
    res.locals = { ...res.locals, validFiles, invalidFiles };
    next();
};
