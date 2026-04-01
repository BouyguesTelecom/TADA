import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { upload } from '../services/multer.service';
import { addFile, addManyFiles, deleteFile, deleteFiles, getFile, patchFile, patchFiles } from '../controllers/file.controller';

const oneRouter = Router();
oneRouter.get('/', verifyToken, getFile);
oneRouter.post('/', verifyToken, upload, addFile);
oneRouter.delete('/', verifyToken, deleteFile);
oneRouter.patch('/', verifyToken, upload, patchFile);

const manyRouter = Router();
manyRouter.post('/', verifyToken, upload, addManyFiles);
manyRouter.delete('/', verifyToken, deleteFiles);
manyRouter.patch('/', verifyToken, upload, patchFiles);

export { oneRouter, manyRouter };
