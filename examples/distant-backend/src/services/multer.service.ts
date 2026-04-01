import multer from 'multer';
import path from 'path';
import { ReqProps } from '../types/req';
import { getOrCreateDestinationDir } from '../utils/file';

const stockage = multer.diskStorage({
    destination: (req: ReqProps, file, callback) => {
        console.log('[multer stockage] destination called, body:', req.body);
        let uniqueName: string | undefined;

        const fileIndex = req.metadata?.files?.length || 0;

        if (req.body[`file_${fileIndex}`]) {
            uniqueName = JSON.parse(req.body[`file_${fileIndex}`]).catalogItem.unique_name;
        } else if (req.body.file_0) {
            uniqueName = JSON.parse(req.body.file_0).catalogItem.unique_name;
        } else if (req.body.unique_names) {
            const uniqueNames = req.body.unique_names.split(',');
            uniqueName = uniqueNames[fileIndex];
        } else {
            uniqueName = req.body.unique_name;
        }

        console.log('[multer stockage] uniqueName:', uniqueName);

        const fileDir = getOrCreateDestinationDir(uniqueName, true);
        if (!fileDir) {
            console.log('[multer stockage] Cannot create directory');
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
