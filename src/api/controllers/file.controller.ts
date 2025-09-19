import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { FileControllerLocals } from '../props/file-operations';
import { returnDefaultImage } from '../utils/file';
import { logger } from '../utils/logs/winston';
import { processGetAsset, processPostAsset, processPatchAsset, processDeleteAsset } from '../utils/fileProcessing';

export const getAsset = async (req: Request, res: Response & { locals: FileControllerLocals }) => {
    const { uniqueName, file, queryVersion } = res.locals;
    const version = Number(queryVersion ?? file.version);
    try {
        const result = await processGetAsset(uniqueName, file, version, req.url);

        if (result.status === 200) {
            if (result.error === 'expired') {
                return returnDefaultImage(res, '/default.svg');
            }
            
            if (result.stream) {
                res.setHeader('Content-Type', result.contentType);
                res.setHeader('Content-Disposition', result.contentDisposition);
                return result.stream.pipe(res, { end: true });
            }
            
            if (result.buffer) {
                if (req.url.includes('/full/')) {
                    res.setHeader('x-processing-image', 'true');
                }
                res.setHeader('Content-Type', result.contentType);
                return res.send(result.buffer).end();
            }
        }
        
        if (result.status === 418) {
            return res.status(418).end();
        }
        
        if (result.status === 404) {
            return res.status(404).end();
        }
        
        return res.status(result.status || 500).end();
        
    } catch (error) {
        logger.error('Error in getAsset:', error);
        return res.status(500).end();
    }
};

export const postAsset = async (_req: Request, res: Response) => {
    const { uniqueName, fileInfo, toWebp, namespace, file } = res.locals;
    
    try {
        const result = await processPostAsset(uniqueName, fileInfo, toWebp, namespace, file);
        
        return sendResponse({
            res,
            status: result.status,
            data: result.data || [],
            errors: result.errors || [],
            ...(result.purge && { purge: result.purge })
        });
    } catch (error) {
        logger.error('Error in postAsset:', error);
        return sendResponse({
            res,
            status: 500,
            errors: ['Internal server error']
        });
    }
};

export const patchAsset = async (_req: Request, res: Response) => {
    const { itemToUpdate, uuid, fileInfo, toWebp, file } = res.locals;

    try {
        const result = await processPatchAsset(itemToUpdate, uuid, fileInfo, toWebp, file);

        return sendResponse({
            res,
            status: result.status,
            data: result.data || [],
            errors: result.errors || [],
            ...(result.purge && { purge: result.purge })
        });
    } catch (error) {
        logger.error('Error in patchAsset:', error);
        return sendResponse({
            res,
            status: 500,
            errors: ['Internal server error']
        });
    }
};

export const deleteAsset = async (_req: Request, res: Response) => {
    const { itemToUpdate } = res.locals;
    
    try {
        const result = await processDeleteAsset(itemToUpdate);
        
        return sendResponse({
            res,
            status: result.status,
            data: result.data || [],
            errors: result.errors || [],
            ...(result.purge && { purge: result.purge })
        });
    } catch (error) {
        logger.error('Error in deleteAsset:', error);
        return sendResponse({
            res,
            status: 500,
            errors: ['Internal server error']
        });
    }
};
