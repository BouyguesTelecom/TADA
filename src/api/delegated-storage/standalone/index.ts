import { createReadStream } from 'fs';
import { BackupProps } from '../../props/delegated-storage';
import { logger } from '../../utils/logs/winston';
import { createFolder, deleteFile as deleteFileFS, removeLastPartPath, writeFileInPV } from './utils';

export const getFile = async ({ filepath }): Promise<BackupProps> => {
    try {
        const backupFilePath = `/tmp/standalone${filepath}`;
        const fileStream = createReadStream(backupFilePath);
        fileStream.on('error', (error) => {
            logger.error('Stream error:', error);
        });

        return { status: 200, stream: fileStream };
    } catch (error) {
        return null;
    }
};

export const upload = async (stream, file, datum): Promise<BackupProps> => {
    try {
        await createFolder(removeLastPartPath(datum.unique_name));
        await writeFileInPV(datum.unique_name, stream);
        return { status: 200 };
    } catch (error) {
        logger.error('Standalone upload error:', error);
        return { status: 400 };
    }
};

export const update = async (stream, info): Promise<BackupProps> => {
    try {
        const filepath = info.unique_name;
        await createFolder(removeLastPartPath(filepath));
        await writeFileInPV(filepath, stream);
        return { status: 200 };
    } catch (error) {
        logger.error('Standalone update error:', error);
        return { status: 400 };
    }
};

export const deleteFile = async (catalogItem): Promise<BackupProps> => {
    try {
        const filepath = catalogItem.unique_name || catalogItem.filepath || catalogItem;
        const deletedFile = await deleteFileFS(`/tmp/standalone${filepath}`);
        return { status: deletedFile ? 200 : 400 };
    } catch (error) {
        return { status: 400 };
    }
};