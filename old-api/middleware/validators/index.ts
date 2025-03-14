import { NextFunction, Request, Response } from 'express';
import { sendResponse } from './utils';

export const validatorHeaders = (req: Request, res: Response, next: NextFunction) => {
    const allowedContentType = ['application/json', 'multipart/form-data; boundary=', 'multipart/form-data;boundary='];

    if (!req.headers['content-type'] || !allowedContentType.find((contentType) => req.headers['content-type'].includes(contentType))) {
        return sendResponse({
            res,
            status: 400,
            errors: ['invalid content-type headers']
        });
    }
    res.locals.contentType = req.headers['content-type'].includes('multipart/form-data') ? 'multipart/form-data' : 'application/json';

    next();
};
