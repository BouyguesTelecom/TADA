import { Request, Response } from 'express';
import app from '../app';
import { logger } from '../utils/logs/winston';
import { addOneFile, getAllFiles, getCatalog, getOneFile, updateOneFile } from '../utils/redis/operations';
import { connectClient, disconnectClient, redisClient } from '../utils/redis/connection';
import { FileProps } from '../utils/redis/types';
import { purgeData, sendResponse } from '../middleware/validators/utils';
import { getCurrentDateVersion } from '../utils/catalog';

export const addFileInCatalog = async (item: FileProps): Promise<{ status: number; message: string; data: Object }> => {
    try {
        await connectClient();
        const response = await addOneFile(item);
        await purgeData('catalog');
        if (response.data && (!response.errors || response.errors.length === 0)) {
            return {
                status: 200,
                message: `Item added with uuid: ${response.data.uuid}`,
                data: response.data
            };
        }
        return {
            status: 500,
            message: response.errors?.join(', ') || 'Unknown error',
            data: null
        };
    } catch (err: unknown) {
        logger.error(`Error adding file: ${err}`);
        return {
            status: 500,
            message: `Error adding file: ${err}`,
            data: null
        };
    } finally {
        await disconnectClient();
    }
};

export const getFiles = async (req: Request, res: Response) => {
    try {
        await connectClient();
        const response = await getAllFiles();
        if (response.data && (!response.errors || response.errors.length === 0)) {
            return res.status(200).send(response.data);
        }
        return res.status(500).send(response.errors);
    } catch (err: unknown) {
        logger.error(`Error getting files: ${err}`);
        return res.status(500).send({
            message: `Error getting files: ${err}`
        });
    } finally {
        await disconnectClient();
    }
};

export const getFile = async (req: Request, res: Response) => {
    try {
        await connectClient();
        const response = await getOneFile(req.params.id);
        if (response.data && (!response.errors || response.errors.length === 0)) {
            return res.status(200).json({ data: [response.data] });
        }
        return res.status(404).json({
            data: null,
            errors: [`Unable to find file with id ${req.params.id} => ${response.errors?.join(', ')}`]
        });
    } catch (err: unknown) {
        logger.error(`Error getting file: ${err}`);
        return res.status(500).send({
            data: null,
            errors: [`Error getting file: ${err}`]
        });
    } finally {
        await disconnectClient();
    }
};

export const updateFileInCatalog = async (uuid: string, itemToUpdate: FileProps): Promise<any> => {
    await connectClient();
    const updateItem = await updateOneFile(uuid, itemToUpdate);
    await disconnectClient();
    await purgeData('catalog');
    return updateItem;
};

export const deleteFileFromCatalog = async (uniqueName: string): Promise<{ status: number; message: string }> => {
    try {
        const catalog = await getCatalog();
        const itemFound = catalog.data.find((item) => item.unique_name === uniqueName);
        if (!itemFound) {
            return { status: 404, message: `Item not found: ${uniqueName}` };
        }

        await connectClient();
        await redisClient.del(itemFound.uuid);
        await disconnectClient();
        await purgeData('catalog');
        return { status: 200, message: `Successfully deleted ${uniqueName}` };
    } catch (err: unknown) {
        logger.error(`Error deleting file: ${err}`);
        return {
            status: 500,
            message: `Error deleting file: ${(err as Error).message}`
        };
    }
};

export const deleteCatalog = async (req, res) => {
    await connectClient();
    const response = await getAllFiles();
    if (response.data) {
        await purgeData('catalog');
        for (const item of response.data) {
            await deleteFileFromCatalog(item.unique_name);
        }
    }
    await disconnectClient();
    return res.status(200).send('CATALOG DELETED !');
};

export const createDump = async (req: Request, res: Response) => {
    const { data: catalog } = await getCatalog();
    const fileVersion = getCurrentDateVersion();
    const filePath = `${app.locals.PREFIXED_CATALOG}/${fileVersion}.json`;
    if (!fileVersion) {
        return sendResponse({
            res,
            status: 400,
            data: ['Error generating dump.json from Redis client']
        });
    }
    if (fileVersion) {
        const postBackupFileJson = await fetch(`${app.locals.PREFIXED_API_URL}/backup?filepath=${filePath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(catalog)
        });
        if (postBackupFileJson.status !== 200) {
            return sendResponse({
                res,
                status: 400,
                data: ['Failed to upload JSON  in backup']
            });
        }
        return sendResponse({
            res,
            status: 200,
            data: ['DUMP backup successfully']
        });
    }
    return sendResponse({
        res,
        status: 200,
        data: ['Successfully generated dump.rdb from Redis client']
    });
};
