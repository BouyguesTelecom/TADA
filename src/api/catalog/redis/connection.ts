import { createClient } from '@redis/client';
import { logger } from '../../utils/logs/winston';
import { getCatalog } from '../index';

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_SERVICE || 'localhost',
        port: 6379
    },
    legacyMode: false
});

redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${ err.message }`);
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

const generateDump = async () => redisClient.save();

export const updateCacheCatalog = async () => {
    try {
        const { data: catalog } = await getCatalog();
        console.log('CATALOG WILL BE CACHED !', catalog);

        // Vérifiez si le catalogue existe et qu'il n'est pas vide
        if (!catalog || catalog.length === 0) {
            console.error("Catalogue est vide ou non valide");
            await redisHandler.setAsync('catalogCached', JSON.stringify({}));
            return;
        }

        // Filtrer les éléments invalides du catalogue
        const validCatalog = catalog.filter(item => item && item.uuid);

        if (validCatalog.length === 0) {
            console.error("Aucun élément valide trouvé dans le catalogue");
            await redisHandler.setAsync('catalogCached', JSON.stringify({}));
            return;
        }

        const catalogObjectUUID = validCatalog.reduce((acc, item) => {
            acc[item.uuid] = item;
            return acc;
        }, {});

        console.log('catalog update:', catalogObjectUUID);

        // Nettoyez le cache avant de mettre à jour
        await redisHandler.delAsync('catalogCached');

        // Mettez à jour le cache avec le nouveau catalogue
        await redisHandler.setAsync('catalogCached', JSON.stringify(catalogObjectUUID, null, 2));

        // Vérifiez les données mises en cache
        console.log(await redisHandler.getAsync('catalogCached'), 'from redis', await getCachedCatalog());

    } catch (error) {
        console.error("Erreur lors de la mise à jour du cache du catalogue:", error);
    }
};

export const getCachedCatalog = async (id = null) => {
    console.log('JE VAIS FETCH LE CATALOG, avec l ID ==>', id)
    try {
        const cachedData = await redisHandler.getAsync('catalogCached');
        const catalog = JSON.parse(cachedData || "{}");
        console.log('cachedData', cachedData)
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
    generateDump
};
