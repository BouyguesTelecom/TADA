/**
 * @swagger
 * tags:
 *   name: Single File
 *   description: Single File management
 */

import { validatorHeaders } from '../middleware/validators';
import { validatorGetAsset, validatorFileFilter, validatorFileBody, validatorFileCatalog, validatorFileSize, validatorParams, validatorNamespace } from '../middleware/validators/oneFileValidators';
import { validatorFile } from '../middleware/validators/oneFileValidators';
import { Router } from 'express';
import { deleteAsset, getAsset, patchAsset, postAsset } from '../controllers/file.controller';
import { timeoutMiddleware } from '../middleware/timeoutMiddleware';
import { authMiddleware } from '../middleware/auth';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = Router();

router.use(redisConnectionMiddleware);

/**
 * @swagger
 * /assets/media/{format}/{namespace}/{destination}/{filename}:
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
 *       401:
 *         description: You must be authenticated to do this
 */
router.get(`/assets/media/:format/*`, [timeoutMiddleware, validatorGetAsset], getAsset);

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
 *
 *     responses:
 *       200:
 *         description: The file was successfully posted
 *       401:
 *         description: You must be authenticated to do this
 */
router.post(`/file`, [authMiddleware, validatorHeaders, validatorFile, validatorFileFilter, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog], postAsset);

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
 *       401:
 *         description: You must be authenticated to do this
 */
router.patch(
    `/file/:uuid`,
    [authMiddleware, validatorHeaders, validatorFile, validatorFileFilter, validatorParams, validatorNamespace, validatorFileSize, validatorFileBody, validatorFileCatalog],
    patchAsset
);

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
 *       401:
 *         description: You must be authenticated to do this
 */
router.delete(`/file/:uuid`, [authMiddleware, validatorHeaders, validatorParams, validatorNamespace, validatorFileCatalog], deleteAsset);

export { router };
