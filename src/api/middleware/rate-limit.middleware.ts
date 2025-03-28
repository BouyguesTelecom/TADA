import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { BaseMiddleware } from './base.middleware';

export class RateLimitMiddleware extends BaseMiddleware {
    private readonly limiter: any;

    constructor() {
        super();
        this.limiter = rateLimit({
            windowMs: Number(process.env.DELEGATED_STORAGE_RATE_LIMIT_WINDOW),
            limit: Number(process.env.DELEGATED_STORAGE_RATE_LIMIT),
            message: { error: 'Too many requests, please try again later' },
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            keyGenerator: (req: Request) => req.originalUrl
        });
    }

    protected async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        return this.limiter(req, res, next);
    }
}

export const rateLimitMiddleware = new RateLimitMiddleware().handle;
