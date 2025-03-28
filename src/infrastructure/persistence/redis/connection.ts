import { createClient } from '@redis/client';
import { logger } from '../../../utils/logs/winston';

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_SERVICE || 'localhost',
        port: 6379
    },
    legacyMode: false
});

redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${err.message}`);
});

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

export class RedisHandler {
    private static instance: RedisHandler;

    private constructor() {}

    public static getInstance(): RedisHandler {
        if (!RedisHandler.instance) {
            RedisHandler.instance = new RedisHandler();
        }
        return RedisHandler.instance;
    }

    public async connectClient(): Promise<void> {
        try {
            if (!redisClient.isOpen) {
                logger.info('Attempting to connect to Redis...');
                await redisClient.connect();
                logger.info('Connected to Redis and ready for operations.');
            } else {
                logger.info('Redis client already connected');
            }
        } catch (err) {
            logger.error(`Error connecting to Redis: ${err.message}`);
            throw new Error('Failed to connect to Redis');
        }
    }

    public async disconnectClient(): Promise<void> {
        if (redisClient.isOpen) {
            await redisClient.disconnect();
            logger.info('Connection to Redis closed.');
        }
    }

    public async getAsync(key: string): Promise<string | null> {
        try {
            logger.info(`Getting key: ${key}`);
            const result = await redisClient.get(key);
            logger.info(`Got key: ${key}, result: ${result ? 'exists' : 'not found'}`);
            return result;
        } catch (err) {
            logger.error(`Error getting key ${key}: ${err.message}`);
            throw err;
        }
    }

    public async setAsync(key: string, value: string): Promise<string | null> {
        try {
            logger.info(`Setting key: ${key}`);
            const result = await redisClient.set(key, value);
            logger.info(`Set key: ${key}, result: ${result}`);
            return result;
        } catch (err) {
            logger.error(`Error setting key ${key}: ${err.message}`);
            throw err;
        }
    }

    public async delAsync(key: string): Promise<number> {
        try {
            logger.info(`Deleting key: ${key}`);
            const result = await redisClient.del(key);
            logger.info(`Deleted key: ${key}, result: ${result}`);
            return result;
        } catch (err) {
            logger.error(`Error deleting key ${key}: ${err.message}`);
            throw err;
        }
    }

    public async keysAsync(pattern: string): Promise<string[]> {
        try {
            logger.info(`Getting keys with pattern: ${pattern}`);
            const result = await redisClient.keys(pattern);
            logger.info(`Got keys with pattern ${pattern}, count: ${result.length}`);
            return result;
        } catch (err) {
            logger.error(`Error getting keys with pattern ${pattern}: ${err.message}`);
            throw err;
        }
    }

    public async generateDump(): Promise<string> {
        try {
            logger.info('Generating Redis dump...');
            const result = await redisClient.save();
            logger.info('Redis dump generated successfully');
            return result;
        } catch (err) {
            logger.error(`Error generating Redis dump: ${err.message}`);
            throw err;
        }
    }
}

export const redisHandler = RedisHandler.getInstance();
