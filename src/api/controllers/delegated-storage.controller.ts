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
    const result = await getLastDump();
    return res.status(result.data ? 200 : 400).send(result).end();
};

export const getBackup = async (req: Request, res: Response) => {
    const params = {
        filepath: `${ req.query.filepath }`,
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };
    const { status, stream }: BackupProps = await getFile(params);
    if (status === 200) {
        res.status(status);
        return stream.pipe(res);
    }
    return res.status(status).end();
};

export const postFileBackup = async (req: Request, res: Response) => {
    const filePathToRead = filePath(req.query.filepath);
    const params = {
        filepath: `${ req.query.filepath }`,
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };
    const file: Buffer | string = req.file ? fs.readFileSync(req.file.path) : JSON.stringify(req.body);
    const { status }: BackupProps = await generateStream({
        filepath: filePathToRead,
        file,
        ...params
    });

    return res.status(status).end();
};

export const postFilesBackup = async (req: Request, res: Response) => {
   console.log(req.body, 'ICI BODY')
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

export const patchFileBackup = async (req: Request, res: Response) => {
    const params = {
        filepath: `${ req.query.filepath }`,
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };

    const file: Buffer | string = req.file ? fs.readFileSync(req.file.path) : JSON.stringify(req.body);
    const { status } = await updateFile({ file, ...params });

    return res.status(status).end();
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

export const deleteFileBackup = async (req: Request, res: Response) => {
    const params = {
        filepath: `${ req.query.filepath }`,
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };

    const { status } = await deleteFile(params);

    return res.status(status).end();
};

export const deleteFilesBackup = async (req: Request, res: Response) => {
    const params = {
        filespath: req.body.filespath,
        version: req.query.version ? `${ req.query.version }` : null,
        mimetype: req.query.mimetype ? `${ req.query.mimetype }` : null
    };

    const { status } = await deleteFiles(params);

    return res.status(status).end();
};
