import { createClient, SCHEMA_FIELD_TYPE } from 'redis';
import { logger } from '../../utils/logs/winston';

const initializeIndex = async () => {
    try {
        await redisClient.ft.create('idx:files', {
            '$.unique_name': {
                type: SCHEMA_FIELD_TYPE.TEXT,
                AS: 'unique_name'
            },
            '$.namespace': {
                type: SCHEMA_FIELD_TYPE.TEXT,
                AS: 'namespace'
            }
        }, {
            ON: 'JSON',
            PREFIX: 'file:'
        });

        logger.info('RediSearch index created successfully');
    } catch ( err ) {
        if (!err.message.includes('Index already exists')) {
            logger.error(`Error creating RediSearch index: ${ err.message }`);
        } else {
            logger.info('RediSearch index already exists');
        }
    }
};

// Assurez-vous que l'index est créé lors de la connexion
const setupRedis = async () => {
    await redisClient.connect();
    await initializeIndex();
    logger.info('Redis client connected and index initialized');
};
export const redisClient = createClient({
    socket: {
        host: process.env.REDIS_SERVICE || 'localhost',
        port: 6379
    }
});

redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${ err.message } ${ JSON.stringify(err) }`);
});

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

const connectClient = async () => {
    try {
        if (!redisClient.isOpen) {
            await setupRedis();
            logger.info('Connected to Redis and ready for operations.');
        }
    } catch ( err ) {
        logger.error(`Error connecting to Redis: ${ err.message }`);
        throw new Error('Failed to connect to Redis');
    }
};

const disconnectClient = async () => {
    if (redisClient.isOpen) {
        await redisClient.destroy();
        logger.info('Connection to Redis closed.');
    }
};

export const testAsyncJSON = async () => {
    await redisClient.del('noderedis:jsondata');
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

const generateDump = async () => redisClient.sendCommand([ 'SAVE' ]);


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
