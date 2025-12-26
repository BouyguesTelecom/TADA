import { getOrCreateDestinationDir, retrieveFileNameFromPath } from '../utils/file';
import path from 'path';
import fs from 'fs';

export const deleteOneFile = (fileDirPath: string): boolean => {
    if (!fs.existsSync(fileDirPath)) {
        return false;
    }
    fs.unlinkSync(fileDirPath);
    return true;
};

export const getOneFileAbsolutePath = (filePath: string): string | null => {
    const destinationDir = getOrCreateDestinationDir(filePath);
    const fileName = retrieveFileNameFromPath(filePath);
    const finalFilePath = path.resolve(path.join(destinationDir, fileName));

    if (!fs.existsSync(finalFilePath)) {
        console.log('Unable to find physical file at path:', destinationDir);
        return null;
    }

    return finalFilePath;
};

export const checkFilesUploaded = (filePaths: string[]): { success: string[]; fail: string[] } => {
    const filesNotUploaded = [];

    for (let file of filePaths) {
        console.log(`\nChecking if ${file} exists...`);
        if (!fs.existsSync(file)) {
            filesNotUploaded.push(file);
            console.log(`${file} does not exist.`);
        } else {
            console.log(`${file} exists.`);
        }
    }

    return {
        success: filePaths.filter((f) => !filesNotUploaded.includes(f)),
        fail: filesNotUploaded
    };
};
