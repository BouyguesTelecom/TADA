import fs from 'fs';

export const createDir = (fileDir: string) => {
    console.log(`Creating directory ${fileDir}...`);
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
    } else {
        console.log(`Directory already exists`);
    }
    return true;
};
