import fetch, { Headers } from 'node-fetch';
import { BackupProps } from '../../props/delegated-storage';
import { logger } from '../../utils/logs/winston';
import { addCatalogItems } from '../../catalog';

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

const generateUrl = (filepath, version, mimetype, pathType = 'SINGLE') => {
    const delegatedStoragePath = pathType === 'SINGLE' ?
        process.env.DELEGATED_STORAGE_SINGLE_PATH ?? '' :
        process.env.DELEGATED_STORAGE_MULTI_PATH ?? '';
    console.log(`${ process.env.DELEGATED_STORAGE_HOST }${ delegatedStoragePath }${ filepath }`, 'HELLOOOOOOO!!!!');
    if (version || mimetype) {
        return `${ process.env.DELEGATED_STORAGE_HOST }${ delegatedStoragePath }${ filepath }&version=${ version }&mimetype=${ mimetype }`;
    }
    return `${ process.env.DELEGATED_STORAGE_HOST }${ delegatedStoragePath }${ filepath }`;
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
    } catch ( errMessage: any ) {
        logger.error(`Error getting last dump: ${ errMessage }`);
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
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const upload = async ({ filepath, file, version, mimetype }: UploadFileProps): Promise<BackupProps> => {
    try {
        const backupUpload: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), generateOptions('POST', 'multipart/form-data', file));
        console.log(backupUpload.status, 'BACKUP RESPONSE ???', generateUrl(filepath, version, mimetype, 'POST'));
        if (backupUpload.status === 201 || backupUpload.status === 200) {
            return { status: 200, stream: backupUpload.body };
        }
        return { status: backupUpload.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const uploads = async ({ filespath, files, version, mimetype }: UploadFilesProps): Promise<BackupProps> => {
    try {
        const url = generateUrl('', version, mimetype, 'MULTI');
        const params = generateOptions('POST', 'multipart/form-data', {
            filespath,
            files
        });
        console.log(params, 'PARAMS ICIIII')
        const backupUploads: ResponseBackup = await fetch(url, params);
        console.log(backupUploads.status, 'BACKUP RESPONSE ???', url);
        if (backupUploads.status === 201 || backupUploads.status === 200) {
            return { status: 200, stream: backupUploads.body };
        }
        return { status: backupUploads.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const update = async ({ filepath, file, version, mimetype }: UploadFileProps): Promise<BackupProps> => {
    try {
        const backupUptade: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), generateOptions('PUT', 'multipart/form-data', file));

        if (backupUptade.status === 200) {
            return { status: 200, stream: backupUptade.body };
        }
        return { status: backupUptade.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const updates = async ({ filespath, files, version, mimetype }: UploadFilesProps): Promise<BackupProps> => {
    try {
        const url = generateUrl('', version, mimetype, 'MULTI');
        const params = generateOptions('PUT', 'multipart/form-data', {
            filespath,
            files
        });
        const backupUptades: ResponseBackup = await fetch(url, params);

        if (backupUptades.status === 200) {
            return { status: 200, stream: backupUptades.body };
        }
        return { status: backupUptades.status, stream: null };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const deleteFile = async ({ filepath, version, mimetype }: FileProps): Promise<BackupProps> => {
    try {
        const backupDelete: ResponseBackup = await fetch(generateUrl(filepath, version, mimetype), generateOptions('DELETE', 'application/json'));

        if (backupDelete.status === 200) {
            return { status: 200 };
        }
        return { status: backupDelete.status };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};

export const deleteFiles = async ({ filespath, version, mimetype }: FilesProps): Promise<BackupProps> => {
    try {
        const url = generateUrl('', version, mimetype, 'MULTI');
        const params = generateOptions('DELETE', 'application/json', {
            filespath
        });
        const backupDeletes: ResponseBackup = await fetch(url, params);

        if (backupDeletes.status === 200) {
            return { status: 200 };
        }
        return { status: backupDeletes.status };
    } catch ( errorMessage: any ) {
        logger.error(`ERROR: ${ errorMessage }`);
    }
    return null;
};
