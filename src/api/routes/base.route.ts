import { Router } from 'express';
import { logger } from '../../utils/logs/winston';

export abstract class BaseRoute {
    protected router: Router;
    protected path: string;

    constructor(path: string) {
        this.router = Router();
        this.path = path;
    }

    public initialize(): void {
        this.initializeMiddlewares();
        this.initializeRoutes();
    }

    public getRouter(): Router {
        return this.router;
    }

    public getPath(): string {
        return this.path;
    }

    protected abstract initializeRoutes(): void;

    protected initializeMiddlewares(): void {}

    protected logRoute(method: string, path: string): void {
        logger.info(`Route registered: [${method}] ${this.path}${path}`);
    }
}
