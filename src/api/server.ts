import app from './app';
import { logger } from './utils/logs/winston';
import fs from 'fs';
import { redisHandler } from './catalog/redis/connection';
import { getLastDump } from './delegated-storage/index';
import { minioClient } from './delegated-storage/s3/connection';
import fetch from 'node-fetch';
import { deleteCatalogItem, getCatalog } from './catalog';
import listEndpoints from 'express-list-endpoints';
const port = parseInt(process.env.PORT, 10) || 3001;
const standalone = process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE' || !process.env.DELEGATED_STORAGE_METHOD;
if(standalone){
    logger.warning('Standalone mode isn\'t recommanded, please set the DELEGATED_STORAGE_METHOD variable to S3 or DISTANT_BACKEND : see the docs. ')
}

const printRoutes = () => {
    const endpoints = listEndpoints(app);
    logger.info('Available Routes:');
    endpoints.forEach((endpoint) => {
        endpoint.methods.forEach((method) => {
            logger.info(`${method} ${endpoint.path}`);
        });
    });
};
const checkAccessToBackup = async () => {
    const backupUrl = `${ process.env.DELEGATED_STORAGE_HOST }${ process.env.DELEGATED_STORAGE_READINESS_CHECK }`;
    const checkBackup = await fetch(backupUrl);
    if (checkBackup.status !== 200) {
        logger.error(`Backup status response on ${ process.env.DELEGATED_STORAGE_READINESS_CHECK }: ${ checkBackup.status }`);
        throw new Error(`Backup access failed: ${ checkBackup.status }`);
    }
    if (process.env.DELEGATED_STORAGE_METHOD === 'S3') {
        const bucketName = process.env.S3_BUCKET_NAME;
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            logger.info(`Bucket check OK: "${ bucketName }" created successfully.`);
        } else {
            logger.info(`Bucket check OK: "${ bucketName }" already exists.`);
        }
    }
    logger.info(`Backup access OK: ${ backupUrl }`);
};

const connectToRedisWithRetry = async (maxRetries, delay) => {
    let attempts = 0;
    while ( attempts < maxRetries ) {
        try {
            await redisHandler.connectClient();
            const { data: catalog } = await getCatalog();
            if (catalog.length) {
                for ( const item of catalog ) {
                    if (item.unique_name && item.unique_name.includes('/tests/')) {
                        await deleteCatalogItem(item.unique_name);
                    }
                }
            }
            return;
        } catch ( err ) {
            attempts++;
            logger.error(`Failed to connect to Redis. Attempt ${ attempts } of ${ maxRetries }. Retrying in ${ delay / 1000 } seconds...`);
            if (attempts < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                logger.error('Maximum connection attempts to Redis reached');
                throw new Error('Maximum connection attempts to Redis reached');
            }
        }
    }
};

const createStandaloneFolderAndCatalog = () => {
    if (!fs.existsSync('/tmp/standalone')) {
        logger.info('Creating /tmp/standalone...');
        fs.mkdirSync('/tmp/standalone', { recursive: true });
    }
    if (!fs.existsSync('/tmp/standalone/catalog.json')) {
        fs.writeFileSync('/tmp/standalone/catalog.json', JSON.stringify({ data: [] }));
    }
};

( async () => {
    try {
        if (!standalone) {
            await checkAccessToBackup();
            await connectToRedisWithRetry(3, 10000);

            const dbDump = fs.existsSync(`${ process.env.DUMP_FOLDER_PATH }/dump.rdb`);

            if (!dbDump) {
                logger.info('dump.rdb doesn\'t exists : getting latest dump from backup ✅');
                const dump = await getLastDump();
                if(dump.errors){
                    logger.warning('Failed to get last dump from delegated storage : initializing empty dump.rdb')
                }
                await redisHandler.generateDump();
            } else {
                logger.info('dump.rdb already exists : skipping getting latest dump from backup 🔆');
            }
        }

        if (standalone) {
            createStandaloneFolderAndCatalog();
        }

        app.listen(port, async () => {
            printRoutes()
            logger.info(`\n✨  ${ standalone ?
                'Using fs in standalone mode' :
                'Connected to Redis' }, server running => http://localhost:${ port }\n`);
        });
    } catch ( err ) {
        logger.error(`Error starting app => ${ err }`);
        process.exit(1);
    }
} )();

app.on('error', (err) => {
    logger.error(`${ err }`);
    process.exit(1);
});
