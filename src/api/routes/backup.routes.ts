import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Router } from 'express';
import { getBackup, patchBackup, postBackup, deleteBackup, getBackupDump } from '../controllers/backup.controller';
import { validatorFile } from '../middleware/validators/oneFileValidators';

const router = Router();

router.get(`/backup/get-last-dump`, rateLimitMiddleware, getBackupDump);

router.get(`/backup`, rateLimitMiddleware, getBackup);

router.post(`/backup`, [rateLimitMiddleware, validatorFile], postBackup);

router.patch(`/backup`, [rateLimitMiddleware, validatorFile], patchBackup);

router.delete(`/backup`, rateLimitMiddleware, deleteBackup);

export { router };
