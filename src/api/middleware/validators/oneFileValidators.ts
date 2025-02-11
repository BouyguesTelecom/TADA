import { checkMissingParam, checkNamespace, fileIsTooLarge, generateUniqueName, sendResponse } from './utils';
import multer from 'multer';
import { storage, isFileNameInvalid } from './utils/multer';
import { deleteFile } from '../../utils/file';
import { getUniqueName } from '../../utils';
import { findFileInCatalog } from '../../utils/catalog';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logs/winston';
import { redisHandler } from '../../catalog/redis/connection';

export const validatorNamespace = async (req: Request, res: Response, next: NextFunction) => {
    const namespace = req.body.namespace;
    const namespaceValid = checkNamespace({ namespace: namespace });
    if (!namespaceValid) {
        return sendResponse({
            res,
            status: 401,
            errors: ['invalid namespace']
        });
    }
    res.locals.namespace = namespace;
    next();
};

export const validatorParams = async (req: Request, res: Response, next: NextFunction) => {
    const requiredParams = ['uuid'];
    const params = req.params;

    const missingParams = checkMissingParam({ requiredParams, params });
    if (missingParams.length) {
        return sendResponse({ res, status: 401, errors: missingParams });
    }
    res.locals.uuid = params.uuid;
    next();
};

export const validatorFileCatalog = async (req: Request, res: Response, next: NextFunction) => {
    const { uuid, namespace, toWebp, file } = res.locals;
    const uniqueName = file && generateUniqueName(file, req.body, namespace, toWebp);
    const itemFound = await findFileInCatalog(uuid ? uuid : uniqueName, uuid ? 'uuid' : 'unique_name');
    if (itemFound && req.method === 'PATCH' && file) {
        if (file.mimetype !== itemFound.original_mimetype && req.body.toWebp === 'false' && itemFound.mimetype === 'image/webp') {
            return sendResponse({
                res,
                status: 400,
                errors: [`Mimetypes are not the same`]
            });
        }
    }
    if (!itemFound && req.method !== 'POST') {
        return sendResponse({
            res,
            status: 404,
            errors: [`Item not found in catalog with namespace ${namespace} and UUID ${uuid}`]
        });
    }

    if (itemFound && req.method === 'POST') {
        return sendResponse({
            res,
            status: 400,
            errors: ['File already exists in catalog, please use patch instead.']
        });
    }
    res.locals = {
        ...res.locals,
        uniqueName: uniqueName ? uniqueName : itemFound.unique_name,
        itemToUpdate: itemFound
    };
    next();
};

export const validatorFile = multer({
    storage: storage
}).single('file');

export const validatorFileFilter = async (req: Request, res: Response, next: NextFunction) => {
    const fileFromMulter = req.file;
    if (fileFromMulter) {
        const allowedMimetypes = process.env.VALID_MIMETYPES?.split(',');
        const mimeTypeIsAllowed = allowedMimetypes.length ? allowedMimetypes.includes(fileFromMulter.mimetype) : true;
        const errorFileName = isFileNameInvalid(fileFromMulter);

        if (errorFileName || !mimeTypeIsAllowed) {
            return sendResponse({
                res,
                status: 400,
                errors: [mimeTypeIsAllowed ? errorFileName : `File type ${fileFromMulter.mimetype} unauthorized.`]
            });
        }
        res.locals.file = req.file;
    }
    next();
};

export const validatorFileSize = async (req: Request, res: Response, next: NextFunction) => {
    const { uuid, namespace, file } = res.locals;
    if (file) {
        const fileTooLarge = await fileIsTooLarge(file, { uuid, namespace }, req.method);
        if (fileTooLarge) {
            await deleteFile(file.path);
            return sendResponse({ res, status: 400, errors: [fileTooLarge] });
        }
    }
    next();
};

export const generateFileInfo = (body, method = 'PATCH') => {
    const keysAllowed = ['external_id', 'expired', 'expiration_date', 'information', 'signature', 'namespace', 'size', 'base_host', 'base_url', ...(method === 'POST' ? ['destination'] : [])];
    const bodyKeys = Object.keys(body.changes ?? body);
    const hasAllowedKey = bodyKeys.some((key) => keysAllowed.includes(key));
    if (hasAllowedKey) {
        const fileInfo = {};
        for (let key of bodyKeys) {
            if (keysAllowed.includes(key)) {
                fileInfo[key] = body.changes ? body.changes[key] : body[key];
            }
        }
        return fileInfo;
    }
    return null;
};

export const validatorFileBody = async (req: Request, res: Response, next: NextFunction) => {
    const { contentType } = res.locals;
    if (contentType === 'application/json' && Array.isArray(req.body)) {
        return sendResponse({
            res,
            status: 400,
            errors: [`Body has to be of type object`]
        });
    }
    const fileInfo = generateFileInfo(req.body, req.method);
    if (!fileInfo && !req.file) {
        return sendResponse({
            res,
            status: 400,
            errors: [`No allowed changes detected`]
        });
    }
    res.locals.fileInfo = fileInfo;
    res.locals.toWebp = req.body.toWebp !== 'false';
    next();
};

export const validatorGetAsset = async (req: Request, res: Response, next: NextFunction) => {
    const allowedNamespaces = process.env.NAMESPACES?.split(',');
    const uniqueName = getUniqueName(req.url, `/${req.params.format}`);
    let cleanUniqueName = uniqueName;

    if (req.params.format === 'optimise') {
        cleanUniqueName = uniqueName.replace(/\/[^/]+\//, '/');
    }

    const uniqueNameFinal = cleanUniqueName
        .split('/')
        .filter((item) => item.length > 0)
        .join('/');
    const file = await findFileInCatalog(`/${uniqueNameFinal}`, 'unique_name');
    const namespace = file?.namespace || null;

    if (!allowedNamespaces?.includes(namespace) || !file) {
        return res.status(404).end();
    }
    res.locals = { ...res.locals, uniqueName: `/${uniqueNameFinal}`, file };
    next();
};
