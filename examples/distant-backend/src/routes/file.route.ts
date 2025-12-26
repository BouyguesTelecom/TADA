import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { upload } from '../services/multer.service';
import { addFile, addManyFiles, getFile } from '../controllers/file.controller';

const oneRouter = Router();
oneRouter.post('/', verifyToken, upload, addFile);
oneRouter.get('/', verifyToken, getFile);

const manyRouter = Router();
manyRouter.post('/', verifyToken, upload, addManyFiles);

export { oneRouter, manyRouter };
