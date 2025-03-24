import { FileController } from '../controllers/file.controller';
import { authMiddleware } from '../middleware/auth';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';
import { timeoutMiddleware } from '../middleware/timeoutMiddleware';
import { validatorHeaders } from '../middleware/validators';
import {
    validatorFile,
    validatorFileBody,
    validatorFileCatalog,
    validatorFileFilter,
    validatorFileSize,
    validatorGetAsset,
    validatorNamespace,
    validatorParams
} from '../middleware/validators/oneFileValidators';
import { BaseRoute } from './base.route';

export class FileRoute extends BaseRoute {
    private controller: FileController;

    constructor() {
        super('/file');
        this.controller = new FileController();
    }

    protected initializeMiddlewares(): void {
        this.router.use(redisConnectionMiddleware);
    }

    protected initializeRoutes(): void {
        // GET /assets/media/:format/*
        this.router.get('/assets/media/:format/*', [timeoutMiddleware, validatorGetAsset], this.controller.getAsset.bind(this.controller));
        this.logRoute('GET', '/assets/media/:format/*');

        // POST /file
        this.router.post(
            '/',
            [authMiddleware, validatorHeaders, validatorFile, validatorFileFilter, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog],
            this.controller.postAsset.bind(this.controller)
        );
        this.logRoute('POST', '/');

        // PATCH /file/:uuid
        this.router.patch(
            '/:uuid',
            [authMiddleware, validatorHeaders, validatorFile, validatorFileFilter, validatorParams, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog],
            this.controller.patchAsset.bind(this.controller)
        );
        this.logRoute('PATCH', '/:uuid');

        // DELETE /file/:uuid
        this.router.delete('/:uuid', [authMiddleware, validatorHeaders, validatorParams, validatorNamespace, validatorFileCatalog], this.controller.deleteAsset.bind(this.controller));
        this.logRoute('DELETE', '/:uuid');
    }
}
