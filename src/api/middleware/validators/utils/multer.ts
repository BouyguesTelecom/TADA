import multer from 'multer';
import fs from 'fs';
import path from 'path';

export const storage = multer.diskStorage({
    filename: (_req, file, callback) => {
        const convertToWebp = ['image/png', 'image/jpeg'].includes(file.mimetype) && !(_req.body.toWebp === 'false');
        let filename = _req.body.filename ? _req.body.filename : file.originalname;

        const ext = path.extname(filename);
        const name = path.basename(filename, ext);

        const sanitizedFilename = name.replace(/[^a-zA-Z0-9\-@_%]+/g, '_') + ext;
        const finalFilename = convertToWebp ? sanitizedFilename.replace(ext, '.webp') : sanitizedFilename;

        callback(null, finalFilename);
    },
    destination: (_req, _file, callback) => {
        const path = `/tmp`;
        if (!fs.existsSync(`${path}`)) {
            fs.mkdirSync(`${path}`, { recursive: true });
        }
        callback(null, `${path}`);
    }
});

export const isFileNameInvalid = (file) => {
    const fileNameSplitted = file.filename.split('.');
    if (!(fileNameSplitted.length > 0)) return "Filename doesn't contains extension.";
    const allowedCharsRegex = /^[a-zA-Z0-9\-@_%]+$/;
    if (file.filename.length > 90) return 'Filename is too long.';
    if (!allowedCharsRegex.test(fileNameSplitted[0])) return 'Filename contains forbidden chars.';
    return false;
};
