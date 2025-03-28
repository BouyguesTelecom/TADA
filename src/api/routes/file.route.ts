/**
 * @swagger
 * tags:
 *   name: Single File
 *   description: Single File management
 */

import { Router } from 'express';
import multer from 'multer';
import { fileController } from '../controllers/file.controller';
import { redisMiddleware } from '../middleware/redis.middleware';
import { validatorHeaders } from '../middleware/validators';
import { SingleFileValidator } from '../middleware/validators/single-file.validator';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const singleFileValidator = new SingleFileValidator();

router.use(redisMiddleware);
router.use(validatorHeaders);

/**
 * @swagger
 * /file/{format}/{namespace}/{destination}/{filename}:
 *   get:
 *     summary: Retrieve an asset
 *     tags: [Single File]
 *     parameters:
 *       - in: path
 *         name: format
 *         schema:
 *           type: string
 *           description: The asset format
 *     responses:
 *       200:
 *         description: An asset
 */
router.get('/assets/media/:format/*', singleFileValidator.handle.bind(singleFileValidator), fileController.getAsset);

/**
 * @swagger
 * /file:
 *   post:
 *     summary: Post a file
 *     tags: [Single File]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               namespace:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *               toWebp:
 *                  type: boolean
 *               destination:
 *                 type: string
 *               expiration_date:
 *                  type: date
 *               information:
 *                  type: string
 *     responses:
 *       200:
 *         description: The file was successfully posted
 */
router.post('/file', upload.single('file'), singleFileValidator.handle.bind(singleFileValidator), fileController.postAsset);

/**
 * @swagger
 * /file/{uuid}:
 *   patch:
 *     summary: Patch a file
 *     tags: [Single File]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         schema:
 *           type: string
 *           description: The file uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               namespace:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *               toWebp:
 *                 type: boolean
 *               information:
 *                 type: string
 *               expiration_date:
 *                 type: date
 *               expired:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: The file was successfully patched
 */
router.patch('/file/:uuid', upload.single('file'), singleFileValidator.handle.bind(singleFileValidator), fileController.patchAsset);

/**
 * @swagger
 * /file/{uuid}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Single File]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         schema:
 *           type: string
 *           description: The file uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namespace:
 *                 type: string
 *     responses:
 *       200:
 *         description: The file was successfully deleted
 */
router.delete('/file/:uuid', singleFileValidator.handle.bind(singleFileValidator), fileController.deleteAsset);

export { router };
