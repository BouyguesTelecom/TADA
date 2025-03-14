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
                await redisClient.connect();
                logger.info('Connected to Redis and ready for operations.');
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
        return await redisClient.get(key);
    }

    public async setAsync(key: string, value: string): Promise<string | null> {
        return await redisClient.set(key, value);
    }

    public async delAsync(key: string): Promise<number> {
        return await redisClient.del(key);
    }

    public async keysAsync(pattern: string): Promise<string[]> {
        return await redisClient.keys(pattern);
    }

    public async generateDump(): Promise<string> {
        return redisClient.save();
    }
}

export const redisHandler = RedisHandler.getInstance();
