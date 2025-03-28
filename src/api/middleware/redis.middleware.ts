import { NextFunction, Request, Response } from 'express';
import { redisHandler } from '../../infrastructure/persistence/redis/connection';
import { logger } from '../../utils/logs/winston';
import { BaseMiddleware } from './base.middleware';

export class RedisMiddleware extends BaseMiddleware {
    protected async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE') {
            return next();
        }

        try {
            logger.info('Connecting to Redis...');
            await redisHandler.connectClient();
            logger.info('Connected to Redis successfully');

            res.on('finish', async () => {
                try {
                    logger.info('Disconnecting from Redis...');
                    await redisHandler.disconnectClient();
                    logger.info('Disconnected from Redis successfully');
                } catch (error) {
                    logger.error(`Error disconnecting from Redis: ${error.message}`);
                }
            });

            next();
        } catch (error) {
            logger.error(`Redis connection error: ${error.message}`);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const redisMiddleware = new RedisMiddleware().handle;
