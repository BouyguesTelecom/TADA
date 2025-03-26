import { Application } from 'express';
import catalogRouter from './catalog.route';
import fileRouter from './file.route';
import filesRouter from './files.route';

export function initRoutes(app: Application, apiPrefix: string = ''): void {
    app.use(`${apiPrefix}/catalog`, catalogRouter);
    app.use(`${apiPrefix}/file`, fileRouter);
    app.use(`${apiPrefix}/files`, filesRouter);
}
