import fs from 'fs';

export const deleteOneFile = (fileDirPath: string): boolean => {
    if (!fs.existsSync(fileDirPath)) {
        return false;
    }
    fs.unlinkSync(fileDirPath);
    return true;
}

export const createOneFile = (fileDirPath: string): boolean => {
    if (fs.existsSync(fileDirPath)) {
        return false;
    }
    fs.mkdirSync(fileDirPath);
    return true;
}


