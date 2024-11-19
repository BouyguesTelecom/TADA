import fetch, { Headers } from 'node-fetch';
import { BackupProps } from '../../props/backup';
import { connectClient, disconnectClient } from '../../utils/redis/connection';
import { addMultipleFiles } from '../../utils/redis/operations';
import { logger } from '../../utils/logs/winston';

interface UploadFileProps {
    filepath: string;
    file: Buffer | Blob | string;
    version?: any;
    mimetype?: string;
    headers?: Record<string, string>;
}

interface FileProps {
    filepath: string;
    version?: any;
    mimetype?: string;
    headers?: Record<string, string>;
}

interface ResponseBackup {
    status: number;
    body?: any;
    json?: any;
}

export const headersUserAgentForBackup = (contentType: string | null = null) =>
    new Headers({
        ...(process.env.DELEGATED_STORAGE_TOKEN && {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        }),
        ...(contentType && { 'Content-Type': contentType })
    });

const generateOptions = (method, contentTypeHeaders, file = null) => {
    return {
        method: method,
        headers: headersUserAgentForBackup(contentTypeHeaders),
        redirect: 'follow',
        ...(file && { body: file })
    };
};

const generateUrl = (filepath, version, mimetype, method) => {
    if (version || mimetype) {
        return `${process.env.DELEGATED_STORAGE_HOST}${process.env[`DELEGATED_STORAGE_${method}_PATH`]}${filepath}?version=${version}&mimetype=${mimetype}`;
    }
    return `${process.env.DELEGATED_STORAGE_HOST}${process.env[`DELEGATED_STORAGE_${method}_PATH`]}${filepath}`;
};

export const getLastDump = async () => {
    try {
        const getBackupFileJson = await fetch(generateUrl('/dump.json', null, null, 'GET'), generateOptions('GET', 'application/json'));
        if (getBackupFileJson.status !== 200) {
            return { data: null, errors: 'Failed to get backup JSON file.' };
        }
        const files = await getBackupFileJson.json();
        if (files.length) {
            await connectClient();
            await addMultipleFiles(files);
            await disconnectClient();
        }
        return { data: 'OK', errors: null };
    } catch (errMessage: any) {
        logger.error(`Error getting last dump: ${errMessage}`);
        return { data: null, errors: errMessage };
    }
};

export const getFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupGet: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype, 'GET'), generateOptions('GET', 'application/json'));

        if (backupGet.status === 200) {
            const stream = filepath.includes('.json') ? await backupGet.json() : backupGet.body;
            return { status: 200, stream };
        }
        return { status: backupGet.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
    }
    return null;
};

export const uploads = async ({ filepath, file, version, mimetype }: UploadFileProps): Promise<BackupProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype, 'POST'), generateOptions('POST', 'multipart/form-data', file));

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
    }
    return null;
};

export const update = async ({ filepath, file, version, mimetype }: UploadFileProps): Promise<BackupProps> => {
    try {
        const backupUptade: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype, 'PATCH'), generateOptions('PUT', 'multipart/form-data', file));

        if (backupUptade.status === 200) {
            return { status: 200, stream: backupUptade.body };
        }
        return { status: backupUptade.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
    }
    return null;
};

export const deleteFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupDelete: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype, 'DELETE'), generateOptions('DELETE', 'application/json'));

        if (backupDelete.status === 200) {
            return { status: 200 };
        }
        return { status: backupDelete.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
    }
    return null;
};
