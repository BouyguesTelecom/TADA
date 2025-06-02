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

export interface FilesPathProps {
    filespath: string[];
    version?: string;
    mimetype?: string;
    headers?: any;
}


export interface FilesProps extends FilesPathProps {
    files: any;
}

const backupStorageMethod = process.env.DELEGATED_STORAGE_METHOD ?? 'STANDALONE';

export const getLastDump = async (req, res) => {
    logger.info(`GET DUMP from backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.getLastDump(req,res);
        case 'S3':
            return await s3.getLastDump();
        default:
            return await distantBackend.getLastDump(req,res);
    }
};

export const createDumpDelegatedStorage = async (req, res) => {
    logger.info(`GET DUMP from backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.createDump(req,res);
        case 'S3':
            return await s3.createDump();
        default:
            return await distantBackend.createDump(req,res);
    }
};


export const getFile = async ({ filepath, version, mimetype }: FilePathProps): Promise<BackupProps> => {
    logger.info(`GET file from backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
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

export const generateStream = async (stream, file, datum) => {
    logger.info(`Uploading file to backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.upload(stream, file, datum);
        case 'S3':
            return await s3.upload(stream, file, datum);
        case 'STANDALONE':
            return await standalone.upload(stream, file, datum);
        default:
            return await distantBackend.upload(stream, file, datum);
    }
};

export const generateStreams = async ({ filespath, files, version, mimetype, headers = null }: FilesProps) => {
    logger.info(`Uploading files to backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.uploads({
                filespath,
                files,
                version,
                mimetype,
                headers
            });
        case 'S3':
            return await s3.uploads({ filespath, files });
        case 'STANDALONE':
            return await standalone.uploads({ filespath, files });
        default:
            return await distantBackend.uploads({
                filespath,
                files,
                version,
                mimetype,
                headers
            });
    }
};

export const updateFile = async (file, stream, info): Promise<BackupProps> => {
    logger.info(`Updating file from backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.update(file, stream, info);
        case 'S3':
            return await s3.update(file, info);
        case 'STANDALONE':
            return await standalone.update(file, info);
        default:
            return await distantBackend.update(file, stream, info);
    }
};

export const updateFiles = async ({
    filespath,
    files,
    version,
    mimetype,
    headers = {}
}: FilesProps): Promise<BackupProps> => {

    logger.info(`Updating files from backup storage using ${ backupStorageMethod } method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.updates({
                filespath,
                files,
                version,
                mimetype,
                headers
            });
        case 'S3':
            return await s3.updates({ filespath, files });
        case 'STANDALONE':
            return await standalone.updates({ filespath, files });
        default:
            return await distantBackend.updates({
                filespath,
                files,
                version,
                mimetype,
                headers
            });
    }
};


export const deleteFile = async (itemToUpdate): Promise<BackupProps> => {
    logger.info(`Delete file from backup storage using ${backupStorageMethod} method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.deleteFile(itemToUpdate);
        case 'S3':
            return await s3.deleteFile(itemToUpdate);
        case 'STANDALONE':
            return await standalone.deleteFile(itemToUpdate);
        default:
            return await distantBackend.deleteFile(itemToUpdate);
    }
};


export const deleteFiles = async (files: any): Promise<BackupProps> => {

    logger.info(`Delete files from backup storage using ${backupStorageMethod} method...`);
    switch ( backupStorageMethod ) {
        case 'DISTANT_BACKEND':
            return await distantBackend.deleteFiles(files);
        case 'S3':
            return await s3.deleteFiles(files);
        case 'STANDALONE':
            return await standalone.deleteFiles(files);
        default:
            return await distantBackend.deleteFiles(files);
    }
};
