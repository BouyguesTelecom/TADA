import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Router } from 'express';
import { getBackup, patchBackup, postBackup, deleteBackup, getBackupDump } from '../controllers/delegated-storage.controller';
import { validatorFile } from '../middleware/validators/oneFileValidators';

const router = Router();

router.get(`/delegated-storage/get-last-dump`, rateLimitMiddleware, getBackupDump);

router.get(`/delegated-storage`, rateLimitMiddleware, getBackup);

router.post(`/delegated-storage`, [rateLimitMiddleware, validatorFile], postBackup);

router.patch(`/delegated-storage`, [rateLimitMiddleware, validatorFile], patchBackup);

router.delete(`/delegated-storage`, rateLimitMiddleware, deleteBackup);

export { router };
