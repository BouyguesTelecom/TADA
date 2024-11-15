import { validatorHeaders } from '../middleware/validators/index';
import { validatorCatalog, validatorFiles, validatorFilesBody, validatorFilesFilter, validatorFilesSize, validatorUUIds } from '../middleware/validators/multipleFilesValidators';
import { Router } from 'express';
import { postAssets, patchAssets, deleteAssets } from '../controllers/files.controller';
import { validatorNamespace } from '../middleware/validators/oneFileValidators';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(validatorHeaders);

router.post(`/files`, [authMiddleware, validatorFiles, validatorFilesFilter, validatorFilesSize, validatorNamespace, validatorFilesBody], postAssets);

router.patch(`/files`, [authMiddleware, validatorFiles, validatorUUIds, validatorFilesFilter, validatorFilesSize, validatorCatalog, validatorFilesBody], patchAssets);

router.delete(`/files`, [authMiddleware, validatorUUIds, validatorCatalog], deleteAssets);

export { router };
