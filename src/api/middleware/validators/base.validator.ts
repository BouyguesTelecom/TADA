import { NextFunction, Request, Response } from 'express';
import { logger } from '../../../utils/logs/winston';
import { ValidatorUtils } from './utils/validator.utils';

export interface ValidatorResponse {
    success: boolean;
    message: string;
    data?: any;
}

export abstract class BaseValidator {
    protected validatorUtils: ValidatorUtils;

    constructor() {
        this.validatorUtils = ValidatorUtils.getInstance();
    }

    abstract execute(req: Request, res: Response, next: NextFunction): Promise<void>;

    handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        return this.execute(req, res, next).catch((error) => {
            logger.error('Validator error:', error);
            this.sendResponse(res, {
                success: false,
                message: 'Internal server error during validation'
            });
        });
    }

    protected sendResponse(res: Response, response: ValidatorResponse): void {
        const statusCode = response.success ? 200 : 400;
        res.status(statusCode).json(response);
    }

    protected validateNamespace(namespace: string): boolean {
        return this.validatorUtils.checkNamespace(namespace);
    }

    protected validateRequiredParams(requiredParams: string[], params: Record<string, any>): string[] {
        return this.validatorUtils.checkMissingParam(requiredParams, params);
    }

    protected validateFileSize(file: Express.Multer.File, maxSize: number = 10000000): boolean {
        return file && file.size <= maxSize;
    }

    protected validateFileName(file: Express.Multer.File): string | false {
        return this.validatorUtils.isFileNameInvalid(file);
    }
}
