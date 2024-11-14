import app from './app';
import { logger } from './utils/logs/winston';
import fs from 'fs';
import { redisClient } from './utils/redis/connection';
import { getLastDump } from './utils/backup-storage';
import { minioClient } from './utils/backup-storage/s3/connection';
import { expressListRoutes } from './utils/list-routes';
import fetch from 'node-fetch';
import FormData from 'form-data';
import path from 'path';

const PREFIXED_API_URL = `${process.env.IMAGE_SERVICE}${process.env.API_PREFIX ? process.env.API_PREFIX : ''}`;

const port = parseInt(process.env.PORT, 10) || 3001;

const checkAccessToBackup = async () => {
    const backupUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.DELEGATED_STORAGE_READINESS_CHECK}`;
    const checkBackup = await fetch(backupUrl);
    if (checkBackup.status !== 200) {
        logger.error(`Backup status response on ${process.env.DELEGATED_STORAGE_READINESS_CHECK}: ${checkBackup.status}`);
        throw new Error(`Backup access failed: ${checkBackup.status}`);
    }
    if (process.env.DELEGATED_STORAGE_METHOD === 'S3') {
        const bucketName = process.env.S3_BUCKET_NAME;
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            logger.info(`Bucket check OK: "${bucketName}" created successfully.`);
        } else {
            logger.info(`Bucket check OK: "${bucketName}" already exists.`);
        }
    }
    logger.info(`Backup access OK: ${backupUrl}`);
};

const connectToRedisWithRetry = async (maxRetries, delay) => {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            await redisClient.connect();
            return;
        } catch (err) {
            attempts++;
            logger.error(`Failed to connect to Redis. Attempt ${attempts} of ${maxRetries}. Retrying in ${delay / 1000} seconds...`);
            if (attempts < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                logger.error('Maximum connection attempts to Redis reached');
                throw new Error('Maximum connection attempts to Redis reached');
            }
        }
    }
};

const uploadDefaultImage = async (fileFolder, filename) => {
    const defaultImage = fs.readFileSync(path.join(fileFolder, filename));

    const defaultForm = new FormData();
    defaultForm.append('namespace', 'DEV');
    defaultForm.append('file', defaultImage, {
        filename: filename,
        contentType: 'image/webp'
    });

    const uploadDefault = await fetch(`${PREFIXED_API_URL}/file`, {
        method: 'POST',
        body: defaultForm
    });

    if (uploadDefault.status === 200) {
        logger.info(`Upload ${filename} successfully 🌄`);
    } else {
        logger.error(`Upload ${filename} failed: ${JSON.stringify(await uploadDefault.json())}`);
    }
};

const uploadDefaultAndErrorImages = async () => {
    for (const filename of ['default.webp', 'error.webp']) {
        const checkImage = await fetch(`${PREFIXED_API_URL}/assets/media/original/${process.env.DEV_ENV ? 'DEV/' : ''}${filename}`);
        if (checkImage.status !== 200) {
            await uploadDefaultImage(process.env.TMP_FILES_PATH || '/tmp/images/', filename);
        } else {
            logger.info(`Default image ${filename} already exists 🐥`);
        }
    }
};

(async () => {
    try {
        await checkAccessToBackup();
        await connectToRedisWithRetry(3, 10000);
        await redisClient.disconnect();
        const dbDump = fs.existsSync(`${process.env.DUMP_FOLDER_PATH}/dump.rdb`);

        if (!dbDump) {
            logger.info("dump.rdb doesn't exists : getting latest dump from backup ✅");
            await getLastDump();
        } else {
            logger.info('dump.rdb already exists : skipping getting latest dump from backup 🔆');
        }
        app.listen(port, async () => {
            logger.info(`\n✨  Connected to Redis, server running => http://localhost:${port}\n`);
            expressListRoutes(app, {});
            await uploadDefaultAndErrorImages();
        });
    } catch (err) {
        logger.error(`Error starting app => ${err}`);
        process.exit(1);
    }
})();

app.on('error', (err) => {
    logger.error(`${err}`);
    process.exit(1);
});
