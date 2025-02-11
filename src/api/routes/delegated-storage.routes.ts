/**
 * @swagger
 * tags:
 *   name: DelegatedStorage
 *   description: Delegated Storage management
 */

import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Router } from 'express';
import { getBackup, patchBackup, postBackup, deleteBackup, getBackupDump } from '../controllers/delegated-storage.controller';
import { validatorFile } from '../middleware/validators/oneFileValidators';

const router = Router();

/**
 * @swagger
 * /delegated-storage/get-last-dump:
 *   get:
 *     summary: Retrieve the last backup dump
 *     tags: [DelegatedStorage]
 *     responses:
 *       200:
 *         description: A backup dump
 */
router.get(`/delegated-storage/get-last-dump`, rateLimitMiddleware, getBackupDump);

/**
 * @swagger
 * /delegated-storage:
 *   get:
 *     summary: Retrieve the backup
 *     tags: [DelegatedStorage]
 *     responses:
 *       200:
 *         description: A list of backups
 */
router.get(`/delegated-storage`, rateLimitMiddleware, getBackup);

/**
 * @swagger
 * /delegated-storage:
 *   post:
 *     summary: Create a new backup
 *     tags: [DelegatedStorage]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Backup created
 */
router.post(`/delegated-storage`, [rateLimitMiddleware, validatorFile], postBackup);

/**
 * @swagger
 * /delegated-storage:
 *   patch:
 *     summary: Update an existing backup
 *     tags: [DelegatedStorage]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Backup updated
 */
router.patch(`/delegated-storage`, [rateLimitMiddleware, validatorFile], patchBackup);

/**
 * @swagger
 * /delegated-storage:
 *   delete:
 *     summary: Delete a backup
 *     tags: [DelegatedStorage]
 *     responses:
 *       200:
 *         description: Backup deleted
 */
router.delete(`/delegated-storage`, rateLimitMiddleware, deleteBackup);

export { router };
