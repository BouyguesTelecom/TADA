import { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logs/winston';

export abstract class BaseMiddleware {
    protected abstract execute(req: Request, res: Response, next: NextFunction): Promise<void>;

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.execute(req, res, next);
        } catch (error) {
            logger.error(`Middleware error: ${error.message}`);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
