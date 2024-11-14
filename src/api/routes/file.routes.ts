import { validatorHeaders } from '../middleware/validators/index';
import { validatorGetAsset, validatorFileFilter, validatorFileBody, validatorFileCatalog, validatorFileSize, validatorParams, validatorNamespace } from '../middleware/validators/oneFileValidators';
import { validatorFile } from '../middleware/validators/oneFileValidators';
import { Router } from 'express';
import { deleteAsset, getAsset, patchAsset, postAsset } from '../controllers/file.controller';
import { timeoutMiddleware } from '../middleware/timeoutMiddleware';

const router = Router();

router.get(`/assets/media/:format/*`, [timeoutMiddleware, validatorGetAsset], getAsset);

router.post(`/file`, [validatorHeaders, validatorFile, validatorFileFilter, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog], postAsset);

router.patch(`/file/:uuid`, [validatorHeaders, validatorFile, validatorFileFilter, validatorParams, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog], patchAsset);

router.delete(`/file/:uuid`, [validatorHeaders, validatorParams, validatorNamespace, validatorFileCatalog], deleteAsset);

export { router };
