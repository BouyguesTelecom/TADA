import { FilesController } from '../controllers/files.controller';
import { authMiddleware } from '../middleware/auth';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';
import { validatorHeaders } from '../middleware/validators';
import { validatorCatalog, validatorFiles, validatorFilesBody, validatorFilesFilter, validatorFilesSize, validatorUUIds } from '../middleware/validators/multipleFilesValidators';
import { validatorNamespace } from '../middleware/validators/oneFileValidators';
import { BaseRoute } from './base.route';

export class FilesRoute extends BaseRoute {
    private controller: FilesController;

    constructor() {
        super('/files');
        this.controller = new FilesController();
    }

    protected initializeMiddlewares(): void {
        this.router.use(validatorHeaders);
        this.router.use(redisConnectionMiddleware);
    }

    protected initializeRoutes(): void {
        // POST /files
        this.router.post('/', [authMiddleware, validatorFiles, validatorFilesFilter, validatorFilesSize, validatorNamespace, validatorFilesBody], this.controller.postAssets.bind(this.controller));
        this.logRoute('POST', '/');

        // PATCH /files
        this.router.patch(
            '/',
            [authMiddleware, validatorFiles, validatorUUIds, validatorFilesFilter, validatorFilesSize, validatorCatalog, validatorFilesBody],
            this.controller.patchAssets.bind(this.controller)
        );
        this.logRoute('PATCH', '/');

        // DELETE /files
        this.router.delete('/', [authMiddleware, validatorUUIds, validatorCatalog], this.controller.deleteAssets.bind(this.controller));
        this.logRoute('DELETE', '/');
    }
}
