import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { getCatalogItem } from '../../catalog';
import { generateFileInfo } from './oneFileValidators';
import { fileIsTooLarge, generateUniqueName, sendResponse } from './utils';
import { isFileNameInvalid, storage } from './utils/multer';

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
    next();
};

export const validatorUUIds = async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'PATCH' || req.method === 'DELETE') {
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

        if (contentType === 'application/json') {
            if (Array.isArray(req.body)) {
                const { validFiles, invalidFiles } = await req.body.reduce(
                    async (acc, file, index) => {
                        const { validFiles, invalidFiles } = await acc;
                        const { datum: catalogFile } = await getCatalogItem({ uuid: file.uuid });
                        if (catalogFile) {
                            return {
                                validFiles: [...validFiles, { ...file, catalogItem: catalogFile }],
                                invalidFiles
                            };
                        }
                        return {
                            validFiles,
                            invalidFiles: [...invalidFiles, { ...file, message: 'UUID not found' }]
                        };
                    },
                    Promise.resolve({ validFiles: [], invalidFiles: [] })
                );
                if (!validFiles.length) {
                    return sendResponse({ res, status: 400, errors: invalidFiles });
                }
                res.locals = { ...res.locals, validFiles, invalidFiles };
                return next();
            }
        }

        return next();
    }

    return next();
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
    if (req.method === 'DELETE') {
        return next();
    }
    const { namespace, validFiles: validFilesFromLocal, invalidFiles: invalidFilesFromLocal } = res.locals;
    const toWebp = req.body.toWebp !== 'false';

    const { validFiles, invalidFiles } = await validFilesFromLocal.reduce(
        async (accumulator, file, index) => {
            const { validFiles, invalidFiles } = await accumulator;

            if (file.catalogItem && req.method === 'POST') {
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
            const fileInfo: Object = generateFileInfo(Array.isArray(req.body) ? req.body.find((item: any) => item.uuid === file.uuid) : req.body, req.method);

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
                        uniqueName: file.catalogItem ? file.catalogItem.unique_name : generateUniqueName(file, req.body, namespace, toWebp),
                        fileInfo,
                        toWebp
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

export const validatorCatalog = async (req: Request, res: Response, next: NextFunction) => {
    const { validFiles: validFilesFromLocal, invalidFiles: invalidFilesFromLocal, uuids } = res.locals;
    if ((req.method === 'PATCH' && !req.files) || req.method === 'DELETE') {
        return next();
    }
    const { validFiles, invalidFiles } = await validFilesFromLocal.reduce(
        async (accumulator, file) => {
            const { validFiles, invalidFiles } = await accumulator;
            if (req.method === 'POST') {
                const fileUUID = await crypto.createHash('md5').update(file.uniqueName).digest('hex');
                const { datum: catalogItem } = await getCatalogItem({ uuid: fileUUID });

                if (!catalogItem) {
                    return {
                        validFiles: [...validFiles, file],
                        invalidFiles
                    };
                }
                return {
                    validFiles,
                    invalidFiles: [...invalidFiles, { ...file, message: 'UUID already exists' }]
                };
            }
            if (req.method === 'PATCH') {
                const { datum: catalogItem } = await getCatalogItem({ uuid: file.uuid });
                if (catalogItem) {
                    return {
                        validFiles: [...validFiles, { ...file, catalogItem }],
                        invalidFiles
                    };
                }
                return {
                    validFiles,
                    invalidFiles: [...invalidFiles, { ...file, message: 'UUID does not exist' }]
                };
            }
        },
        Promise.resolve({
            validFiles: [],
            invalidFiles: invalidFilesFromLocal
        })
    );
    if (!validFiles?.length) {
        return sendResponse({ res, status: 400, errors: invalidFiles });
    }
    res.locals = { ...res.locals, validFiles, invalidFiles };
    next();
};
