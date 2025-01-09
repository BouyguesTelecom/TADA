import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logs/winston';
import { morganMiddleware } from './utils/logs/morgan';
import { setupSwagger } from './swaggerConfig';

require('dotenv').config();

function sanitizeAndConvertToRegex(str) {
    const sanitizedStr = str.trim();

    if (sanitizedStr.startsWith('/') && sanitizedStr.endsWith('/')) {
        return new RegExp(sanitizedStr.slice(1, -1));
    }

    return sanitizedStr;
}

const originsAllowed = process.env.ORIGINS_ALLOWED
    ? process.env.ORIGINS_ALLOWED.split(',').map(sanitizeAndConvertToRegex)
    : ['*'];

const methodsAllowed = process.env.METHODS_ALLOWED
    ? process.env.METHODS_ALLOWED.split(',')
    : ['*'];

const corsOptions: cors.CorsOptions = {
    origin: originsAllowed,
    methods: methodsAllowed
};

const app = express();

app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.PAYLOAD_MAX_SIZE }));
app.use(express.urlencoded({ limit: process.env.PAYLOAD_MAX_SIZE, extended: true }));
app.use(morganMiddleware);

setupSwagger(app);

const API_PREFIX = process.env.API_PREFIX || '';

app.use((req: Request, res: Response, next: NextFunction) => {
    const API_PREFIX = process.env.API_PREFIX || '';
    app.locals.PREFIXED_API_URL = `${ process.env.IMAGE_SERVICE }${ API_PREFIX }`;
    app.locals.PREFIXED_ASSETS_URL = `${ API_PREFIX }/assets/media`;
    app.locals.PREFIXED_CATALOG = `${ process.env.DEV_ENV ? 'DEV/' : '' }catalog`;
    next();
});

app.get(`${ API_PREFIX }${ process.env.HEALTHCHECK_ROUTE }`, (_req: Request, res: Response) => {
    return res.status(200).end();
});

const routersPath = path.join(__dirname, 'routes');

fs.readdirSync(routersPath).forEach((file) => {
    const isRouteFile = file.endsWith('routes.ts') || file.endsWith('routes.js');

    if (isRouteFile) {
        const routerModule = require(path.join(routersPath, file));
        if (routerModule && routerModule.router) {
            app.use(API_PREFIX, routerModule.router);
        } else {
            logger.error(`Error importing route file: ${ file }`);
        }
    }
});

export default app;
