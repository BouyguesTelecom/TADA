import * as distantBackend from './distant-backend/utils';
import * as s3 from './s3/utils';
import { logger } from '../utils/logs/winston';

export interface FilePathProps {
    filepath: string;
    version?: any;
    mimetype?: string;
    headers?: any;
}

export interface FileProps extends FilePathProps {
    file: any;
}

export const getLastDump = async () => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'DISTANT_BACKEND';
    logger.info(`GET DUMP from backup storage using ${backupStorageMethod} method...`);
    switch (backupStorageMethod) {
        case 'DISTANT_BACKEND':
            return await distantBackend.getLastDump();
        case 'S3':
            return await s3.getLastDump();
        default:
            return await distantBackend.getLastDump();
    }
};

export const getFileBackup = async ({ filepath, version, mimetype }: FilePathProps) => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'DISTANT_BACKEND';
    logger.info(`GET file from backup storage using ${backupStorageMethod} method...`);
    switch (backupStorageMethod) {
        case 'DISTANT_BACKEND':
            return await distantBackend.getFile({
                filepath,
                version,
                mimetype
            });
        case 'S3':
            return await s3.getFile({ filename: filepath, version, mimetype });
        default:
            return await distantBackend.getFile({
                filepath,
                version,
                mimetype
            });
    }
};

export const uploadFileBackup = async ({ filepath, file, version, mimetype, headers = {} }: FileProps) => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'DISTANT_BACKEND';
    logger.info(`Uploading file to backup storage using ${backupStorageMethod} method...`);
    switch (backupStorageMethod) {
        case 'DISTANT_BACKEND':
            return await distantBackend.uploads({
                filepath,
                file,
                version,
                mimetype,
                headers
            });
        case 'S3':
            return await s3.uploads({ filename: filepath, file });
        default:
            return await distantBackend.uploads({
                filepath,
                file,
                version,
                mimetype,
                headers
            });
    }
};

export const updateFileBackup = async ({ filepath, file, version, mimetype, headers = {} }: FileProps) => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'DISTANT_BACKEND';
    logger.info(`Updating file from backup storage using ${backupStorageMethod} method...`);
    switch (backupStorageMethod) {
        case 'DISTANT_BACKEND':
            return await distantBackend.update({
                filepath,
                file,
                version,
                mimetype,
                headers
            });
        case 'S3':
            return await s3.updateFile({ filename: filepath, file });
        default:
            return await distantBackend.update({
                filepath,
                file,
                version,
                mimetype,
                headers
            });
    }
};

export const deleteFileBackup = async ({ filepath, version, mimetype, headers = {} }: FilePathProps) => {
    const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'DISTANT_BACKEND';
    logger.info(`Delete file from backup storage using ${backupStorageMethod} method...`);
    switch (backupStorageMethod) {
        case 'DISTANT_BACKEND':
            return await distantBackend.deleteFile({
                filepath,
                version,
                mimetype,
                headers
            });
        case 'S3':
            return await s3.deleteFile({ filename: filepath });
        default:
            return await distantBackend.deleteFile({
                filepath,
                version,
                mimetype,
                headers
            });
    }
};