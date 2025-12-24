import multer from 'multer';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR;

if (!UPLOAD_DIR) {
    console.error('La variable UPLOAD_DIR doit être définie dans le fichier .env');
    process.exit(1);
}

const stockage = multer.diskStorage({
    destination: (req, file, callback) => {
        console.log("destination")
        // @ts-ignore
        callback(null, req.metadata.fileDir);
    },
    filename: (req, file, callback) => {
        console.log("filename")
        // @ts-ignore
        req.metadata = {
            // @ts-ignore
            ...(req.metadata || {}),
            files: [
                // @ts-ignore
                ...req.metadata.files,
                // @ts-ignore
                path.join(UPLOAD_DIR, req.metadata.fileDir, file.originalname)
            ]
        };
        callback(null, file.originalname);
    }
});

export const upload = multer({ storage: stockage }).any();
export const uploadMemoire = multer({ storage: multer.memoryStorage() }).any();
export { UPLOAD_DIR };
