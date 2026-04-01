import { getOrCreateDestinationDir, removeOneFileFromFs, retrieveFileDirFromPath, retrieveFileNameFromPath } from '../utils/file';
import path from 'path';
import fs from 'fs';

interface ResponseProps {
    data: any | null;
    errors: string | null;
    success: boolean | null;
}

export const deleteOneFile = (fileDirPath: string): ResponseProps => {
    if (!fileDirPath) {
        console.log('filepath key is missing or null');
        return {
            data: null,
            errors: 'filepath key is missing or null',
            success: null
        };
    }

    const dirPathToDelete = getOrCreateDestinationDir(fileDirPath);
    if (!dirPathToDelete) {
        console.log("Directory doesn't exist");
        return {
            data: null,
            errors: null,
            success: true
        };
    }

    const isDeleted = removeOneFileFromFs(dirPathToDelete);
    if (!isDeleted) {
        console.log(`Unable to delete ${dirPathToDelete}, directory doesn\'t exist`);
        return {
            data: null,
            errors: null,
            success: true
        };
    }
    return {
        data: null,
        errors: null,
        success: true
    };
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

export const replaceFileContent = (currentImage: string, newFile: string[]): ResponseProps => {
    console.log('oldfile (unique_name):', currentImage);
    console.log('newfile (paths):', newFile);

    if (!newFile || newFile.length === 0) {
        return {
            data: null,
            errors: 'No new file provided',
            success: false
        };
    }

    const currentFilePath = getOneFileAbsolutePath(currentImage);
    if (!currentFilePath) {
        return {
            data: null,
            errors: 'Current file not found on disk',
            success: false
        };
    }

    try {
        const newFilePath = newFile[0];
        const newFileContent = fs.readFileSync(newFilePath);

        fs.writeFileSync(currentFilePath, newFileContent);

        if (fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }

        return {
            data: { replaced: true, path: currentFilePath },
            errors: null,
            success: true
        };
    } catch (error) {
        return {
            data: null,
            errors: "Error replacing file content",
            success: false
        };
    }
};



export const cleanupOldFilesInDirectories = (uploadedFiles: string[]): { cleaned: string[]; errors: string[] } => {
    const cleaned: string[] = [];
    const errors: string[] = [];

    if (uploadedFiles.length === 0) {
        return { cleaned, errors };
    }

    const filesByDir: Record<string, string[]> = {};

    for (const filePath of uploadedFiles) {
        const dir = path.dirname(filePath);
        if (!filesByDir[dir]) {
            filesByDir[dir] = [];
        }
        filesByDir[dir].push(path.basename(filePath));
    }

    for (const [directory, newFileNames] of Object.entries(filesByDir)) {
        if (fs.existsSync(directory)) {
            try {
                const existingFiles = fs.readdirSync(directory);

                for (const file of existingFiles) {
                    if (!newFileNames.includes(file)) {
                        const filePath = path.join(directory, file);
                        console.log('Old file deleted', filePath);
                        fs.unlinkSync(filePath);
                        cleaned.push(filePath);
                    }
                }
            } catch (error) {
                errors.push(`Error cleaning ${directory}: ${error}`);
            }
        }
    }

    return { cleaned, errors };
};
