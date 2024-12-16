/**
 * @swagger
 * tags:
 *   name: Multiple Files
 *   description: Multiple files management
 */

import { validatorHeaders } from '../middleware/validators';
import { validatorCatalog, validatorFiles, validatorFilesBody, validatorFilesFilter, validatorFilesSize, validatorUUIds } from '../middleware/validators/multipleFilesValidators';
import { Router } from 'express';
import { postAssets, patchAssets, deleteAssets } from '../controllers/files.controller';
import { validatorNamespace } from '../middleware/validators/oneFileValidators';
import { authMiddleware } from '../middleware/auth';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = Router();

router.use(validatorHeaders);
router.use(redisConnectionMiddleware);

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
router.post(`/files`, [authMiddleware, validatorFiles, validatorFilesFilter, validatorFilesSize, validatorNamespace, validatorFilesBody], postAssets);

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
router.patch(`/files`, [authMiddleware, validatorFiles, validatorUUIds, validatorFilesFilter, validatorFilesSize, validatorCatalog, validatorFilesBody], patchAssets);

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
router.delete(`/files`, [authMiddleware, validatorUUIds, validatorCatalog], deleteAssets);

export { router };
