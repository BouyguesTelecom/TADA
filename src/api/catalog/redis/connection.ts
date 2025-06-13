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

        logger.info('Init cache.');
        const start = Date.now();

        const keys = await scanAsync('file:*');
        memoryCache.clear();

        for (const key of keys) {
            const data = await getAsync(key);
            if (data) {
                const file = JSON.parse(data);
                memoryCache.set(file.uuid, { ...file, id: file.uuid });
            }
        }

        isInitialized = true;
        logger.info(`Cache initialised: ${memoryCache.size} files in ${Date.now() - start}ms`);
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

export const updateCacheCatalog = async () => {
    try {
        const { data: catalog } = await getCatalog();
        if (!catalog || catalog.length === 0) {
            await setAsync('catalogCached', JSON.stringify({}));
            return;
        }

        const validCatalog = catalog.filter((item) => item && item.uuid);

        if (validCatalog.length === 0) {
            await setAsync('catalogCached', JSON.stringify({}));
            logger.info('No file found');
            return;
        }

        const catalogObjectUUID = validCatalog.reduce((acc, item) => {
            acc[item.uuid] = item;
            return acc;
        }, {});

        await delAsync('catalogCached');
        await setAsync('catalogCached', JSON.stringify(catalogObjectUUID));

        logger.info(`Catalog updated with ${validCatalog.length} items`);
    } catch (error) {
        console.error('Error when updating catalog cache:', error);
    }
};

export const getCachedCatalog = async (id = null) => {
    try {
        const catalogData = await getAsync('catalogCached');

        if (!catalogData) {
            logger.warn('No catalog data found in cache');
        }

        const catalog = JSON.parse(catalogData);

        if (id) {
            return catalog[id];
        }
        return catalog;
    } catch (error) {
        console.error('Error when getting catalog from cache:', error);
        return null;
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
