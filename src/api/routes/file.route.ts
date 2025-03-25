import express from 'express';
import multer from 'multer';
import fileController from '../controllers/file.controller';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(redisConnectionMiddleware);

router.get('/:format*', fileController.getAsset.bind(fileController));
router.post('/', upload.single('file'), fileController.postAsset.bind(fileController));
router.patch('/:uuid', upload.single('file'), fileController.patchAsset.bind(fileController));
router.delete('/:uuid', fileController.deleteAsset.bind(fileController));

export default router;
