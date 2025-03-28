import { NextFunction, Request, Response } from 'express';
import { BaseMiddleware } from './base.middleware';

export class TimeoutMiddleware extends BaseMiddleware {
    private readonly baseTimeout: number;
    private readonly maxPayloadSize: number;

    constructor() {
        super();
        this.baseTimeout = Number(process.env.BASE_TIMEOUT_MS) || 1000;
        this.maxPayloadSize = this.parsePayloadSize(process.env.PAYLOAD_MAX_SIZE || '10mb');
    }

    private parsePayloadSize(size: string): number {
        const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
        const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
        if (!match) throw new Error('Invalid payload size format');
        return parseInt(match[1], 10) * units[match[2]];
    }

    protected async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        const timeout = (this.baseTimeout * (this.maxPayloadSize / (1024 * 1024))) / 2;

        req.setTimeout(timeout, () => {
            if (!res.headersSent) {
                res.status(408).json({ error: 'Request timeout' });
            }
        });

        res.on('timeout', () => {
            res.status(408).json({ error: 'Request timeout' });
        });

        next();
    }
}

export const timeoutMiddleware = new TimeoutMiddleware().handle;
