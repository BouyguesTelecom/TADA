import { NextFunction, Request, Response } from 'express';
import { redisHandler } from '../../infrastructure/persistence/redis/connection';
import { logger } from '../../utils/logs/winston';
import { BaseMiddleware } from './base.middleware';

export class RedisMiddleware extends BaseMiddleware {
    private static isConnected = false;

    protected async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE') {
            return next();
        }

        try {
            if (!RedisMiddleware.isConnected) {
                logger.info('Initializing Redis connection...');
                await redisHandler.connectClient();
                RedisMiddleware.isConnected = true;
                logger.info('Redis connection established');

                // Disconnect from Redis when the application shuts down
                process.on('SIGTERM', async () => {
                    logger.info('Application shutting down, closing Redis connection...');
                    await redisHandler.disconnectClient();
                    RedisMiddleware.isConnected = false;
                });
            }

            next();
        } catch (error) {
            logger.error(`Redis connection error: ${error.message}`);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const redisMiddleware = new RedisMiddleware().handle;
