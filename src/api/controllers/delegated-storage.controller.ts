import { BackupProps } from '../props/delegated-storage';
import { logger } from '../utils/logs/winston';
import * as distantBackend from '../delegated-storage/distant-backend/utils';
import * as s3 from '../delegated-storage/s3/utils';
import * as standaloneUtils from '../catalog/standalone';
import * as standalone from '../delegated-storage/standalone';

const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';

export const getBackup = async (filepath, version = '', mimetype = '', original=false) => {
    logger.info(`GET file from backup storage using ${backupStorageMethod} method...`);
    const result: BackupProps = await (async (): Promise<BackupProps> => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.getFile({ filepath, version, mimetype, original });
            case 'S3':
                return await s3.getFile({ filename: filepath, version, mimetype });
            case 'STANDALONE':
                return await standalone.getFile({ filepath });
            default:
                return await distantBackend.getFile({ filepath, version, mimetype, original });
        }
    })();
    return result.status === 200 ? result.stream : null;
};

export const postFileBackup = async (backupObject) => {
    logger.info(`Uploading file to backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.upload(backupObject);
            case 'S3':
                return await s3.upload(backupObject);
            case 'STANDALONE':
                return await standalone.upload(backupObject);
            default:
                return await distantBackend.upload(backupObject);
        }
    })();
};

export const postFilesBackup = async (files) => {
    logger.info(`Uploading file to backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.uploads(files);
            case 'S3':
                return await s3.uploads(files);
            case 'STANDALONE':
                return await standalone.uploads(files);
            default:
                return await distantBackend.uploads(files);
        }
    })();
};

export const patchFileBackup = async (backupObject): Promise<BackupProps> => {
    logger.info(`Updating file from backup storage using ${backupStorageMethod} method...`);
    return await (async (): Promise<BackupProps> => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.update(backupObject);
            case 'S3':
                return await s3.update(backupObject);
            case 'STANDALONE':
                return await standalone.update(backupObject);
            default:
                return await distantBackend.update(backupObject);
        }
    })();
};

export const patchFilesBackup = async (files) => {
    logger.info(`Uploading file to backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.updates(files);
            case 'S3':
                return await s3.updates(files);
            case 'STANDALONE':
                return await standalone.updates(files);
            default:
                return await distantBackend.updates(files);
        }
    })();
};

export const deleteFileBackup = async (itemToUpdate): Promise<BackupProps> => {
    logger.info(`Deleting file from backup storage using ${backupStorageMethod} method ...`);
    return await (async (): Promise<BackupProps> => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.deleteFile(itemToUpdate);
            case 'S3':
                return await s3.deleteFile(itemToUpdate);
            case 'STANDALONE':
                return await standalone.deleteFile(itemToUpdate);
            default:
                return await distantBackend.deleteFile(itemToUpdate);
        }
    })();
};

export const deleteFilesBackup = async (files) => {
    logger.info(`Uploading file to backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.deletes(files);
            case 'S3':
                return await s3.deletes(files);
            case 'STANDALONE':
                return await standalone.deletes(files);
            default:
                return await distantBackend.deletes(files);
        }
    })();
};

export const createDumpBackup = async (filePath, fileFormat) => {
    logger.info(`CREATE DUMP from backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.createDump(filePath, fileFormat);
            case 'S3':
                return await s3.createDump(filePath, fileFormat);
            case 'STANDALONE':
                return await standaloneUtils.createDump(filePath, 'json');
            default:
                return await distantBackend.createDump(filePath, fileFormat);
        }
    })();
};

export const restoreDumpBackup = async (filename, format) => {
    logger.info(`RESTORE DUMP from backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.restoreDump(filename, format);
            case 'S3':
                return await s3.restoreDump(filename);
            case 'STANDALONE':
                return await standaloneUtils.restoreDump(filename, 'json');
            default:
                return await distantBackend.restoreDump(filename, format);
        }
    })();
};

export const getDumpBackup = async (version = '', format = 'json') => {
    logger.info(`GET DUMP from backup storage using ${backupStorageMethod} method...`);
    return await (async () => {
        switch (backupStorageMethod) {
            case 'DISTANT_BACKEND':
                return await distantBackend.getDump(version, format);
            case 'S3':
                return await s3.getDump(version, format);
            case 'STANDALONE':
                return await standaloneUtils.getDump(version, format);
            default:
                return await distantBackend.getDump(version, format);
        }
    })();
};
