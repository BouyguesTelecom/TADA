import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logs/winston';

const parsePayloadSize = (size: string): number => {
    const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
    if (!match) throw new Error('Invalid payload size format');
    return parseInt(match[1], 10) * units[match[2]];
};

export const timeoutMiddleware = (_req: Request, res: Response, next: NextFunction) => {
    const baseTimeout = Number(process.env.BASE_TIMEOUT_MS) || 3000;
    const maxPayloadSize = parsePayloadSize(process.env.PAYLOAD_MAX_SIZE || '10mb');
    const timeoutDuration = (baseTimeout * (maxPayloadSize / (1024 * 1024))) / 2;

    let timeoutHandler: any;

    const handleTimeout = () => {
        logger.info('Timeout occurred');
        if (res.getHeader('x-processing-image') === 'true') {
            logger.info('More processing time required, resetting timeout...(big size,...?)');
            resetTimeout();
        } else if (!res.headersSent) {
            res.status(408).send('Request timeout').end();
        }
    };

    const resetTimeout = () => {
        clearTimeout(timeoutHandler);
        timeoutHandler = setTimeout(handleTimeout, timeoutDuration);
    };

    resetTimeout();

    res.on('finish', () => {
        clearTimeout(timeoutHandler);
    });

    next();
};
