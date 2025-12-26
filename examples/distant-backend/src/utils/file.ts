import path from 'path';
import { createDir } from './fs';
import fs from 'fs';

export const retrieveFileDirFromPath = (path: string) => {
    return path.replace(/\.[^/.]+$/, '');
};

export const retrieveFileNameFromPath = (path: string) => {
    return path.split('/').pop() || '';
};

export const getOrCreateDestinationDir = (givenPath: string) => {
    if (!givenPath) {
        return null;
    }
    const fileDir = path.join(process.env.UPLOAD_DIR, retrieveFileDirFromPath(givenPath));

    if (!fs.existsSync(fileDir)) {
        if (!createDir(fileDir)) {
            console.log('Cannot create directory');
            return null;
        }
    }
    return fileDir;
};
