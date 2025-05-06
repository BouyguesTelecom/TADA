import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { addCatalogItem, deleteCatalogItem, getCatalogItem, updateCatalogItem, deleteAllCatalog, createDumpCatalog } from '../catalog';
import { validateOneFile } from '../catalog/validators';
import { getCachedCatalog } from '../catalog/redis/connection';

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
    const catalog = await getCachedCatalog();
    if (req.query.filterByKey && req.query.filterByValue) {
        return res.json(Object.values(catalog).filter((item) => item[`${ req.query.filterByKey }`] === req.query.filterByValue));
    }
    return res.status(200).json(Object.values(catalog));
};

export const getFile = async (req: Request, res: Response) => {
    const uuid = req.params.id;
    const { status, datum, error } = await getCatalogItem({ uuid });
    return sendResponse({ res, status, data: datum ? [ datum ] : null, errors: error ? [ error ] : null });
};

export const updateFileInCatalog = async (req: Request, res: Response) => {
    const uuid = req.params.id;
    const itemToUpdate = req.body;
    const { status, datum, error } = await updateCatalogItem(uuid, itemToUpdate);
    return sendResponse({ res, status, data: datum ? [ datum ] : null, errors: error ? [ error ] : null });
};
export const updateFilesInCatalog = async (req: Request, res: Response) => {
    const valid = [];
    const invalid = [];
    for ( const item of req.body ) {
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
    return sendResponse({ res, status, data: datum ? [ datum ] : null, errors: error ? [ error ] : null });
};

export const deleteCatalog = async (req: Request, res: Response) => {
    const { status, data, errors } = await deleteAllCatalog();
    return sendResponse({ res, status, data, errors });
};

export const createDump = async (req: Request, res: Response) => {
    const { status, data, errors } = await createDumpCatalog();
    return sendResponse({ res, status, data, errors });
};
