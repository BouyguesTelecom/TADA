import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { addCatalogItem, deleteCatalogItem, getCatalog, getCatalogItem, updateCatalogItem, deleteAllCatalog, createDumpCatalog } from '../catalog';
import { validateOneFile } from '../catalog/validators';
import { logger } from '../utils/logs/winston';
import { redisHandler } from '../catalog/redis/connection';

export const addFileInCatalog = async (req: Request, res: Response) => {
    const item = req.body;
    const errorsValidation = validateOneFile(item);
    if (errorsValidation) {
        return res.status(400).json(errorsValidation);
    }
    const addedFile = await addCatalogItem(item);
    return res.status(200).json(addedFile);
};

export const getFiles = async (req: Request, res: Response) => {
    const { data: catalog } = await getCatalog();
    return res.status(200).json(catalog);
};

export const getFile = async (req: Request, res: Response) => {
    const uuid = req.params.id;
    const { status, datum, error } = await getCatalogItem({ uuid });
    return sendResponse({ res, status, data: datum ? [datum] : null, errors: error ? [error] : null });
};

export const updateFileInCatalog = async (req: Request, res: Response) => {
    const uuid = req.params.id;
    const itemToUpdate = req.body;
    const { status, datum, error } = await updateCatalogItem(uuid, itemToUpdate);
    return sendResponse({ res, status, data: datum ? [datum] : null, errors: error ? [error] : null });
};

export const deleteFileFromCatalog = async (req: Request, res: Response) => {
    const uniqueName = req.body.unique_name;
    const { status, datum, error } = await deleteCatalogItem(uniqueName);
    return sendResponse({ res, status, data: datum ? [datum] : null, errors: error ? [error] : null });
};

export const deleteCatalog = async (req: Request, res: Response) => {
    const { status, data, errors } = await deleteAllCatalog();
    return sendResponse({ res, status, data, errors });
};

export const createDump = async (req: Request, res: Response) => {
    const { status, data, errors } = await createDumpCatalog();
    return sendResponse({ res, status, data, errors });
};
