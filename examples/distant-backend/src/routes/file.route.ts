import { Router } from 'express';
import fs, { read } from 'fs';
import path from 'path';
import { verifyToken } from '../middleware/auth';
import { upload, uploadMemoire, UPLOAD_DIR } from '../config/multer';
import { addFiles, addFile, deleteFile, deleteFiles, overrideFiles, overrideFile, readFile } from '../controllers/file.controller';
import { checkFiles } from '../middleware/file';

const router = Router()

router.post('/', verifyToken, checkFiles, upload, addFile);

router.get('/', verifyToken, readFile);

router.delete('/', verifyToken, deleteFile);

router.patch('/', verifyToken, uploadMemoire, overrideFile)

router.post('/', verifyToken, upload, addFiles)

router.patch('/', verifyToken, overrideFiles)

router.delete('/', verifyToken, uploadMemoire, deleteFiles)

export default router
