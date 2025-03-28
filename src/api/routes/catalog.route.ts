/**
 * @swagger
 * tags:
 *   name: Catalog
 *   description: Catalog management
 */

import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller';
import { redisMiddleware } from '../middleware/redis.middleware';

const router = Router();

router.use(redisMiddleware);

/**
 * @swagger
 * /catalog:
 *   get:
 *     summary: Retrieve a list of files
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: A list of files
 */
router.get('/catalog', catalogController.getFiles);

/**
 * @swagger
 * /catalog/{id}:
 *   get:
 *     summary: Retrieve a single file
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The file id
 *     responses:
 *       200:
 *         description: A single file
 */
router.get('/catalog/:id', catalogController.getFile);

/**
 * @swagger
 * /catalog:
 *   post:
 *     summary: Add a file to the catalog
 *     tags: [Catalog]
 *     responses:
 *       201:
 *         description: File added
 */
router.post('/catalog', catalogController.addFile);

/**
 * @swagger
 * /catalog/{id}:
 *   patch:
 *     summary: Update a file in the catalog
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The file id
 *     responses:
 *       200:
 *         description: File updated
 */
router.patch('/catalog/:id', catalogController.updateFile);

/**
 * @swagger
 * /catalog/{id}:
 *   delete:
 *     summary: Delete a file from the catalog
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The file id
 *     responses:
 *       200:
 *         description: File deleted
 */
router.delete('/catalog/:id', catalogController.deleteFile);

/**
 * @swagger
 * /catalog:
 *   delete:
 *     summary: Delete all files from the catalog
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: All files deleted
 */
router.delete('/catalog', catalogController.deleteAllFiles);

/**
 * @swagger
 * /catalog/create-dump:
 *   post:
 *     summary: Create a dump of the catalog
 *     tags: [Catalog]
 *     responses:
 *       201:
 *         description: Dump created
 */
router.post('/catalog/create-dump', catalogController.createDump);

export { router };
