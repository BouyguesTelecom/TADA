import { Request, Response } from 'express';
import { catalogService } from '../../core/services/catalog.service';
import { FileService } from '../../core/services/file.service';
import { StorageFactory } from '../../infrastructure/storage/factory';
import { logger } from '../../utils/logs/winston';
import { BaseController } from './base.controller';

export class FilesController extends BaseController {
    private fileService: FileService;

    constructor() {
        super();
        try {
            const storage = StorageFactory.createStorage();
            this.fileService = new FileService(storage, catalogService);
            logger.info('FilesController initialized successfully');
        } catch (error) {
            logger.error(`Error initializing FilesController: ${error}`);
            throw error;
        }
    }

    async postAssets(req: Request, res: Response): Promise<void> {
        try {
            if (!req.files || !Array.isArray(req.files)) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'No files provided'
                });
                return;
            }

            const files = (req.files as Express.Multer.File[]).map((file) => ({
                buffer: file.buffer,
                metadata: {
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    ...req.body
                }
            }));

            const result = await this.fileService.uploadFiles(files, {
                namespace: req.body.namespace,
                stripMetadata: true,
                convertToWebp: req.body.toWebp
            });

            if (result.errors?.length) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'Failed to upload some files'
                });
                return;
            }

            this.sendResponse(res, {
                status: 201,
                data: result.data,
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }

    async patchAssets(req: Request, res: Response): Promise<void> {
        try {
            const { uuids, ...updateData } = req.body;
            const files = req.files as Express.Multer.File[];

            if (!Array.isArray(uuids)) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'uuids must be an array'
                });
                return;
            }

            const results = await Promise.all(
                uuids.map(async (uuid: string) => {
                    const file = files?.find((f) => f.originalname === uuid);
                    return this.fileService.updateFile(uuid, file ? file.buffer : null, updateData, {
                        stripMetadata: true,
                        convertToWebp: req.body.toWebp
                    });
                })
            );

            const successResults = results.filter((r) => !r.error);
            const errorResults = results.filter((r) => r.error);

            this.sendResponse(res, {
                status: 200,
                data: {
                    success: successResults.map((r) => r.datum),
                    errors: errorResults.map((r) => r.error)
                },
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }

    async deleteAssets(req: Request, res: Response): Promise<void> {
        try {
            const { uuids } = req.body;

            if (!Array.isArray(uuids)) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'uuids must be an array'
                });
                return;
            }

            const results = await Promise.all(uuids.map((uuid) => this.fileService.deleteFile(uuid)));

            const successResults = results.filter((r) => !r.error);
            const errorResults = results.filter((r) => r.error);

            this.sendResponse(res, {
                status: 200,
                data: {
                    success: successResults.map((r) => r.datum),
                    errors: errorResults.map((r) => r.error)
                },
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }
}

export const filesController = new FilesController();
