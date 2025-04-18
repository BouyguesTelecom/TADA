import FormData from 'form-data';
import fetch, { Headers } from 'node-fetch';
import { addCatalogItems } from '../../catalog';
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

const generateOptions = (method, contentTypeHeaders, body = null) => {
    return {
        method: method,
        headers: headersUserAgentForBackup(contentTypeHeaders),
        redirect: 'follow',
        ...(body && { body })
    };
};

const generateUrl = (filepath, version, mimetype, pathType = 'SINGLE') => {
    const delegatedStoragePath = pathType === 'SINGLE' ? (process.env.DELEGATED_STORAGE_SINGLE_PATH ?? '') : (process.env.DELEGATED_STORAGE_MULTI_PATH ?? '');
    const baseUrl = `${process.env.DELEGATED_STORAGE_HOST}${delegatedStoragePath}`;

    const params = new URLSearchParams();
    params.append('filepath', filepath);
    if (version) params.append('version', version);
    if (mimetype) params.append('mimetype', mimetype);
    return `${baseUrl}?${params.toString()}`;
};

export const getLastDump = async () => {
    try {
        const getBackupFileJson = await fetch(generateUrl('/dump.json', null, null, 'GET'), generateOptions('GET', 'application/json'));
        if (getBackupFileJson.status !== 200) {
            return { data: null, errors: 'Failed to get backup JSON file.' };
        }
        const files = await getBackupFileJson.json();
        if (files.length) {
            await addCatalogItems(files);
        }
        return { data: 'OK', errors: null };
    } catch (errMessage: any) {
        logger.error(`Error getting last dump: ${errMessage}`);
        return { data: null, errors: errMessage };
    }
};

export const getFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupGet: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), generateOptions('GET', 'application/json'));

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

export const upload = async ({ filepath, file, version, mimetype }: UploadFileProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        if (Buffer.isBuffer(file) || typeof file === 'string') {
            form.append('file', typeof file === 'string' ? Buffer.from(file) : file, {
                filename: filepath.split('/').pop(),
                contentType: mimetype || 'application/octet-stream'
            });
        } else {
            form.append('file', file);
        }

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_name', filepath);
        form.append('destination', filepath);

        const formHeaders = form.getHeaders();
        const authHeaders = {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        };

        const backupUpload: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), {
            method: 'POST',
            headers: {
                ...formHeaders,
                ...authHeaders
            },
            body: form
        });

        console.log('Headers sent:', { ...formHeaders, ...authHeaders });
        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl(filepath, version, mimetype));

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

export const uploads = async ({ filespath, files, version, mimetype }: UploadFilesProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        files.forEach((file, index) => {
            const filepath = filespath[index];
            if (Buffer.isBuffer(file) || typeof file === 'string') {
                form.append(`file${index}`, Buffer.isBuffer(file) ? file : Buffer.from(file), {
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

        const formHeaders = form.getHeaders();
        const authHeaders = {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        };

        const backupUpload: ResponseBackup = await fetch(generateUrl('', version, mimetype, 'MULTI'), {
            method: 'POST',
            headers: {
                ...formHeaders,
                ...authHeaders
            },
            body: form
        });

        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl('', version, mimetype, 'MULTI'));

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

export const update = async ({ filepath, file, version, mimetype }: UploadFileProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        if (Buffer.isBuffer(file) || typeof file === 'string') {
            form.append('file', typeof file === 'string' ? Buffer.from(file) : file, {
                filename: filepath.split('/').pop(),
                contentType: mimetype || 'application/octet-stream'
            });
        } else {
            form.append('file', file);
        }

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_name', filepath);
        form.append('destination', filepath);

        const formHeaders = form.getHeaders();
        const authHeaders = {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        };

        const backupUpload: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), {
            method: 'PUT',
            headers: {
                ...formHeaders,
                ...authHeaders
            },
            body: form
        });

        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl(filepath, version, mimetype));

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
                form.append(`file${index}`, Buffer.isBuffer(file) ? file : Buffer.from(file), {
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

        const formHeaders = form.getHeaders();
        const authHeaders = {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        };

        const backupUpload: ResponseBackup = await fetch(generateUrl('', version, mimetype, 'MULTI'), {
            method: 'PUT',
            headers: {
                ...formHeaders,
                ...authHeaders
            },
            body: form
        });

        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl('', version, mimetype, 'MULTI'));

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

export const deleteFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_name', filepath);
        form.append('destination', filepath);

        const formHeaders = form.getHeaders();
        const authHeaders = {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        };

        const backupUpload: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), {
            method: 'DELETE',
            headers: {
                ...formHeaders,
                ...authHeaders
            },
            body: form
        });

        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl(filepath, version, mimetype));

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

export const deleteFiles = async ({ filespath, version, mimetype }: FilesProps): Promise<BackupProps> => {
    try {
        const form = new FormData();

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_names', JSON.stringify(filespath));
        form.append('destinations', JSON.stringify(filespath));

        const formHeaders = form.getHeaders();
        const authHeaders = {
            Authorization: `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`
        };

        const backupUpload: ResponseBackup = await fetch(generateUrl('', version, mimetype, 'MULTI'), {
            method: 'DELETE',
            headers: {
                ...formHeaders,
                ...authHeaders
            },
            body: form
        });

        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl('', version, mimetype, 'MULTI'));

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
