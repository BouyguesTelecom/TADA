/**
 * @swagger
 * tags:
 *   name: Catalog
 *   description: Catalog management
 */

import { createDump, restoreDump, getDump } from '../controllers/dumps.controller';
import { Router } from 'express';
import { redisConnectionMiddleware } from '../middleware/redisMiddleware';
import { queueMiddleware } from '../middleware/queues/queuesMiddleware';

const router = Router();

router.use(redisConnectionMiddleware);
/**
 * @swagger
 * /catalog/get-dump:
 *   get:
 *     summary: Get dump file
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Optional dump filename
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [rdb, json]
 *         description: Dump format (rdb or json, default is rdb)
 *     responses:
 *       200:
 *         description: Dump file retrieved successfully
 *       404:
 *         description: Dump file not found
 */
router.get(`/catalog/get-dump/:version(*+)`, getDump);
/**
 * @swagger
 * /catalog/create-dump:
 *   post:
 *     summary: Create a dump of the catalog
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Optional dump filename
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [rdb, json]
 *         description: Dump format (rdb or json, default is rdb)
 *     responses:
 *       200:
 *         description: Dump created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */


router.post(`/catalog/create-dump`, queueMiddleware(createDump));

/**
 * @swagger
 * /catalog/restore-dump:
 *   post:
 *     summary: Restore catalog from dump
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Optional dump filename to restore (if not provided, uses latest)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [rdb, json]
 *         description: Dump format (rdb or json, default is rdb)
 *     responses:
 *       200:
 *         description: Dump restored successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Dump file not found
 *       500:
 *         description: Internal server error
 */
router.post(`/catalog/restore-dump/:version`, queueMiddleware(restoreDump));

export { router };