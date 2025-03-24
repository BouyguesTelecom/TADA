import { CatalogController } from '../controllers/catalog.controller';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';
import { BaseRoute } from './base.route';

export class CatalogRoute extends BaseRoute {
    private controller: CatalogController;

    constructor() {
        super('/catalog');
        this.controller = new CatalogController();
    }

    protected initializeMiddlewares(): void {
        this.router.use(redisConnectionMiddleware);
    }

    protected initializeRoutes(): void {
        // GET /catalog - Get all files
        this.router.get('/', this.controller.getFiles.bind(this.controller));
        this.logRoute('GET', '/');

        // GET /catalog/:id - Get a file
        this.router.get('/:id', this.controller.getFile.bind(this.controller));
        this.logRoute('GET', '/:id');

        // POST /catalog - Add a file
        this.router.post('/', this.controller.addFile.bind(this.controller));
        this.logRoute('POST', '/');

        // PATCH /catalog/:id - Update a file
        this.router.patch('/:id', this.controller.updateFile.bind(this.controller));
        this.logRoute('PATCH', '/:id');

        // DELETE /catalog/:id - Delete a file
        this.router.delete('/:id', this.controller.deleteFile.bind(this.controller));
        this.logRoute('DELETE', '/:id');

        // DELETE /catalog - Delete all files
        this.router.delete('/', this.controller.deleteAllFiles.bind(this.controller));
        this.logRoute('DELETE', '/');

        // POST /catalog/create-dump - Create a dump
        this.router.post('/create-dump', this.controller.createDump.bind(this.controller));
        this.logRoute('POST', '/create-dump');
    }
}
