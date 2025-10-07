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

export const upload = async (backupObject): Promise<BackupProps> => {
    const {stream, catalogItem: datum} = backupObject
    try {
        await createFolder(removeLastPartPath(datum.unique_name));
        await writeFileInPV(datum.unique_name, stream);
        return { status: 200 };
    } catch (error) {
        logger.error('Standalone upload error:', error);
        return { status: 400 };
    }
};

export const update = async (backupObject): Promise<BackupProps> => {
    const {stream, catalogItem: info} = backupObject
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

export const uploads = async (files): Promise<any> => {
    const data = []
    const errors=  []
    for (const file of files){
        try {
            await createFolder(removeLastPartPath(file.catalogItem.unique_name));
            const write= await writeFileInPV(file.catalogItem.unique_name, file.stream);
            if(write){
                data.push(file)
            }else{
                errors.push(file)
            }
        } catch (error) {
            logger.error('Standalone upload error:', error);
        }
    }
    return { status: 200, data, errors };
};

export const updates = async (files): Promise<any> => {
    const data = []
    const errors=  []
    for (const file of files){
        try {
            const filepath = file.catalogItem.unique_name;
            await createFolder(removeLastPartPath(filepath));
            const write= await  writeFileInPV(filepath, file.stream);
            if(write){
                data.push(file)
            }else{
                errors.push(file)
            }
        } catch (error) {
            logger.error('Standalone update error:', error);
        }
    }
    return { status: 200, data, errors };
};

export const deletes = async (files): Promise<any> => {
    const data = []
    const errors=  []
    for (const file of files){
        const filepath = file.catalogItem.unique_name;
        const deletedFile = await deleteFileFS(`/tmp/standalone${filepath}`);
        if(deletedFile){
            data.push(file)
        }else{
            errors.push(file)
        }
    }
    return { status: 200, data, errors };
};
