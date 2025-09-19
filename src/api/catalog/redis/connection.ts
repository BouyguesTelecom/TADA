import { createClient } from '@redis/client';
import { logger } from '../../utils/logs/winston';

let memoryCache: Map<string, any> = new Map();

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

const saveDump = async () => {
    try {
        await redisClient.save();
        logger.info('Redis dump saved successfully');
        return { success: true };
    } catch (error) {
        logger.error(`Error saving Redis dump: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const bgsaveDump = async () => {
    try {
        await redisClient.bgSave();
        logger.info('Redis background save initiated');
        return { success: true };
    } catch (error) {
        logger.error(`Error initiating Redis background save: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const flushAllKeys = async () => {
    try {
        await redisClient.flushAll();
        logger.info('All Redis keys cleared successfully');
        return { success: true };
    } catch (error) {
        logger.error(`Error clearing Redis keys: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const restoreFromRdb = async (rdbBuffer: Buffer) => {
    try {
        const fs = await import('fs').then((m) => m.promises);
        const dumpPath = process.env.DUMP_FOLDER_PATH ? `${process.env.DUMP_FOLDER_PATH}/dump.rdb` : '/dumps/dump.rdb';

        const clearResult = await flushAllKeys();
        if (!clearResult.success) {
            return { success: false, error: clearResult.error };
        }

        await fs.writeFile(dumpPath, rdbBuffer);

        logger.info('RDB file saved, will be loaded on next Redis startup');

        return {
            success: true,
            message: `RDB file restored to ${dumpPath}. Redis will load it on next startup for full restoration.`,
            requiresRestart: true
        };
    } catch (error) {
        logger.error(`Error restoring from RDB: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const getDumpInfo = async () => {
    try {
        const info = await redisClient.info('persistence');
        const lines = info.split('\r\n');
        const dumpInfo = {};

        lines.forEach((line) => {
            if (line.includes('rdb_')) {
                const [key, value] = line.split(':');
                if (key && value !== undefined) {
                    dumpInfo[key] = value;
                }
            }
        });

        return { success: true, data: dumpInfo };
    } catch (error) {
        logger.error(`Error getting dump info: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const restoreFromDump = async (dumpPath?: string) => {
    try {
        logger.info(`To restore from dump: ${dumpPath || 'dump.rdb'}, restart Redis service`);
        return {
            success: true,
            message: 'To restore from dump, place dump.rdb file in Redis data directory and restart Redis service'
        };
    } catch (error) {
        logger.error(`Error in restore process: ${error.message}`);
        return { success: false, error: error.message };
    }
};

export const initializeCache = async () => {
    try {
        memoryCache.clear();
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

            const files = (await Promise.all(filesPromises)).filter((file) => file !== null);

            memoryCache.clear();

            files.forEach((file) => {
                if (file && file.uuid) {
                    memoryCache.set(file.uuid, file);
                }
            });
        }
        logger.info(`Cache initialisé: ${memoryCache.size} fichiers en ${Date.now() - start}ms`);
    } catch (err) {
        logger.error(`Error listing items: ${err}`);
    }
};

export const cache = {
    async get(id: string) {
        return memoryCache.get(id) || null;
    },

    async getAll() {
        return Array.from(memoryCache.values());
    },

    async set(file: any) {
        await setAsync(file.uuid, JSON.stringify(file));

        memoryCache.set(file.uuid, file);

        logger.debug(`Cache updated: ${file.uuid}`);
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
    keysAsync,
    scanAsync,
    generateDump,
    saveDump,
    bgsaveDump,
    getDumpInfo,
    restoreFromDump,
    flushAllKeys,
    restoreFromRdb,
    redisClient
};
