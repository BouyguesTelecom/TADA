import { NextFunction, Request, Response } from 'express';
import { findFileInCatalog } from '../../../utils/catalog';
import { BaseValidator } from './base.validator';

export class SingleFileValidator extends BaseValidator {
    async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);

        const namespace = req.params.namespace || req.body?.namespace;
        const { file } = req;
        const { destination, toWebp } = req.body || {};

        // namespace validation
        if (!namespace) {
            this.sendResponse(res, {
                success: false,
                message: 'Namespace is required'
            });
            return;
        }

        if (!this.validateNamespace(namespace)) {
            this.sendResponse(res, {
                success: false,
                message: `Namespace ${namespace} is not allowed.`
            });
            return;
        }

        // required params validation
        if (!file) {
            this.sendResponse(res, {
                success: false,
                message: 'File is required'
            });
            return;
        }

        // if a file is provided, validate its properties
        // file size validation
        const fileSizeError = await this.validatorUtils.fileIsTooLarge(file, { namespace, uuid: req.params.uuid }, req.method);
        if (fileSizeError) {
            this.sendResponse(res, fileSizeError);
            return;
        }

        // file name validation
        const fileNameInvalid = this.validateFileName(file);
        if (fileNameInvalid) {
            this.sendResponse(res, {
                success: false,
                message: fileNameInvalid
            });
            return;
        }

        // mime type validation
        const allowedMimetypes = process.env.VALID_MIMETYPES?.split(',');
        if (allowedMimetypes?.length && !allowedMimetypes.includes(file.mimetype)) {
            this.sendResponse(res, {
                success: false,
                message: `File type ${file.mimetype} unauthorized.`
            });
            return;
        }

        // catalog validation
        if (req.method === 'PATCH') {
            const { uuid } = req.params;
            const itemFound = await findFileInCatalog(uuid, 'uuid');

            if (!itemFound) {
                this.sendResponse(res, {
                    success: false,
                    message: `Item not found in catalog with UUID ${uuid}`
                });
                return;
            }

            if (file.mimetype !== itemFound.original_mimetype && toWebp === 'false' && itemFound.mimetype === 'image/webp') {
                this.sendResponse(res, {
                    success: false,
                    message: 'Mimetypes are not the same'
                });
                return;
            }

            req.body = req.body || {};
            req.body.catalogItem = itemFound;
        }

        // unique name generation
        const uniqueName = this.validatorUtils.generateUniqueName(file, req.body || {}, namespace, toWebp);
        if (!uniqueName) {
            this.sendResponse(res, {
                success: false,
                message: 'Invalid file data'
            });
            return;
        }

        // add validated data to the request
        req.body = req.body || {};
        req.body.uniqueName = uniqueName;
        req.body.destination = destination || '';

        next();
    }
}
