import { Request, Response } from 'express';
import { createDumpBackup, getDumpBackup, restoreDumpBackup } from './delegated-storage.controller';
import { sendResponse } from '../middleware/validators/utils';

export const getDump = async (req: Request, res: Response) => {
    const { format } = req?.query;
    const { version } = req?.params;
    const requestedFormat: string = format?.toString() || (version.split('.').length > 1 ? version.split('.')[1] : 'json');
    const { status, data, errors } = await getDumpBackup(version === 'latest' ? '' : version, requestedFormat);
    if(status === 404){
        return res.status(404).end()
    }
    if (requestedFormat === 'json') {
        return res.status(status).json(!errors.length ? data : errors).end();
    } else {
        return res.status(status).send(Buffer.from(data)).end();
    }
    return res.status(500).end();
};

export const createDump = async (req: Request, res: Response) => {
    const { filename, format } = req.query;
    const filenameStr = filename ? filename.toString() : null;
    const formatStr = format ? format.toString() : 'rdb';
    const { status, data, errors } = await createDumpBackup(filenameStr, formatStr);
    return sendResponse({ res, status, data, errors });
};

export const restoreDump = async (req: Request, res: Response) => {
    const { version } = req.params;
    const { status, data, errors } = await restoreDumpBackup(version, 'json');
    return sendResponse({ res, status, data, errors });
};