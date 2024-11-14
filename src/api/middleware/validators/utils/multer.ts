import multer from 'multer';
import fs from 'fs';

export const storage = multer.diskStorage({
    filename: (_req, file, callback) => {
        const convertToWebp = ['image/png, image/jpeg'].includes(file.mimetype) && !(_req.body.toWebp === 'false');
        const filename = _req.body.filename ? _req.body.filename : file.originalname;
        callback(null, convertToWebp ? filename.split('.')[0] + '.webp' : filename);
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
    const fileNameSplitted = file.originalname.split('.');
    if (!(fileNameSplitted.length > 0)) return "Filename doesn't contains extension.";
    const allowedCharsRegex = /^[a-zA-Z0-9\-@_%]+$/;
    if (file.originalname.length > 90) return 'Filename is too long.';
    if (!allowedCharsRegex.test(fileNameSplitted[0])) return 'Filename contains forbidden chars.';
    return false;
};

export const fileFilter = (_req, file, callback) => {
    const allowedMimetypes = process.env.VALID_MIMETYPES?.split(',');
    const mimeTypeIsAllowed = allowedMimetypes.includes(file.mimetype);
    const errorFileName = isFileNameInvalid(file);

    if (mimeTypeIsAllowed && !errorFileName) {
        callback(null, true);
    } else {
        file.message = mimeTypeIsAllowed ? errorFileName : `File type ${file.mimetype} unauthorized.`;
        callback(null, true);
    }
};
