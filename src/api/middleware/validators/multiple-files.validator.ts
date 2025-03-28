import { NextFunction, Request, Response } from 'express';
import { findFileInCatalog } from '../../../utils/catalog';
import { BaseValidator } from './base.validator';

interface FileValidationResult {
    validFiles: Express.Multer.File[];
    invalidFiles: Array<{
        filename?: string;
        size?: number;
        message: string;
        uuid?: string;
    }>;
}

export class MultipleFilesValidator extends BaseValidator {
    async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { namespace } = req.params;
        const files = req.files as Express.Multer.File[];
        const { uuids } = req.body;

        // namespace validation
        if (!this.validateNamespace(namespace)) {
            this.sendResponse(res, {
                success: false,
                message: `Namespace ${namespace} is not allowed.`
            });
            return;
        }

        // required params validation
        const missingParams = this.validateRequiredParams(['uuids'], req.body);
        if (missingParams.length > 0) {
            this.sendResponse(res, {
                success: false,
                message: `Missing required parameters: ${missingParams.join(', ')}`
            });
            return;
        }

        // files and uuids length validation
        const uuidArray = uuids.split(',');
        if (files.length !== uuidArray.length) {
            this.sendResponse(res, {
                success: false,
                message: 'Number of UUIDs and number of files provided different'
            });
            return;
        }

        // initial files validation
        const initialValidation = await this.validateFiles(files, uuidArray);
        if (initialValidation.invalidFiles.length > 0) {
            this.sendResponse(res, {
                success: false,
                message: 'Some files are invalid',
                data: initialValidation.invalidFiles
            });
            return;
        }

        // catalog validation
        const catalogValidation = await this.validateCatalog(initialValidation.validFiles, uuidArray);
        if (catalogValidation.invalidFiles.length > 0) {
            this.sendResponse(res, {
                success: false,
                message: 'Some files are not found in catalog',
                data: catalogValidation.invalidFiles
            });
            return;
        }

        // unique names generation
        const { validFiles, invalidFiles } = await this.generateUniqueNames(catalogValidation.validFiles, req.body, namespace);

        if (invalidFiles.length > 0) {
            this.sendResponse(res, {
                success: false,
                message: 'Some files could not be processed',
                data: invalidFiles
            });
            return;
        }

        // add validated data to the request
        req.body.validFiles = validFiles;
        req.body.invalidFiles = [];

        next();
    }

    private async validateFiles(files: Express.Multer.File[], uuids: string[]): Promise<FileValidationResult> {
        const result: FileValidationResult = {
            validFiles: [],
            invalidFiles: []
        };

        const allowedMimetypes = process.env.VALID_MIMETYPES?.split(',');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uuid = uuids[i];
            const errors: string[] = [];

            // file size validation
            const fileSizeError = await this.validatorUtils.fileIsTooLarge(file, { namespace: '', uuid }, 'POST');
            if (fileSizeError) {
                errors.push(fileSizeError.message);
            }

            // file name validation
            const fileNameInvalid = this.validateFileName(file);
            if (fileNameInvalid) {
                errors.push(fileNameInvalid);
            }

            // mime type validation
            if (allowedMimetypes?.length && !allowedMimetypes.includes(file.mimetype)) {
                errors.push(`File type ${file.mimetype} unauthorized`);
            }

            if (errors.length > 0) {
                result.invalidFiles.push({
                    filename: file.filename,
                    size: file.size,
                    message: errors.join(', '),
                    uuid
                });
            } else {
                result.validFiles.push(file);
            }
        }

        return result;
    }

    private async validateCatalog(files: Express.Multer.File[], uuids: string[]): Promise<FileValidationResult> {
        const result: FileValidationResult = {
            validFiles: [],
            invalidFiles: []
        };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uuid = uuids[i];
            const itemFound = await findFileInCatalog(uuid, 'uuid');

            if (!itemFound) {
                result.invalidFiles.push({
                    filename: file.filename,
                    message: 'Not found in catalog',
                    uuid
                });
            } else {
                result.validFiles.push(file);
            }
        }

        return result;
    }

    private async generateUniqueNames(files: Express.Multer.File[], body: any, namespace: string): Promise<FileValidationResult> {
        const result: FileValidationResult = {
            validFiles: [],
            invalidFiles: []
        };

        const toWebp = body.toWebp !== 'false';

        for (const file of files) {
            const uniqueName = this.validatorUtils.generateUniqueName(file, body, namespace, toWebp);
            if (!uniqueName) {
                result.invalidFiles.push({
                    filename: file.filename,
                    message: 'Could not generate unique name'
                });
            } else {
                result.validFiles.push({
                    ...file,
                    uniqueName
                } as Express.Multer.File);
            }
        }

        return result;
    }
}
