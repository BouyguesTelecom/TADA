/**
 * @swagger
 * tags:
 *   name: Multiple Files
 *   description: Multiple files management
 */

import { Router } from 'express';
import multer from 'multer';
import { filesController } from '../controllers/files.controller';
import { redisMiddleware } from '../middleware/redis.middleware';
import { validatorHeaders } from '../middleware/validators';
import { MultipleFilesValidator } from '../middleware/validators/multiple-files.validator';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const multipleFilesValidator = new MultipleFilesValidator();

router.use(redisMiddleware);
router.use(validatorHeaders);

/**
 * @swagger
 * /files:
 *   post:
 *     summary: Upload multiple files
 *     tags: [Multiple Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               namespace:
 *                 type: string
 *               files:
 *                 type: array
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
 *         description: Files successfully uploaded
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/files', upload.array('files'), multipleFilesValidator.handle.bind(multipleFilesValidator), filesController.postAssets);

/**
 * @swagger
 * /files:
 *   patch:
 *     summary: Update multiple files
 *     tags: [Multiple Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               namespace:
 *                 type: string
 *               uuids:
 *                 type: string
 *               information:
 *                 type: string
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               toWebp:
 *                 type: boolean
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 namespace:
 *                   type: string
 *                 uuid:
 *                   type: string
 *                 information:
 *                   type: string
 *     responses:
 *       200:
 *         description: Files successfully updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/files', upload.array('files'), multipleFilesValidator.handle.bind(multipleFilesValidator), filesController.patchAssets);

/**
 * @swagger
 * /files:
 *   delete:
 *     summary: Delete multiple files
 *     tags: [Multiple Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namespace:
 *                 type: string
 *               uuids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Files successfully deleted
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/files', multipleFilesValidator.handle.bind(multipleFilesValidator), filesController.deleteAssets);

export { router };
