import { Request, Response } from 'express';
import proxy from 'express-http-proxy';
import { addCatalogItem, createDumpCatalog, deleteAllCatalog, deleteCatalogItem, getCatalogItem, getDumpCatalog, restoreDumpCatalog, updateCatalogItem } from '../catalog';
import { getAllFiles } from '../catalog/redis/operations';
import { validateOneFile } from '../catalog/validators';
import { sendResponse } from '../middleware/validators/utils';
import { patchFileBackup } from './delegated-storage.controller';

export const addFileInCatalog = async (req: Request, res: Response): Promise<any> => {
    const item = req.body;
    const errorsValidation = validateOneFile(item);
    if (errorsValidation) {
        return res.status(400).json(errorsValidation);
    }
    const addedFile = await addCatalogItem(item);
    return res.status(200).json(addedFile);
};

export const getFiles = async (req: Request, res: Response) => {
    const { data: catalog, errors } = await getAllFiles();

    if (errors) {
        return res.status(500).json({ errors });
    }

    if (req.query.filterByKey && req.query.filterByValue) {
        const filtered = catalog.filter((item) => item[`${req.query.filterByKey}`] === req.query.filterByValue);
        return res.json(filtered);
    }

    return res.status(200).json(catalog);
};

export const getFile = async (req: Request, res: Response) => {
    const uuid = req.params.id;
    const { status, datum, error } = await getCatalogItem({ uuid });
    return sendResponse({ res, status, data: datum ? [datum] : null, errors: error ? [error] : null });
};

export const updateFileInCatalog = async (req: Request, res: Response) => {
    const uuid = req.params.uuid;
    const itemToUpdate = req.body;
    const { status, datum, error } = await updateCatalogItem(uuid, itemToUpdate);

    const patchBackupFile = await patchFileBackup(datum, null, itemToUpdate);
    return sendResponse({
        res,
        status,
        data: datum ? [{ ...datum, catalogItemUrl: datum.base_host + '/catalog/' + datum.uuid }] : null,
        errors: error ? [error] : null,
        purge: 'true'
    });
};

export const updateFilesInCatalog = async (req: Request, res: Response) => {
    const valid = [];
    const invalid = [];
    for (const item of req.body) {
        const { status, datum, error } = await updateCatalogItem(item.uuid, item);
        if (status === 200) {
            valid.push(datum);
        } else {
            invalid.push(datum);
        }
    }
    return sendResponse({ res, status: 200, data: valid, errors: invalid });
};

export const deleteFileFromCatalog = async (req: Request, res: Response) => {
    const uuid = req.params.uuid;
    const { status, datum, error } = await deleteCatalogItem(uuid);
    return sendResponse({
        res,
        status,
        data: datum ? [datum] : null,
        errors: error ? [error] : null,
        purge: 'true'
    });
};

export const deleteCatalog = async (req: Request, res: Response) => {
    const { status, data, errors } = await deleteAllCatalog();
    return sendResponse({ res, status, data, errors });
};

export const getDump = async (req: Request, res: Response, next) => {
    const { filename, format } = req.query;
    if (process.env.DELEGATED_STORAGE_METHOD === 'DISTANT_BACKEND') {
        const delegatedStorageHost = process.env.DELEGATED_STORAGE_HOST;
        const urlToGetBackup = process.env.URL_TO_GET_BACKUP || '/get-dump';
        const targetHost = `${delegatedStorageHost}`;
        const targetURLPath = `${urlToGetBackup}/${encodeURIComponent(filename.toString())}`;
        req.headers['Authorization'] = `Bearer ${process.env.DELEGATED_STORAGE_TOKEN}`;

        return proxy(targetHost, { proxyReqPathResolver: () => targetURLPath })(req, res, next);
    }

    const { status, data, errors } = await getDumpCatalog(filename, format);
    return sendResponse({ res, status, data, errors });
};

export const createDump = async (req: Request, res: Response) => {
    const { filename, format } = req.query;
    const { status, data, errors } = await createDumpCatalog(filename, format);
    return sendResponse({ res, status, data, errors });
};

export const restoreDump = async (req: Request, res: Response) => {
    const { status, data, errors } = await restoreDumpCatalog();
    return sendResponse({ res, status, data, errors });
};
