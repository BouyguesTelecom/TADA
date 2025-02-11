/**
 * @swagger
 * tags:
 *   name: Catalog
 *   description: Catalog management
 */

import { createDump, getFile, getFiles, deleteCatalog, updateFileInCatalog, addFileInCatalog } from '../controllers/catalog.controller';
import { Router } from 'express';
import { deleteCatalogItem } from '../catalog';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';

const router = Router();

router.use(redisConnectionMiddleware);

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
router.get(`/catalog`, getFiles);

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
router.get(`/catalog/:id`, getFile);

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
router.post(`/catalog`, addFileInCatalog);

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
router.patch(`/catalog/:id`, updateFileInCatalog);

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
router.delete(`/catalog/:id`, deleteCatalogItem);

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
router.delete(`/catalog`, deleteCatalog);

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
router.post(`/catalog/create-dump`, createDump);

export { router };
