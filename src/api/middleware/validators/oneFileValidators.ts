import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { getCatalogItem } from '../../catalog';
import { getUniqueName } from '../../utils';
import { deleteFile, returnDefaultImage } from '../../utils/file';
import { checkMissingParam, checkNamespace, fileIsTooLarge, generateUniqueName, sendResponse } from './utils';
import { isFileNameInvalid, storage } from './utils/multer';
import { logger } from '../../utils/logs/winston';

export const validatorNamespace = async (req: Request, res: Response, next: NextFunction) => {
    const namespace = req.body.namespace;
    const namespaceValid = checkNamespace(namespace);
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
    const uniqueName = generateUniqueName(file, req.body, namespace, toWebp);
    const fileUUID = uuid ? uuid : await crypto.createHash('md5').update(uniqueName).digest('hex');
    const { datum: itemFound } = await getCatalogItem({ uuid: fileUUID });
    if (itemFound) {
        if (req.method === 'PATCH' && file) {
            const imageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

            const isOriginalImageOrPdfSvg = ['application/pdf', 'image/svg+xml'].includes(itemFound.original_mimetype);
            const isOriginalWithoutConversion = itemFound.mimetype === itemFound.original_mimetype;
            const isReplacementImage = imageMimeTypes.includes(file.mimetype);
            const canConvertToWebp = req.body.toWebp !== 'false';

            if (isOriginalImageOrPdfSvg) {
                if (file.mimetype !== itemFound.original_mimetype || (!canConvertToWebp && itemFound.mimetype === 'image/webp')) {
                    return sendResponse({
                        res,
                        status: 400,
                        errors: [`Mimetypes are not the same or conversion not allowed`]
                    });
                }
            } else if (isOriginalWithoutConversion) {
                if (file.mimetype !== itemFound.original_mimetype) {
                    return sendResponse({
                        res,
                        status: 400,
                        errors: [`Replacement not allowed for files without conversion`]
                    });
                }
            } else {
                if (!isReplacementImage || !canConvertToWebp) {
                    return sendResponse({
                        res,
                        status: 400,
                        errors: [`Mimetypes are not the same or conversion not allowed`]
                    });
                }
            }
        }

        if (req.method === 'POST') {
            return sendResponse({
                res,
                status: 400,
                errors: ['File already exists in catalog, please use patch instead.']
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
    res.locals = {
        ...res.locals,
        uniqueName: itemFound?.unique_name || uniqueName,
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
        return next();
    }
    return sendResponse({
        res,
        status: 400,
        errors: [`No file detected`]
    });
};

export const validatorFileSize = async (req: Request, res: Response, next: NextFunction) => {
    const { uuid, namespace, file } = res.locals;
    const fileTooLarge = await fileIsTooLarge(file, { uuid, namespace }, req.method);
    if (fileTooLarge) {
        await deleteFile(file.path);
        return sendResponse({ res, status: 400, errors: [fileTooLarge] });
    }
    next();
};

export const generateFileInfo = (body, method = 'PATCH') => {
    const keysAllowed = [
        'external_id',
        'expired',
        'expiration_date',
        'information',
        'signature',
        'namespace',
        'size',
        'base_host',
        'base_url',
        'uploaded_date',
        'updated_date',
        ...(method === 'POST' ? ['destination'] : [])
    ];
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
    const fileInfo = generateFileInfo(req.body, req.method);
    res.locals.fileInfo = fileInfo;
    res.locals.toWebp = process.env.CONVERT_TO_WEBP ? req.body.toWebp !== 'false' : req.body.toWebp !== 'true';
    next();
};

export const validatorGetAsset = async (req: Request, res: Response, next: NextFunction) => {
    const urlWithoutQueryParams = req.url.split('?')[0];
    const { version } = req.query;
    const uniqueName = getUniqueName(urlWithoutQueryParams, req.params.format);

    if (uniqueName === '/default.svg' || uniqueName === '/error.svg') {
        return returnDefaultImage(res, uniqueName);
    }

    const findCatalogItem = async (searchUniqueName: string) => {
        const redisKeyMD5 = crypto.createHash('md5').update(searchUniqueName).digest('hex');
        const { datum: file } = await getCatalogItem({ uuid: redisKeyMD5 });
        return file;
    };

    const buildRedirectUrl = (baseUrl: string, originalFilename: string, currentFilename: string) => {
        const originalUrl = baseUrl.replace(currentFilename, originalFilename);
        const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        return originalUrl + queryString;
    };

    try {
        const file = await findCatalogItem(uniqueName);
        const isOriginalRoute = req.url.includes('/original/');
        const isImageFile = !['application/pdf', 'image/svg+xml'].includes(file?.mimetype);
        if (file && (!isOriginalRoute || !isImageFile) && checkNamespace(file.namespace)) {
            res.locals = {
                ...res.locals,
                uniqueName,
                file,
                ...(version && { queryVersion: Number(version) })
            };
            return next();
        }

        const webpUniqueName = uniqueName.split('.')[0] + '.webp';
        const webpFile = await findCatalogItem(webpUniqueName);
        const signatureAreIdentical = webpFile?.signature === webpFile?.original_signature;
        if (!webpFile) {
            logger.info(`❌ No file found for: ${uniqueName} (WebP alternative: ${webpUniqueName})`);
            return res.status(404).end();
        }

        if (!checkNamespace(webpFile.namespace)) {
            logger.info(`❌ Namespace not allowed for: ${webpFile.namespace}`);
            return res.status(404).end();
        }

        if (isOriginalRoute && req.url.includes(webpFile.filename) && webpFile.original_filename !== webpFile.filename && !signatureAreIdentical) {
            const redirectUrl = buildRedirectUrl(urlWithoutQueryParams, webpFile.original_filename, webpFile.filename);
            logger.info(`🔄 Redirecting to original: ${urlWithoutQueryParams} → ${redirectUrl}`);
            return res.redirect(302, redirectUrl);
        }

        if (!isOriginalRoute && req.url.includes(webpFile.original_filename)) {
            const redirectUrl = buildRedirectUrl(urlWithoutQueryParams, webpFile.filename, webpFile.original_filename);
            logger.info(`🔄 Redirecting to WebP file: ${urlWithoutQueryParams} → ${redirectUrl}`);
            return res.redirect(302, redirectUrl);
        }

        logger.info(`✅ Serving ${isOriginalRoute ? 'original' : 'WebP'} file: ${isOriginalRoute ? uniqueName : webpUniqueName}`);
        res.locals = {
            ...res.locals,
            uniqueName: isOriginalRoute && !signatureAreIdentical ? uniqueName : webpUniqueName,
            file: webpFile,
            ...(version && { queryVersion: Number(version) }),
            original: isOriginalRoute && !signatureAreIdentical ? true : false
        };
        return next();
    } catch (error) {
        logger.error(`❌ Error in validatorGetAsset: ${error}`);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
