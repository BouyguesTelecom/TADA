import fetch, { Headers } from 'node-fetch';
import FormData from 'form-data';
import { BackupProps } from '../../props/delegated-storage';
import { logger } from '../../utils/logs/winston';
import { addCatalogItems, updateCatalogItem } from '../../catalog';

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
        ...( process.env.DELEGATED_STORAGE_TOKEN && {
            Authorization: `Bearer ${ process.env.DELEGATED_STORAGE_TOKEN }`
        } ),
        ...( contentType && { 'Content-Type': contentType } )
    });

const generateOptions = (method, contentTypeHeaders, body = null) => {
    return {
        method: method,
        headers: headersUserAgentForBackup(contentTypeHeaders),
        redirect: 'follow',
        ...( body && { body } )
    };
};

const generateUrl = (pathType = 'SINGLE') => {
    const delegatedStoragePath = pathType === 'SINGLE' ?
        ( process.env.DELEGATED_STORAGE_SINGLE_PATH ?? '' ) :
        ( process.env.DELEGATED_STORAGE_MULTI_PATH ?? '' );
    return `${ process.env.DELEGATED_STORAGE_HOST }${ delegatedStoragePath }`;
};

const generateFormDataWithFile = (stream, file, info) => {
    const form = new FormData();
    for ( const key in info ) {
        if (info.hasOwnProperty(key) && info[key]) {
            form.append(key, info[key]);
        }
    }
    form.append('file', stream, file)
    return form;
};

export const getLastDump = async () => {
    try {
        const getBackupFileJson = await fetch(`${ generateUrl() }/dump.json`, generateOptions('GET', 'application/json'));
        if (getBackupFileJson.status !== 200) {
            return { data: null, errors: 'Failed to get backup JSON file.' };
        }
        const files = await getBackupFileJson.json();
        if (files.length) {
            await addCatalogItems(files);
        }
        return { data: 'OK', errors: null };
    } catch ( errMessage: any ) {
        logger.error(`Error getting last dump: ${ errMessage }`);
        return { data: null, errors: errMessage };
    }
};

export const getFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupGet: ResponseBackup = await fetch(`${ generateUrl() }?filepath=${ filepath }&version=${ version }&mimetype=${ mimetype }`, generateOptions('GET', 'application/json'));

        if (backupGet.status === 200) {
            const stream = filepath.includes('.json') ? await backupGet.json() : backupGet.body;
            return { status: 200, stream };
        }
        return { status: backupGet.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const upload = async (stream, file, datum): Promise<BackupProps> => {
    try {
        const form = generateFormDataWithFile(stream, file, datum);
        const backupUpload: ResponseBackup = await fetch(generateUrl(), generateOptions('POST', '', form));

        if (backupUpload.status === 401) {
            return { status: 401, error: 'Authentication failed' };
        }
        const backupUploadResponse = await backupUpload.json()
        if(backupUploadResponse.version){
            await updateCatalogItem(datum.uuid, {version: backupUploadResponse.version})
        }
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
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
                form.append(`file${ index }`, Buffer.from(file), {
                    filename: filepath.split('/').pop(),
                    contentType: mimetype || 'application/octet-stream'
                });
            } else {
                form.append(`file${ index }`, file);
            }
        });

        form.append('base_url', process.env.NGINX_INGRESS || '');
        form.append('unique_names', JSON.stringify(filespath));
        form.append('destinations', JSON.stringify(filespath));

        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('POST', ''), form);

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
        console.error('Upload error details:', errorMessage);
    }
    return null;
};

export const update = async (file, stream, info): Promise<BackupProps> => {
    try {
        const form = generateFormDataWithFile(stream, file, info);
        const backupUpload: ResponseBackup = await fetch(generateUrl(), generateOptions('PATCH', '', form));

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
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
                form.append(`file${ index }`, Buffer.from(file), {
                    filename: filepath.split('/').pop(),
                    contentType: mimetype || 'application/octet-stream'
                });
            } else {
                form.append(`file${ index }`, file);
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
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
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

    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
        console.error('Delete error details:', errorMessage);
    }
    return null;
};

export const deleteFiles = async (files: any): Promise<BackupProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl('MULTI'), generateOptions('DELETE', 'application/json'), JSON.stringify(files));

        if (backupUpload.status === 401) {
            console.error('Authentication failed. Token:', process.env.DELEGATED_STORAGE_TOKEN);
            return { status: 401, error: 'Authentication failed' };
        }

        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200 };
        }
        return { status: backupUpload.status };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
        console.error('Delete error details:', errorMessage);
    }
    return null;
};
