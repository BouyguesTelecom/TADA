import { Request, Response } from 'express';
import { getLastDump, deleteFile, deleteFiles, getFile, updateFile, updateFiles, generateStream, generateStreams } from '../delegated-storage/index';
import fs from 'fs';
import { BackupProps } from '../props/delegated-storage';

const filePath = (filePath) => {
    return filePath.includes('.json') && filePath.includes('catalog/') ?
        `${ process.env.DUMP_FOLDER_PATH }/${ filePath }` :
        `/${ filePath }`;
};

export const getBackupDump = async (req: Request, res: Response) => {
    return await getLastDump(req, res);
};


export const getBackup = async (filepath, version = '', mimetype = '') => {
    const params = { filepath, version, mimetype };
    const { status, stream }: BackupProps = await getFile(params);
    return status === 200 ? stream : null;
};

export const postFileBackup = async (stream, file, datum) => {
    return await generateStream(stream, file, datum);
};

export const postFilesBackup = async (req: Request, res: Response) => {
    const params = {
        filespath: req.body.map((file) => file.filespath),
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };
    const { status }: BackupProps = await generateStreams({
        ...params,
        files: req.body.map((file) => file.file)
    });

    return res.status(status).end();
};

export const patchFileBackup = async (file, stream, info) => {
    return await updateFile(file, stream, info);
};

export const patchFilesBackup = async (req: Request, res: Response) => {
    const params = {
        filespath: req.body.filespath,
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };

    const { status } = await updateFiles({
        ...params,
        files: req.body.files
    });

    return res.status(status).end();
};

export const deleteFileBackup = async (itemToUpdate) => {
    return await deleteFile(itemToUpdate);
};

export const deleteFilesBackup = async (data) => {
    return await deleteFiles(data);
};
