import express from 'express';
import catalogController from '../controllers/catalog.controller';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = express.Router();

router.use(redisConnectionMiddleware);

router.get('/', catalogController.getFiles.bind(catalogController));
router.get('/:id', catalogController.getFile.bind(catalogController));
router.post('/', catalogController.addFile.bind(catalogController));
router.patch('/:id', catalogController.updateFile.bind(catalogController));
router.delete('/:id', catalogController.deleteFile.bind(catalogController));
router.delete('/', catalogController.deleteAllFiles.bind(catalogController));
router.post('/create-dump', catalogController.createDump.bind(catalogController));

export default router;
