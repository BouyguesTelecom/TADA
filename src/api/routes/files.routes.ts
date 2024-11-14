import { validatorHeaders } from '../middleware/validators/index';
import { validatorCatalog, validatorFiles, validatorFilesBody, validatorFilesFilter, validatorFilesSize, validatorUUIds } from '../middleware/validators/multipleFilesValidators';
import { Router } from 'express';
import { postAssets, patchAssets, deleteAssets } from '../controllers/files.controller';
import { validatorNamespace } from '../middleware/validators/oneFileValidators';
const router = Router();

router.use(validatorHeaders);

router.post(`/files`, [validatorFiles, validatorFilesFilter, validatorFilesSize, validatorNamespace, validatorFilesBody], postAssets);

router.patch(`/files`, [validatorFiles, validatorUUIds, validatorFilesFilter, validatorFilesSize, validatorCatalog, validatorFilesBody], patchAssets);

router.delete(`/files`, [validatorUUIds, validatorCatalog], deleteAssets);

export { router };
