import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import catalogService from '../../core/services/catalog.service';
import { FileService } from '../../core/services/file.service';
import { StorageFactory } from '../../infrastructure/storage/factory';
import { calculateSHA256 } from '../../utils/catalog';
import { logger } from '../../utils/logs/winston';

export class FileController {
    private fileService: FileService;

    constructor() {
        try {
            const storage = StorageFactory.createStorage();
            this.fileService = new FileService(storage, catalogService);
        } catch (error) {
            logger.error(`Error initializing FileController: ${error}`);
            throw error;
        }
    }

    async getAsset(req: Request, res: Response): Promise<void> {
        try {
            const { format, ...params } = req.params;
            const uuid = params['0'];
            const result = await catalogService.getFile({ uuid });

            if (result.status !== 200 || !result.datum) {
                res.status(result.status || 404).json({ error: result.error || 'File not found' });
                return;
            }

            const fileData = await this.fileService.getFile(result.datum.uuid);
            if (!fileData.buffer) {
                res.status(404).json({ error: 'File content not found' });
                return;
            }

            res.status(200).send(fileData.buffer);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get asset' });
        }
    }

    async postAsset(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file provided' });
                return;
            }

            logger.info(`Processing file upload: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);

            const namespace = req.body.namespace || 'DEV';
            const uuid = uuidv4();
            const signature = calculateSHA256(req.file.buffer);

            const result = await this.fileService.uploadFile(
                req.file.buffer,
                {
                    uuid,
                    filename: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    signature,
                    namespace,
                    destination: req.body.destination || null,
                    information: req.body.information || null,
                    version: 1,
                    base_host: process.env.NGINX_INGRESS || 'http://localhost:8080',
                    ...req.body
                },
                {
                    namespace,
                    stripMetadata: true,
                    convertToWebp: req.body.toWebp === 'true' || req.body.toWebp === true
                }
            );

            res.status(result.status).json(result);
        } catch (error) {
            logger.error(`Error in postAsset: ${error}`);
            res.status(500).json({ error: 'Failed to upload file', details: error.message });
        }
    }

    async patchAsset(req: Request, res: Response): Promise<void> {
        try {
            const { uuid } = req.params;
            const fileResult = await catalogService.getFile({ uuid });

            if (fileResult.status !== 200 || !fileResult.datum) {
                res.status(fileResult.status || 404).json({ error: fileResult.error || 'File not found' });
                return;
            }

            const result = await this.fileService.updateFile(
                uuid,
                req.file?.buffer || null,
                {
                    ...req.body,
                    ...(req.file && {
                        filename: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.size
                    })
                },
                {
                    stripMetadata: true,
                    convertToWebp: req.body.toWebp
                }
            );

            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update file' });
        }
    }

    async deleteAsset(req: Request, res: Response): Promise<void> {
        try {
            const { uuid } = req.params;
            const fileResult = await catalogService.getFile({ uuid });

            if (fileResult.status !== 200 || !fileResult.datum) {
                res.status(fileResult.status || 404).json({ error: fileResult.error || 'File not found' });
                return;
            }

            const result = await this.fileService.deleteFile(uuid);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete file' });
        }
    }
}

const fileController = new FileController();
export default fileController;
