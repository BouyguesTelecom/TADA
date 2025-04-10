import { Request, Response, NextFunction } from 'express';

const parsePayloadSize = (size: string): number => {
    const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
    if (!match) throw new Error('Invalid payload size format');
    return parseInt(match[1], 10) * units[match[2]];
};

export const timeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const baseTimeout = Number(process.env.BASE_TIMEOUT_MS) || 1500;
    const maxPayloadSize = parsePayloadSize(process.env.PAYLOAD_MAX_SIZE || '10mb');
    const timeout = (baseTimeout * (maxPayloadSize / (1024 * 1024))) / 2;

    req.setTimeout(timeout, () => {
        if (!res.headersSent) {
            return res.status(408).send('Request timeout').end();
        }
    });

    res.on('timeout', () => {
        return res.status(408).send('Request timeout').end();
    });

    next();
};
