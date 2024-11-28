import { Request, Response } from 'express';
import { getLastDump, deleteFileBackup, getFileBackup, updateFileBackup, generateStreamBackup } from '../delegated-storage/index';
import fs from 'fs';
import { BackupProps } from '../props/delegated-storage';

const filePath = (filePath) => {
    return filePath.includes('.json') && filePath.includes('catalog/') ? `${process.env.DUMP_FOLDER_PATH}/${filePath}` : `/${filePath}`;
};

export const getBackupDump = async (req: Request, res: Response) => {
    const result = await getLastDump();
    return res
        .status(result.data ? 200 : 400)
        .send(result)
        .end();
};

export const getBackup = async (req: Request, res: Response) => {
    const params = {
        filepath: `${req.query.filepath}`,
        version: req.query.version ? `${req.query.version}` : null,
        mimetype: req.query.mimetype ? `${req.query.mimetype}` : null
    };
    const { status, stream }: BackupProps = await getFileBackup(params);
    if (status === 200) {
        res.status(status);
        return stream.pipe(res);
    }
    return res.status(status).end();
};

export const postBackup = async (req: Request, res: Response) => {
    const filePathToRead = filePath(req.query.filepath);
    const params = {
        filepath: `${req.query.filepath}`,
        version: req.query.version ? `${req.query.version}` : null,
        mimetype: req.query.mimetype ? `${req.query.mimetype}` : null
    };
    const file: Buffer | string = req.file ? fs.readFileSync(req.file.path) : JSON.stringify(req.body);
    const { status }: BackupProps = await generateStreamBackup({
        filepath: filePathToRead,
        file,
        ...params
    });

    return res.status(status).end();
};

export const patchBackup = async (req: Request, res: Response) => {
    const params = {
        filepath: `${req.query.filepath}`,
        version: req.query.version ? `${req.query.version}` : null,
        mimetype: req.query.mimetype ? `${req.query.mimetype}` : null
    };

    const file: Buffer | string = req.file ? fs.readFileSync(req.file.path) : JSON.stringify(req.body);
    const { status } = await updateFileBackup({ file, ...params });

    return res.status(status).end();
};

export const deleteBackup = async (req: Request, res: Response) => {
    const params = {
        filepath: `${req.query.filepath}`,
        version: req.query.version ? `${req.query.version}` : null,
        mimetype: req.query.mimetype ? `${req.query.mimetype}` : null
    };

    const { status } = await deleteFileBackup(params);

    return res.status(status).end();
};
