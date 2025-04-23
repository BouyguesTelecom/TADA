import { BackupProps } from '../../props/delegated-storage';
import fs from 'fs';
import { createFolder, removeLastPartPath, writeFileInPV } from './utils';
import { deleteFile as deleteFileFS } from './utils';
import { createReadStream } from 'fs';

export const getFile = async ({ filepath }): Promise<BackupProps> => {
    try {
        const backupFilePath = `/tmp/standalone${ filepath }`;
        const fileStream = createReadStream(backupFilePath);
        fileStream.on('error', (error) => {
            console.error('Stream error:', error);
        });

        return { status: 200, stream: fileStream };
    } catch ( error ) {
        return null;
    }
};
export const upload = async (stream, file, datum): Promise<BackupProps> => {
    try {
        await createFolder(removeLastPartPath(datum.unique_name));
        await writeFileInPV(datum.unique_name, file);
        return { status: 200 };
    } catch ( error ) {
        return { status: 400 };
    }
};
export const uploads = async ({ filespath, files }): Promise<BackupProps> => {
    try {
        const success = [];
        const errors = [];

        for ( let i = 0; i < filespath.length; i++ ) {
            const filepath = filespath[i];
            const file = files[i];

            try {
                await createFolder(removeLastPartPath(filepath));
                await writeFileInPV(filepath, file);
                success.push(filepath);
            } catch ( error ) {
                errors.push(filepath);
            }
        }

        return {
            status: 200,
            message: `Files successfully uploaded: ${ success.join(', ') }, errors: ${ errors.join(', ') }`
        };
    } catch ( error ) {
        return {
            status: 400,
            message: `An error occurred: ${ error.message }`
        };
    }
};


export const update = async (file, info): Promise<BackupProps> => {
    try {
        const filepath = info.unique_name;
        await createFolder(removeLastPartPath(filepath));
        await writeFileInPV(filepath, file);
        return { status: 200 };
    } catch ( error ) {
        return { status: 400 };
    }
};

export const updates = async ({ filespath, files }): Promise<BackupProps> => {
    try {
        const success = [];
        const errors = [];

        for ( let i = 0; i < filespath.length; i++ ) {
            const filepath = filespath[i];
            const file = files[i];

            const deletedFile = await deleteFileFS(`/tmp/standalone${ filepath }`);
            if (deletedFile) {
                success.push(filepath);
                await createFolder(removeLastPartPath(filepath));
                await writeFileInPV(filepath, file);
            } else {
                errors.push(filepath);
            }
        }

        return {
            status: 200,
            message: `Removed files: ${ errors.length > 0 ?
                errors.join(', ') :
                'none' }, success: ${ success.join(', ') }`
        };
    } catch ( error ) {
        return {
            status: 400,
            message: `An error occurred: ${ error.message }`
        };
    }
};


export const deleteFile = async ({ filepath }): Promise<BackupProps> => {
    try {
        const deletedFile = await deleteFileFS(`/tmp/standalone${ filepath }`);
        return { status: deletedFile ? 200 : 400 };
    } catch ( error ) {
        return { status: 400 };
    }
};

export const deleteFiles = async ({ filespath }): Promise<BackupProps> => {
    try {
        const success = [];
        const errors = [];
        for ( const filepath of filespath ) {
            const deletedFile = await deleteFileFS(`/tmp/standalone${ filepath }`);
            deletedFile ? success.push(filepath) : errors.push(filepath);
        }
        return { status: 200, message: `Removed files: ${ errors }, success: ${ success }` };
    } catch ( error ) {
        return { status: 400 };
    }
};
