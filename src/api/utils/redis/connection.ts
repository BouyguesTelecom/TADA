import { createClient, RedisClientType } from '@redis/client';
import { logger } from '../logs/winston';

export const redisClient: RedisClientType = createClient({
    socket: {
        host: process.env.REDIS_SERVICE || 'localhost',
        port: 6379
    }
});

redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${err.message}`);
});

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

export const connectClient = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            logger.info('Connected to Redis and ready for operations.');
        }
    } catch (err) {
        logger.error(`Error connecting to Redis: ${err.message}`);
        throw new Error('Failed to connect to Redis');
    }
};

export const disconnectClient = async () => {
    if (redisClient.isOpen) {
        await redisClient.disconnect();
        logger.info('Connection to Redis closed.');
    }
};
