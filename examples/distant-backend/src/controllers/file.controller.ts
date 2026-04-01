import { checkFilesUploaded, getOneFileAbsolutePath, deleteOneFile, replaceFileContent, cleanupOldFilesInDirectories } from '../services/file.service';
import { ReqProps } from '../types/req';
import { getOrCreateDestinationDir } from '../utils/file';
import { it } from 'node:test';

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

export const deleteFile = (req, res) => {
    const { unique_name: filePath } = req.body;

    const {errors} = deleteOneFile(filePath);

    if (errors) {
        return res.status(500).json({
            status: 'error',
            message: 'Error during deletion'
        });
    }

    console.log('File deleted successfully:', filePath);
    return res.status(200).json({
        status: 'success',
        message: 'File deleted successfully'
    });
}

export const deleteFiles = (req, res) => {
    const fileErrors: string[] = []
    for (const item of req.body){
        const filePath = item.catalogItem.unique_name;

        const {errors} = deleteOneFile(filePath);

        if (errors) {
            fileErrors.push(errors);
        }
    }

    if (fileErrors.length) {
        console.log('Deletion of one or more files failed', fileErrors.join(', '));
        return res.status(500).json({
            status: 'error',
            message: 'Error during deletion'
        });
    }

    return res.status(200).json({
        status: 'success',
        message: 'Files deleted successfully'
    });
}

export const patchFile = (req, res) => {
    const oldFileInfo = req.body;
    const newFilePaths = req.metadata?.files;

    const { errors } = replaceFileContent(oldFileInfo.unique_name, newFilePaths);

    if (errors) {
        return res.status(500).json({
            status: 'error',
            message: 'Error during replacement'
        });
    }

    return res.status(200).json({
        status: 'success',
        message: 'Files deleted successfully'
    });
}


export const patchFiles = (req: ReqProps, res) => {
    const uploadedFiles = req.metadata?.files || [];

    console.log("test du console.log", uploadedFiles);
    process.stdout.write('test du console.log\n');

    const { cleaned, errors } = cleanupOldFilesInDirectories(uploadedFiles);

    if (errors.length > 0) {
        console.log('Cleaning errors:', errors);
    }

    console.log('File deleted', cleaned);

    return res.status(200).json({
        status: 'success',
        message: 'Files updated successfully',
        cleaned
    });
};
