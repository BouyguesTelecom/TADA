import { createClient } from '@redis/client';
import { logger } from '../../utils/logs/winston';
import { getCatalog } from '../index';

let inMemoryCatalogCache = {};

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_SERVICE || 'localhost',
        port: 6379
    },
    legacyMode: false
});

redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${ err.message } ${JSON.stringify(err)}`);
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
    } catch ( err ) {
        logger.error(`Error connecting to Redis: ${ err.message }`);
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
    console.log('GET ASYNC REDIS', key)
    return await redisClient.get(key);
};

const setAsync = async (key, value) => {
    console.log('SET ASYNC REDIS', key)
    return await redisClient.set(key, value);
};

const delAsync = async (key) => {
    console.log('DEL ASYNC REDIS', key)
    return await redisClient.del(key);
};

const keysAsync = async (pattern) => {
    console.log('keys ASYNC REDIS', pattern)
    return await redisClient.keys(pattern);
};

const generateDump = async () => redisClient.save();

export const updateCacheCatalog = async () => {
    console.log("Updating catalog cache... 🔆");
    try {
        const { data: catalog } = await getCatalog();
        if (!catalog || catalog.length === 0) {
            console.error("Empty catalog or not valid");
            await redisHandler.setAsync('catalogCached', JSON.stringify({}));
            inMemoryCatalogCache = {};
            return;
        }

        const validCatalog = catalog.filter(item => item && item.uuid);

        if (validCatalog.length === 0) {
            console.error("No item found in catalog");
            await redisHandler.setAsync('catalogCached', JSON.stringify({}));
            inMemoryCatalogCache = {};
            return;
        }

        const catalogObjectUUID = validCatalog.reduce((acc, item) => {
            acc[item.uuid] = item;
            return acc;
        }, {});

        await delAsync('catalogCached');
        await setAsync('catalogCached', JSON.stringify(catalogObjectUUID));
        inMemoryCatalogCache = catalogObjectUUID;

    } catch (error) {
        console.error("Erreur lors de la mise à jour du cache du catalogue:", error);
    }
};

export const getCachedCatalog = async (id = null) => {
    console.log('GET CACHED CATALOG')
    try {
        const catalog = inMemoryCatalogCache;
        if (id) {
            return catalog[id];
        }
        return catalog;
    } catch (error) {
        console.error("Erreur lors de la récupération du catalogue en cache:", error);
        return null;
    }
};

export const redisHandler = {
    connectClient,
    disconnectClient,
    getAsync,
    setAsync,
    delAsync,
    keysAsync,
    generateDump,
    redisClient
};
