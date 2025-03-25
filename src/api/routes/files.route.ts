import express from 'express';
import multer from 'multer';
import filesController from '../controllers/files.controller';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(redisConnectionMiddleware);

router.post('/', upload.array('files'), filesController.postAssets.bind(filesController));
router.patch('/', upload.array('files'), filesController.patchAssets.bind(filesController));
router.delete('/', filesController.deleteAssets.bind(filesController));

export default router;
