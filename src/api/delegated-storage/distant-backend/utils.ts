import FormData from 'form-data';
import fs from 'fs';
import fetch, { Headers } from 'node-fetch';
import { updateCatalogItem } from '../../catalog';
import { redisHandler } from '../../catalog/redis/connection';
import { getCatalog } from '../../catalog/redis/operations';
import { BackupProps } from '../../props/delegated-storage';
import { logger } from '../../utils/logs/winston';

interface FileProps {
    filepath: string;
    version?: string;
    mimetype?: string;
    headers?: Record<string, string>;
}

interface FilesProps {
    filespath: string[];
    version?: string;
    mimetype?: string;
    headers?: Record<string, string>;
}

interface UploadFileProps extends FileProps {
    file: Buffer | Blob | string;
}

interface UploadFilesProps extends FilesProps {
    files: Buffer[] | Blob[] | string[];
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

const generateOptions: any = (method, contentTypeHeaders, body = null) => {
    return {
        method: method,
        headers: headersUserAgentForBackup(contentTypeHeaders),
        redirect: 'follow',
        ...(body && { body })
    };
};

const generateUrl: any = (pathType = 'SINGLE') => {
    const delegatedStoragePath = pathType === 'SINGLE' ? (process.env.DELEGATED_STORAGE_SINGLE_PATH ?? '') : (process.env.DELEGATED_STORAGE_MULTI_PATH ?? '');
    return `${process.env.DELEGATED_STORAGE_HOST}${delegatedStoragePath}`;
};

const generateFormDataWithFile = (stream, file, info) => {
    const form = new FormData();
    for (const key in info) {
        if (info.hasOwnProperty(key) && info[key]) {
            form.append(key, info[key]);
        }
    }
    form.append('file', stream, file);
    return form;
};

export const getLastDump = async (_req, res) => {
    try {
        const response = await fetch(`${process.env.DELEGATED_STORAGE_HOST}/get-dump/latest`, generateOptions('GET', {}));

        if (response.status !== 200) {
            throw new Error('Failed to get backup file.');
        }

        return response;
    } catch (errMessage) {
        logger.error(`Error getting last dump: ${errMessage}`);
        return { data: null, errors: errMessage };
    }
};

export const createDump = async (filePath, fileFormat) => {
    if (fileFormat === 'json') {
        try {
            const catalog = await getCatalog();
            const backupUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.URL_TO_POST_BACKUP}`;
            const postBackupFileJson = await fetch(backupUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catalog)
            });
            if (postBackupFileJson.status === 200) {
                const data = await postBackupFileJson.json();
                return { status: postBackupFileJson.status, data: 'JSON backup successful', error: null };
            } else {
                const errorData = await postBackupFileJson.json();
                return {
                    status: postBackupFileJson.status,
                    error: `Error uploading JSON: ${JSON.stringify(errorData)}`,
                    data: null
                };
            }
        } catch (err) {
            return { status: 500, error: 'Error when uploading JSON: ' + (err as Error).message, data: null };
        }
    } else {
        try {
            await redisHandler.generateDump();
            const dumpPath = process.env.DUMP_FOLDER_PATH ? `${process.env.DUMP_FOLDER_PATH}/dump.rdb` : '/dumps/dump.rdb';
            const backupUrl = `${process.env.DELEGATED_STORAGE_HOST}${process.env.URL_TO_POST_BACKUP}?`;

            const formData = new FormData();
            const stream = await fs.promises.readFile(dumpPath);
            formData.append('file', stream, { filename: filePath });

            const response = await fetch(backupUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
                },
                body: formData
            });
            if (response.ok) {
                return { status: 200, data: 'dump.rdb uploaded successfully', error: null };
            } else {
                const errorText = await response.text();
                return {
                    status: response.status,
                    error: `Error sending dump.rdb: ${response.statusText} - ${errorText}`,
                    data: null
                };
            }
        } catch (err) {
            return { status: 500, error: 'Error generating dump.rdb: ' + (err as Error).message, data: null };
        }
    }
};

export const getFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupGet: ResponseBackup = await fetch(`${generateUrl()}?filepath=${filepath}&version=${version}&mimetype=${mimetype}`, generateOptions('GET', 'application/json'));

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

export const upload = async (stream, file, datum): Promise<BackupProps> => {
    try {
        const form = generateFormDataWithFile(stream, file, datum);
        console.log('FORM :', form);
        const backupUpload: ResponseBackup = await fetch(generateUrl(), generateOptions('POST', '', form));

        if (backupUpload.status === 401) {
            return { status: 401, error: 'Authentication failed' };
        }
        const backupUploadResponse = await backupUpload.json();
        if (backupUploadResponse.version) {
            await updateCatalogItem(datum.uuid, { version: backupUploadResponse.version });
        }
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        console.error('Upload error details:', errorMessage);
    }
    return null;
};

export const uploads = async ({ filespath, files, version, mimetype }: UploadFilesProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        files.forEach((file, index) => {
            const filepath = filespath[index];
            if (Buffer.isBuffer(file) || typeof file === 'string') {
                form.append(`file${index}`, Buffer.from(file), {
                    filename: filepath.split('/').pop(),
                    contentType: mimetype || 'application/octet-stream'
                });
            } else {
                form.append(`file${index}`, file);
            }
        });

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_names', JSON.stringify(filespath));
        form.append('destinations', JSON.stringify(filespath));

        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('POST', '', form));

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        console.error('Upload error details:', errorMessage);
    }
    return null;
};

export const update = async (file, stream, info): Promise<BackupProps> => {
    try {
        const form = stream && generateFormDataWithFile(stream, file, info);
        const backupUpload: ResponseBackup = await fetch(
            generateUrl(),
            stream
                ? generateOptions('PATCH', '', form)
                : generateOptions(
                      'PATCH',
                      'application/json',
                      JSON.stringify({
                          unique_name: file.unique_name,
                          version: file.version,
                          ...info
                      })
                  )
        );

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        console.error('Upload error details:', errorMessage);
    }
    return null;
};

export const updates = async ({ filespath, files, version, mimetype }: UploadFilesProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        files.forEach((file, index) => {
            const filepath = filespath[index];
            if (Buffer.isBuffer(file) || typeof file === 'string') {
                form.append(`file${index}`, Buffer.from(file), {
                    filename: filepath.split('/').pop(),
                    contentType: mimetype || 'application/octet-stream'
                });
            } else {
                form.append(`file${index}`, file);
            }
        });

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_names', JSON.stringify(filespath));
        form.append('destinations', JSON.stringify(filespath));

        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('PUT', '', form));

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        console.error('Upload error details:', errorMessage);
    }
    return null;
};

export const deleteFile = async (itemToUpdate): Promise<BackupProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl(), generateOptions('DELETE', 'application/json', JSON.stringify({ ...itemToUpdate })));

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200 };
        }
        return { status: backupUpload.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        console.error('Delete error details:', errorMessage);
    }
    return null;
};

export const deleteFiles = async (files: any): Promise<BackupProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('DELETE', 'application/json', JSON.stringify(files)));

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200 };
        }
        return { status: backupUpload.status };
    } catch (errorMessage: any) {
        logger.error(`ERROR: ${errorMessage}`);
        console.error('Delete error details:', errorMessage);
    }
    return null;
};
