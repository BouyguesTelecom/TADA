import path from 'path';
import { createDir } from './fs';
import fs from 'fs';

export const retrieveFileDirFromPath = (path: string) => {
    return path.replace(/\.[^/.]+$/, '');
};

export const retrieveFileNameFromPath = (path: string) => {
    return path.split('/').pop() || '';
};

export const getOrCreateDestinationDir = (givenPath: string, createIfNotExist: boolean = false): string | null => {
    if (!givenPath) {
        return null;
    }
    const dirPath = path.join(process.env.UPLOAD_DIR, retrieveFileDirFromPath(givenPath));

    if (!fs.existsSync(dirPath)) {
        if (createIfNotExist) {
            if (!createDir(dirPath)) {
                console.log('Cannot create directory');
                return null;
            }
            return dirPath;
        }
        return null;
    }
    return dirPath;
};

export const removeOneFileFromFs = (fileDirPath: string) => {
    if (!fs.existsSync(fileDirPath)) {
        return false;
    }
    fs.rmSync(fileDirPath, { recursive: true, force: true });
    return true;
};
