import { NextFunction, Request, Response } from 'express';
import { redisHandler } from '../../infrastructure/persistence/redis/connection';
import { logger } from '../../utils/logs/winston';

export const redisConnectionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE') {
        return next();
    }
    try {
        await redisHandler.connectClient();

        res.on('finish', async () => {
            if (!req.url.includes('delegated-storage')) {
                await redisHandler.disconnectClient();
            }
        });

        next();
    } catch (error) {
        logger.error(`Redis connection error: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
