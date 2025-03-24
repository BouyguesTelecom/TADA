import { Application } from 'express';
import { CatalogRoute } from './catalog.route';
import { FileRoute } from './file.route';
import { FilesRoute } from './files.route';

export class Routes {
    public static init(app: Application, apiPrefix: string = ''): void {
        const routes = [new CatalogRoute(), new FileRoute(), new FilesRoute()];

        routes.forEach((route) => {
            app.use(apiPrefix, route.getRouter());
        });
    }
}
