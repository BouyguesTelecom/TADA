import { Request, Response, NextFunction } from 'express';
import { redisHandler } from '../catalog/redis/connection';
import { logger } from '../utils/logs/winston';

export const redisConnectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE') {
        return next();
    }

    if (!redisHandler.redisClient.isOpen) {
        logger.error("Redis connection not open");
        res.status(500).json({ error: 'Redis connection not open' });
        return;
    }

    next();
};

