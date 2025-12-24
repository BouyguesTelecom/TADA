import { retrieveFileDirFromUniqueName } from '../utils/file';
import { createDir } from '../utils/fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR;

export const checkFiles = (req: any, res: any, next: any) => {
    console.log("check files")
    console.log(req)
    if (req.body.file_0) {
        const metadata = JSON.parse(req.body.file_0).catalogItem;
        const fileDir = path.join(UPLOAD_DIR, retrieveFileDirFromUniqueName(metadata.uniqueName));
        if (!createDir(fileDir)) {
            console.log('Cannot create directory');
            return res.status(500).json({
                message: 'Directory already exists'
            });
        }
        req.metadata = {
            fileDir
        };
        return next();
    }
    console.log(400)
    return res.status(400).json({
        message: 'Cannot process file'
    });
};
