import multer from 'multer';
import path from 'path';
import { ReqProps } from '../types/req';
import { getOrCreateDestinationDir } from '../utils/file';

const stockage = multer.diskStorage({
    destination: (req: ReqProps, file, callback) => {
        const fileData = req.body.file_0 ? JSON.parse(req.body.file_0).catalogItem : req.body;
        const fileDir = getOrCreateDestinationDir(fileData.unique_name);
        if (!fileDir) {
            return callback(new Error('Cannot create directory'), '');
        }

        req.metadata = {
            ...(req.metadata || {}),
            files: [...(req.metadata?.files || []), path.join(fileDir, file.originalname)]
        };
        callback(null, fileDir);
    },
    filename: (req: ReqProps, file, callback) => {
        callback(null, file.originalname);
    }
});

export const upload = multer({ storage: stockage }).any();
export const uploadMemoire = multer({ storage: multer.memoryStorage() }).any();
