import { checkFilesUploaded, getOneFileAbsolutePath } from '../services/file.service';
import { ReqProps } from '../types/req';

export const addManyFiles = (req: ReqProps, res) => {
    const { fail } = checkFilesUploaded(req.metadata.files);

    if (fail.length > 0) {
        return res.status(500).json({
            status: 'error',
            message: `Unable to upload some files: ${JSON.stringify(fail)}`
        });
    }
    return res.status(200).json({
        status: 'success',
        message: `All files uploaded successfully`
    });
};

export const addFile = (req: ReqProps, res) => {
    const { fail } = checkFilesUploaded(req.metadata.files);

    if (fail.length > 0) {
        return res.status(500).json({
            status: 'error',
            message: `Unable to upload file: ${JSON.stringify(fail)}`
        });
    }
    return res.status(200).json({
        status: 'success',
        message: `File uploaded successfully`
    });
};

export const getFile = (req, res) => {
    const { filepath: filePath } = req.query;

    if (!filePath) {
        console.log('filepath field missing');
        return res.status(400).json({ error: 'filepath field missing' });
    }

    const filePathToServe = getOneFileAbsolutePath(filePath);
    if (!filePathToServe) {
        console.log('File not found for path:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    return res.status(200).sendFile(filePathToServe);
};
