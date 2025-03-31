import cors from 'cors';
import express, { Application as ExpressApplication, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { morganMiddleware } from '../utils/logs/morgan';
import { logger } from '../utils/logs/winston';

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

        this.app.use((req, res, next) => {
            logger.info(`[DEBUG] Incoming request: ${req.method} ${req.url}`);
            logger.info(`[DEBUG] Request headers: ${JSON.stringify(req.headers)}`);
            logger.info(`[DEBUG] Request body: ${JSON.stringify(req.body)}`);
            next();
        });
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

    private async initializeRoutes(): Promise<void> {
        const routersPath = path.join(__dirname, 'routes');

        try {
            logger.info('[DEBUG] ========== ROUTES INITIALIZATION ==========');
            logger.info(`[DEBUG] Routes directory: ${routersPath}`);
            logger.info(`[DEBUG] API Prefix: ${this.apiPrefix}`);
            logger.info(`[DEBUG] Image Service URL: ${process.env.IMAGE_SERVICE}`);
            logger.info(`[DEBUG] Assets URL: ${this.apiPrefix}/assets/media`);
            logger.info(`[DEBUG] Catalog URL: ${process.env.DEV_ENV ? 'DEV/' : ''}catalog`);

            const files = fs.readdirSync(routersPath);
            logger.info(`Found route files: ${files.join(', ')}`);

            for (const file of files) {
                if (file.endsWith('.route.js') && !file.endsWith('.map')) {
                    try {
                        const routerModule = await import(path.join(routersPath, file));
                        if (routerModule && routerModule.router) {
                            const baseUrl = this.apiPrefix || '';
                            this.app.use(baseUrl, routerModule.router);
                            logger.info(`✅ Route ${file} loaded successfully at base URL: ${baseUrl}`);

                            const routes = routerModule.router.stack.filter((r: any) => r.route).map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${baseUrl}${r.route.path}`);
                            logger.info(`📍 Routes registered: ${routes.join(', ')}`);
                        } else {
                            logger.error(`⛔️ No router found in ${file}`);
                        }
                    } catch (error) {
                        logger.error(`⛔️ Error loading route ${file}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`⛔️ Error reading routes directory: ${error.message}`);
        }
    }

    public getApp(): ExpressApplication {
        return this.app;
    }
}

export default new Application().getApp();
