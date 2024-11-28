import { BackupProps } from '../../props/delegated-storage';
import fs from 'fs';
import { createFolder, removeLastPartPath, writeFileInPV } from './utils';
import { deleteFile as deleteFileFS } from './utils';
import { createReadStream } from 'fs';

export const getFile = async ({ filepath }): Promise<BackupProps> => {
    try {
        const backupFilePath = `/tmp/standalone${filepath}`;
        const fileStream = createReadStream(backupFilePath);
        fileStream.on('error', (error) => {
            console.error('Stream error:', error);
        });

        return { status: 200, stream: fileStream };
    } catch (error) {
        return null;
    }
};

export const uploads = async ({ filepath, file }): Promise<BackupProps> => {
    try {
        await createFolder(removeLastPartPath(filepath));
        await writeFileInPV(filepath, file);
        return { status: 200 };
    } catch (error) {
        return { status: 400 };
    }
};

export const update = async ({ filepath, file }): Promise<BackupProps> => {
    try {
        await createFolder(removeLastPartPath(filepath));
        await writeFileInPV(filepath, file);
        return { status: 200 };
    } catch (error) {
        return { status: 400 };
    }
};

export const deleteFile = async ({ filepath }): Promise<BackupProps> => {
    try {
        const deletedFile = await deleteFileFS(`/tmp/standalone${filepath}`);
        return { status: deletedFile ? 200 : 400 };
    } catch (error) {
        return { status: 400 };
    }
};
