import { Router } from 'express';
import { logger } from '../../utils/logs/winston';

export abstract class BaseRoute {
    protected router: Router;
    protected path: string;

    constructor(path: string) {
        this.router = Router();
        this.path = path;
        this.initializeMiddlewares();
        this.initializeRoutes();
    }

    public getRouter(): Router {
        return this.router;
    }

    protected abstract initializeRoutes(): void;

    protected abstract initializeMiddlewares(): void;

    protected logRoute(method: string, path: string): void {
        logger.info(`Route registered: [${method}] ${this.path}${path}`);
    }
}
