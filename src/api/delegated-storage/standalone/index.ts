import { BackupProps } from '../../props/backup';
import { logger } from '../../utils/logs/winston';

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