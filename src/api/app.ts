import cors from 'cors';
import express, { Application as ExpressApplication, NextFunction, Request, Response } from 'express';
import { morganMiddleware } from '../utils/logs/morgan';
import { initRoutes } from './routes';

export class Application {
    private readonly app: ExpressApplication;
    private readonly apiPrefix: string;

    constructor() {
        this.app = express();
        this.apiPrefix = process.env.API_PREFIX || '';
        this.initializeMiddlewares();
        // this.initializeSwagger();
        this.initializeGlobalMiddleware();
        this.initializeHealthCheck();
        this.initializeRoutes();

        console.log('Application initialisée');
    }

    private sanitizeAndConvertToRegex(str: string): RegExp | string {
        const sanitizedStr = str.trim();
        return sanitizedStr.startsWith('/') && sanitizedStr.endsWith('/') ? new RegExp(sanitizedStr.slice(1, -1)) : sanitizedStr;
    }

    private initializeMiddlewares(): void {
        const originsAllowed = process.env.ORIGINS_ALLOWED ? process.env.ORIGINS_ALLOWED.split(',').map(this.sanitizeAndConvertToRegex) : ['*'];
        const methodsAllowed = process.env.METHODS_ALLOWED ? process.env.METHODS_ALLOWED.split(',') : ['*'];

        this.app.disable('x-powered-by');
        this.app.use(cors({ origin: originsAllowed, methods: methodsAllowed }));
        this.app.use(express.json({ limit: process.env.PAYLOAD_MAX_SIZE }));
        this.app.use(express.urlencoded({ limit: process.env.PAYLOAD_MAX_SIZE, extended: true }));
        this.app.use(morganMiddleware);
    }
    // private initializeSwagger(): void {
    //     setupSwagger(this.app);
    // }

    private initializeGlobalMiddleware(): void {
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            this.app.locals.PREFIXED_API_URL = `${process.env.IMAGE_SERVICE}${this.apiPrefix}`;
            this.app.locals.PREFIXED_ASSETS_URL = `${this.apiPrefix}/assets/media`;
            this.app.locals.PREFIXED_CATALOG = `${process.env.DEV_ENV ? 'DEV/' : ''}catalog`;
            next();
        });
    }

    private initializeHealthCheck(): void {
        this.app.get(`${this.apiPrefix}${process.env.HEALTHCHECK_ROUTE}`, (_req: Request, res: Response) => res.status(200).end());
    }

    private initializeRoutes(): void {
        console.log("Initialisation de toutes les routes de l'application...");
        initRoutes(this.app, this.apiPrefix);
        console.log("Routes de l'application initialisées");
    }

    public getApp(): ExpressApplication {
        return this.app;
    }
}

export default new Application().getApp();
