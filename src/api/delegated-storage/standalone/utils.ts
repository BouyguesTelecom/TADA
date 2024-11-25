import fs from 'fs';
import { logger } from '../logs/winston';

export const removeLastPartPath = (url) => {
    const segments = url.split('/');
    segments.pop();
    return segments.join('/');
};

export const createFolder = (folderPath) => {
    if (folderPath && !fs.existsSync(`/tmp/standalone${ folderPath }`)) {
        logger.info(`Creating folder : ${ folderPath } under /tmp/standalone`);
        try {
            fs.mkdirSync(`/tmp/standalone${ folderPath }`, { recursive: true });
            logger.info(`Folder created successfully : ${ folderPath }`);
            return { status: 200 };
        } catch ( error ) {
            if (error.code !== 'EEXIST') {
                logger.error(`Failed to create folder ${ folderPath }: ${ error }`);
                return { status: 400 };
            }
        }
    }
    if (folderPath) {
        logger.info(`${ folderPath } already exists in PV /tmp/standalone`);
        return { status: 304 };
    }
    logger.info(`No folder created, file located at root`);
    return { status: 200 };
};

export const writeFileInPV = async (resourcePath, data) => {
    try {
        await fs.promises.writeFile(`/tmp/standalone${ resourcePath }`, data);

        logger.info(`File ${ resourcePath } saved successfully under /tmp/standalone${ resourcePath }`);
        return true;
    } catch ( err ) {
        logger.error(`Failed to save file ${ resourcePath } in PV under /tmp/standalone${ resourcePath }`, err);
        return false;
    }
};

export const deleteFile = (filePath): Promise<boolean> => {
    return fs.promises.unlink(filePath).then(() => true).catch(() => false);
};