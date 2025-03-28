import { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logs/winston';
import { BaseMiddleware } from './base.middleware';

export class AuthMiddleware extends BaseMiddleware {
    private readonly mediaToken: string;

    constructor() {
        super();
        this.mediaToken = process.env.MEDIA_TOKEN || '';
    }

    protected async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (token === this.mediaToken) {
            return next();
        }

        logger.warn('Unauthorized access attempt');
        res.status(401).json({ error: 'You must be authenticated to do this' });
    }
}

export const authMiddleware = new AuthMiddleware().handle;
