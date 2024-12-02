import { validatorHeaders } from '../middleware/validators/index';
import { validatorGetAsset, validatorFileFilter, validatorFileBody, validatorFileCatalog, validatorFileSize, validatorParams, validatorNamespace } from '../middleware/validators/oneFileValidators';
import { validatorFile } from '../middleware/validators/oneFileValidators';
import { Router } from 'express';
import { deleteAsset, getAsset, patchAsset, postAsset } from '../controllers/file.controller';
import { timeoutMiddleware } from '../middleware/timeoutMiddleware';
import { authMiddleware } from '../middleware/auth';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = Router();

router.use(redisConnectionMiddleware);

router.get(`/assets/media/:format/*`, [timeoutMiddleware, validatorGetAsset], getAsset);

router.post(`/file`, [authMiddleware, validatorHeaders, validatorFile, validatorFileFilter, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog], postAsset);

router.patch(
    `/file/:uuid`,
    [authMiddleware, validatorHeaders, validatorFile, validatorFileFilter, validatorParams, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog],
    patchAsset
);

router.delete(`/file/:uuid`, [authMiddleware, validatorHeaders, validatorParams, validatorNamespace, validatorFileCatalog], deleteAsset);

export { router };
