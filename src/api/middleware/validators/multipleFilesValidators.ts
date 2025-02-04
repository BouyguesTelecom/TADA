import multer from 'multer';
import { isFileNameInvalid, storage } from './utils/multer';
import { fileIsTooLarge, generateUniqueName, sendResponse } from './utils';
import { generateFileInfo } from './oneFileValidators';
import { NextFunction, Request, Response } from 'express';
import { getCachedCatalog } from '../../catalog/redis/connection';

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
                    const message = mimeTypeIsAllowed ? errorFileName : `File type ${ file.mimetype } unauthorized.`;
                    return {
                        ...acc,
                        invalidFiles: [ ...invalidFiles, { ...file, message, uuid } ]
                    };
                }

                return {
                    validFiles: [ ...validFiles, { ...file, uuid } ],
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

    if (req.method === 'POST') {
        const { contentType } = res.locals;

        if (contentType === 'multipart/form-data') {
            const uuidsFromBody = req.body.uuids;
            if (!uuidsFromBody) {
                return sendResponse({
                    res,
                    status: 400,
                    errors: [ 'No uuids provided' ]
                });
            }
            const numberOfFiles = req.files.length;
            const uuids = uuidsFromBody.split(',');

            if (numberOfFiles !== uuids.length) {
                return sendResponse({
                    res,
                    status: 400,
                    errors: [ 'Number of UUIDs and number of files provided different' ]
                });
            }
            res.locals.uuids = uuidsFromBody;
        }
        return next()
    }
    const { invalidFiles: invalidFilesFromLocal, validFiles: validFilesFromLocal } = res.locals;

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
                        invalidFiles: [ ...invalidFiles, fileTooLarge ],
                        validFiles
                    };
                }
                return { invalidFiles, validFiles: [ ...validFiles, file ] };
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
            errors: [ `Body has to be an array` ]
        });
    }

    const { namespace, validFiles: validFilesFromLocal, invalidFiles: invalidFilesFromLocal } = res.locals;
    console.log('Dans validatorFilesBody ===>', namespace, validFilesFromLocal, invalidFilesFromLocal);
    const toWebp = req.body.toWebp !== 'false';

    const { validFiles, invalidFiles } = await validFilesFromLocal.reduce(
        async (accumulator, file) => {
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
            const fileInfo: Object = generateFileInfo(Array.isArray(req.body) ? file : req.body, req.method);
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
                        uniqueName: file.catalogItem ?
                            file.catalogItem.unique_name :
                            generateUniqueName(file, req.body, namespace, toWebp),
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
    console.log('WHAT THE FUCK ? ===>', validFiles, invalidFiles);
    if (!validFiles.length && !req.files) {
        return sendResponse({ res, status: 400, errors: invalidFiles });
    }

    res.locals = { ...res.locals, validFiles, invalidFiles };
    next();
};

export const validatorCatalog = async (req: Request, res: Response, next: NextFunction) => {
    const { validFiles: validFilesFromLocal, invalidFiles: invalidFilesFromLocal, uuids } = res.locals;
    console.log('IN VALIDATOR CATALOG => ', validFilesFromLocal, invalidFilesFromLocal, '<== HIHI 🥒', uuids);
    const { validFiles, invalidFiles } = validFilesFromLocal.reduce(async (accumulator, file) => {
            const { validFiles, invalidFiles } = await accumulator;
            if (req.method === 'POST') {
                console.log('je veux recup le catalog avec ID:::', file.uuid, file);
                if (!await getCachedCatalog(file.uuid)) {
                    return {
                        validFiles: [ ...validFiles, file ],
                        invalidFiles
                    };
                }
                return {
                    validFiles,
                    invalidFiles: [ ...invalidFiles, { ...file, message: 'UUID already exists' } ]
                };
            }

            for ( const uuid of uuids ) {
                console.log(uuid, 'uuid and uuids =>', uuids);
                if (await getCachedCatalog(uuid)) {
                    return {
                        validFiles: [ ...validFiles, file ],
                        invalidFiles
                    };
                }
                return {
                    validFiles,
                    invalidFiles: [ ...invalidFiles, { ...file, message: 'UUID not found' } ]
                };
            }

        },
        Promise.resolve({
            validFiles: [],
            invalidFiles: invalidFilesFromLocal
        })
    );

    if (!validFiles?.length) {
        console.log('Jenvoie une 400 BANDE DE LOOSERS 🏄🏽', { errors: invalidFiles });
        return sendResponse({ res, status: 400, errors: invalidFiles });
    }
    res.locals = { ...res.locals, validFiles, invalidFiles };
    next();
};
