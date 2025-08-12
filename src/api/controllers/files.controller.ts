import { Request, Response } from 'express';
import { sendResponse } from '../middleware/validators/utils';
import { logger } from '../utils/logs/winston';
import { processPostAsset, processPatchAsset, processDeleteAsset } from '../utils/fileProcessing';

export const postAssets = async (_req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;

    try {
        const processedResults = await Promise.all(
            validFiles.map((file) => 
                processPostAsset(
                    file.uniqueName, 
                    file.fileInfo, 
                    file.toWebp, 
                    res.locals.namespace, 
                    file
                )
            )
        );

        const successfulResults = processedResults.filter(result => result.status === 200);
        const failedResults = processedResults.filter(result => result.status !== 200);

        const data = successfulResults.flatMap(result => result.data || []);
        const processingErrors = failedResults.flatMap(result => result.errors || []);
        const errors = [...invalidFiles, ...processingErrors];

        if (successfulResults.length === 0) {
            return sendResponse({ 
                res, 
                status: 400, 
                data: null, 
                errors 
            });
        }

        return sendResponse({
            res,
            status: 200,
            data,
            errors: errors.length > 0 ? errors : [],
            purge: 'catalog'
        });
    } catch (error) {
        logger.error('POST assets error:', error);
        const errorMessage = error instanceof Error ? `Process error: ${error.message}` : 'Unexpected error occurred';

        return sendResponse({
            res,
            status: 500,
            data: null,
            errors: [errorMessage],
            purge: 'catalog'
        });
    }
};

export const patchAssets = async (req: Request, res: Response) => {
    const { validFiles, invalidFiles } = res.locals;

    try {
        const processedResults = await Promise.all(
            validFiles.map((file) => 
                processPatchAsset(
                    file.catalogItem || file.itemToUpdate,
                    file.uuid || file.catalogItem?.uuid,
                    file.fileInfo,
                    file.catalogItem?.unique_name || file.uniqueName,
                    file.toWebp,
                    req.files ? file : undefined
                )
            )
        );

        const successfulResults = processedResults.filter(result => result.status === 200);
        const failedResults = processedResults.filter(result => result.status !== 200);

        const data = successfulResults.flatMap(result => result.data || []);
        const processingErrors = failedResults.flatMap(result => result.errors || []);
        const errors = [...invalidFiles, ...processingErrors];

        return sendResponse({ 
            res, 
            status: 200, 
            data, 
            errors, 
            purge: 'true' 
        });
    } catch (error) {
        logger.error('PATCH assets error:', error);
        const errorMessage = error instanceof Error ? `Process error: ${error.message}` : 'Unexpected error occurred';

        return sendResponse({
            res,
            status: 500,
            data: null,
            errors: [errorMessage],
            purge: 'true'
        });
    }
};

export const deleteAssets = async (_req: Request, res: Response) => {
    const { validFiles } = res.locals;

    try {
        const processedResults = await Promise.all(
            validFiles.map((file) => 
                processDeleteAsset(file.catalogItem || file.itemToUpdate || file)
            )
        );

        const successfulResults = processedResults.filter(result => result.status === 200);
        const failedResults = processedResults.filter(result => result.status !== 200);

        const data = successfulResults.flatMap(result => result.data || []);
        const processingErrors = failedResults.flatMap(result => result.errors || []);

        const responseStatus = failedResults.length > 0 ? 207 : 200;

        return sendResponse({
            res,
            status: responseStatus,
            purge: 'true',
            data,
            errors: processingErrors
        });
    } catch (error) {
        logger.error('DELETE assets error:', error);
        const errorMessage = error instanceof Error ? `Process error: ${error.message}` : 'Unexpected error occurred';

        return sendResponse({
            res,
            status: 500,
            data: null,
            errors: [errorMessage],
            purge: 'true'
        });
    }
};
