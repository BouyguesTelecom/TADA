import * as distantBackend from './distant-backend/utils';
import * as s3 from './s3/utils';
import * as standalone from './standalone';
import { logger } from '../utils/logs/winston';
import { BackupProps } from '../props/delegated-storage';

export interface FilePathProps {
    filepath: string;
    version?: string;
    mimetype?: string;
    headers?: any;
}

export interface FileProps extends FilePathProps {
    file: any;
}

const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';

export const getLastDump = async () => {
    
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

export const getFileBackup = async ({ filepath, version, mimetype }: FilePathProps): Promise<BackupProps> => {
    
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
        case 'STANDALONE':
            return await standalone.getFile({ filepath });
        default:
            return await distantBackend.getFile({
                filepath,
                version,
                mimetype
            });
    }
};

export const generateStreamBackup = async ({ filepath, file, version, mimetype, headers = null }: FileProps) => {
    
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
        case 'STANDALONE':
            return await standalone.uploads({ filepath, file });
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

export const updateFileBackup = async ({ filepath, file, version, mimetype, headers = {} }: FileProps): Promise<BackupProps> => {
    
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
            return await s3.update({ filename: filepath, file });
        case 'STANDALONE':
            return await standalone.update({ filepath, file });
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

export const deleteFileBackup = async ({ filepath, version, mimetype, headers = {} }: FilePathProps): Promise<BackupProps> => {
    
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
        case 'STANDALONE':
            return await standalone.deleteFile({ filepath });
        default:
            return await distantBackend.deleteFile({
                filepath,
                version,
                mimetype,
                headers
            });
    }
};
