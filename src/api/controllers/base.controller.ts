import { Request, Response } from 'express';
import { ApiResponse } from '../../core/models/response.model';
import { logger } from '../../utils/logs/winston';

export abstract class BaseController {
    protected sendResponse(res: Response, response: ReturnType<typeof ApiResponse.success> | ReturnType<typeof ApiResponse.error>): void {
        res.status(response.status).json(response);
    }

    protected handleError(error: Error, res: Response): void {
        logger.error('Controller error:', error);
        this.sendResponse(res, ApiResponse.error(error.message));
    }

    protected validateRequest(req: Request, requiredFields: string[]): string | null {
        const missingFields = requiredFields.filter((field) => !req.body[field]);
        return missingFields.length > 0 ? `Missing required fields: ${missingFields.join(', ')}` : null;
    }
}
