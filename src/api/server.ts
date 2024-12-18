import app from './app';
import { logger } from './utils/logs/winston';
import { redisHandler } from './catalog/redis/connection';
import { getLastDump } from './delegated-storage/index';
import { minioClient } from './delegated-storage/s3/connection';
import { deleteCatalogItem, getCatalog } from './catalog';
import { promisify } from 'util';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const port = parseInt(process.env.PORT, 10) || 3001;
const standalone = process.env.DELEGATED_STORAGE_METHOD === 'STANDALONE';
const imagesUploadPath = process.env.IMAGES_UPLOAD_PATH || '';
const imagesUploadNamespace = process.env.IMAGES_UPLOAD_NAMESPACE || '';
const imagesUploadDestination = process.env.IMAGES_UPLOAD_DESTINATION || '';

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
                    if (item.unique_name.includes('/tests/')) {
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

const uploadImages = async (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        logger.error(`Path does not exist: ${ dirPath }`);
        return;
    }

    const files = await readdir(dirPath);
    for ( const file of files ) {
        const filePath = path.join(dirPath, file);
        const fileStat = await stat(filePath);
        if (fileStat.isFile()) {
            console.log(`Uploading file: ${ file }`);

            const stream = fs.createReadStream(filePath);
            const form = new FormData();
            form.append('namespace', imagesUploadNamespace);
            form.append('destination', imagesUploadDestination);
            form.append('file', stream, { filename: file });
            try {
                const response = await fetch('http://localhost:3001/palpatine/file', {
                    method: 'POST',
                    body: form,
                    headers: {
                        'Authorization': 'Bearer cooltokenyeah'
                    }
                });

                if (response.status !== 200) {
                    const error = await response.json();
                    logger.error(`Failed to upload file: ${ file }, Error: ${ JSON.stringify(error) }`);
                } else {
                    logger.info(`Successfully uploaded file: ${ file }`);
                }
            } catch ( error ) {
                logger.error(`Error uploading file: ${ file }, ${ error }`);
            }
        }
    }
};

( async () => {
    try {
        if (!standalone) {
            await checkAccessToBackup();
            await connectToRedisWithRetry(3, 10000);
            await redisHandler.disconnectClient();
            const dbDump = fs.existsSync(`${ process.env.DUMP_FOLDER_PATH }/dump.rdb`);

            if (!dbDump) {
                logger.info('dump.rdb doesn\'t exist: getting latest dump from backup ✅');
                await getLastDump();
            } else {
                logger.info('dump.rdb already exists: skipping getting latest dump from backup 🔆');
            }
        }

        if (standalone) {
            createStandaloneFolderAndCatalog();
        }

        app.listen(port, async () => {
            logger.info(`\n✨  ${ standalone ?
                'Using fs in standalone mode' :
                'Connected to Redis' }, server running => http://localhost:${ port }\n`);
            await uploadImages(imagesUploadPath);
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
