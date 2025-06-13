import { Request, Response } from 'express';
import { logger } from '../../utils/logs/winston';
import { globalQueue } from './inMemoryQueue';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout exceeded')), timeoutMs);
        promise
            .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

export const queueMiddleware = (handler: (req: Request, res: Response) => Promise<void>) => {
    return (req: Request, res: Response) => {
        globalQueue.add(async () => {
            try {
                await withTimeout(handler(req, res), parseInt(process.env.REQUEST_TIMEOUT || '', 10) || 120000);
            } catch (err) {
                logger.error('Job timeout ou erreur :', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Erreur ou timeout dans le traitement de la requête' });
                }
            }
        });
    };
};
