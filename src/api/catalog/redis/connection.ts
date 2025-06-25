import { createClient } from '@redis/client';
import { logger } from '../../utils/logs/winston';
import { getCatalog } from '../index';

// Cache mémoire simple et unifiéf
let memoryCache: Map<string, any> = new Map();
let isInitialized = false;

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_SERVICE || 'localhost',
        port: 6379
    },
    legacyMode: false
});

redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${err.message} ${JSON.stringify(err)}`);
});

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

const connectClient = async () => {
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

const disconnectClient = async () => {
    if (redisClient.isOpen) {
        await redisClient.disconnect();
        logger.info('Connection to Redis closed.');
    }
};

const getAsync = async (key) => {
    return await redisClient.get(key);
};

const setAsync = async (key, value) => {
    return await redisClient.set(key, value);
};

const delAsync = async (key) => {
    return await redisClient.del(key);
};

const keysAsync = async (pattern) => {
    return await redisClient.keys(pattern);
};

// SCAN from redis instead of KEYS
const scanAsync = async (pattern) => {
    const keys = [];
    let cursor = 0;

    do {
        const result = await redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 100
        });

        cursor = result.cursor;
        keys.push(...result.keys);
    } while (cursor !== 0);

    return keys;
};

const generateDump = async () => redisClient.save();

export const cache = {
    async init() {
        if (isInitialized) return;

        try {
            logger.info('Init cache.');
            const start = Date.now();

            const ids = await redisHandler.keysAsync('*');

            if (ids && ids.length) {
                const filesPromises = ids.map(async (id) => {
                    const file = await redisHandler.getAsync(id);
                    if (file && Object.keys(JSON.parse(file)).length) {
                        return JSON.parse(file);
                    }
                    return null;
                });

                const files = (await Promise.all(filesPromises)).filter(file => file !== null);

                memoryCache.clear();

                files.forEach(file => {
                    if (file && file.uuid) {
                        memoryCache.set(file.uuid, { ...file, id: file.uuid });
                    }
                });
            }

            isInitialized = true;
            logger.info(`Cache initialisé: ${memoryCache.size} fichiers en ${Date.now() - start}ms`);

        } catch (err) {
            logger.error(`Error listing items: ${err}`);
        }
    },

    async get(id: string) {
        await this.init();
        return memoryCache.get(id) || null;
    },

    async getAll() {
        await this.init();
        return Array.from(memoryCache.values());
    },

    async set(file: any) {
        const key = file.uuid;
        const data = { ...file, id: key };

        // Redis (persistance)
        await setAsync(key, JSON.stringify(file));

        // Mémoire (performance)
        memoryCache.set(key, data);

        logger.debug(`Cache updated: ${key}`);
    },

    async delete(id: string) {
        await delAsync(id);
        const deleted = memoryCache.delete(id);
        logger.debug(`Cache deleted: ${id}`);
        return deleted;
    }
};


export const redisHandler = {
    connectClient,
    disconnectClient,
    getAsync,
    setAsync,
    delAsync,
    keysAsync, // Deprecated - utiliser scanAsync
    scanAsync,
    generateDump,
    redisClient
};
