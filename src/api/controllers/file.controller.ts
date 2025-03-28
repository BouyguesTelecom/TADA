import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { catalogService } from '../../core/services/catalog.service';
import { FileService } from '../../core/services/file.service';
import { StorageFactory } from '../../infrastructure/storage/factory';
import { calculateSHA256 } from '../../utils/catalog';
import { logger } from '../../utils/logs/winston';
import { BaseController } from './base.controller';

export class FileController extends BaseController {
    private fileService: FileService;

    constructor() {
        super();
        try {
            const storage = StorageFactory.createStorage();
            this.fileService = new FileService(storage, catalogService);
            logger.info('FileController initialized successfully');
        } catch (error) {
            logger.error(`Error initializing FileController: ${error}`);
            throw error;
        }
    }

    async getAsset(req: Request, res: Response): Promise<void> {
        try {
            const { format, ...params } = req.params;
            const uuid = params['0'];
            const result = await catalogService.getFile(uuid);

            if (result.error) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File not found: ${uuid}`
                });
                return;
            }

            const fileData = await this.fileService.getFile(result.datum.uuid);
            if (!fileData.buffer) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File content not found: ${uuid}`
                });
                return;
            }

            res.status(200).send(fileData.buffer);
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }

    async postAsset(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'No file provided'
                });
                return;
            }

            logger.info(`Processing file upload: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);

            const namespace = req.body.namespace || 'DEV';
            const uuid = uuidv4();
            const signature = calculateSHA256(req.file.buffer);
            const baseHost = process.env.NGINX_INGRESS || 'http://localhost:8080';

            const metadata = {
                uuid,
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                signature,
                namespace,
                destination: req.body.destination || null,
                information: req.body.information || null,
                version: 1,
                base_host: baseHost
            };

            const uploadOptions = {
                namespace,
                stripMetadata: true,
                convertToWebp: req.body.toWebp === 'true' || req.body.toWebp === true
            };

            const result = await this.fileService.uploadFile(req.file.buffer, metadata, uploadOptions);
            if (result.error) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: result.error
                });
                return;
            }

            this.sendResponse(res, {
                status: 201,
                data: result.datum,
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }

    async patchAsset(req: Request, res: Response): Promise<void> {
        try {
            const { uuid } = req.params;
            const fileResult = await catalogService.getFile(uuid);

            if (fileResult.error) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File not found: ${uuid}`
                });
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

            if (result.error) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: result.error
                });
                return;
            }

            this.sendResponse(res, {
                status: 200,
                data: result.datum,
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }

    async deleteAsset(req: Request, res: Response): Promise<void> {
        try {
            const { uuid } = req.params;
            const fileResult = await catalogService.getFile(uuid);

            if (fileResult.error) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File not found: ${uuid}`
                });
                return;
            }

            const result = await this.fileService.deleteFile(uuid);
            if (result.error) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: result.error
                });
                return;
            }

            this.sendResponse(res, {
                status: 200,
                data: null,
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }
}

export const fileController = new FileController();
