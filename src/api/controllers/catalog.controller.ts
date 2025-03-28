import { Request, Response } from 'express';
import { catalogService } from '../../core/services/catalog.service';
import { logger } from '../../utils/logs/winston';
import { BaseController } from './base.controller';

export class CatalogController extends BaseController {
    constructor() {
        super();
        try {
            logger.info('CatalogController initialized successfully');
        } catch (error) {
            logger.error(`Error initializing CatalogController: ${error}`);
            throw error;
        }
    }

    async getFiles(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.getFiles();
            if (result.errors?.length) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'Failed to get files'
                });
                return;
            }
            this.sendResponse(res, {
                status: 200,
                data: result.data,
                error: null
            });
        } catch (error) {
            this.handleError(error as Error, res);
        }
    }

    async getFile(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const result = await catalogService.getFile(id);

            if (result.error) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File not found: ${id}`
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

    async addFile(req: Request, res: Response): Promise<void> {
        try {
            const validationError = this.validateRequest(req, ['filename', 'mimetype', 'size']);
            if (validationError) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: validationError
                });
                return;
            }

            const result = await catalogService.addFile(req.body);
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

    async updateFile(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const validationError = this.validateRequest(req, ['filename', 'mimetype', 'size']);
            if (validationError) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: validationError
                });
                return;
            }

            const result = await catalogService.updateFile(id, req.body);
            if (result.error) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File not found: ${id}`
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

    async deleteFile(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const result = await catalogService.deleteFile(id);
            if (result.error) {
                this.sendResponse(res, {
                    status: 404,
                    data: null,
                    error: `File not found: ${id}`
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

    async deleteAllFiles(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.deleteAllFiles();
            if (result.errors?.length) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'Failed to delete all files'
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

    async createDump(req: Request, res: Response): Promise<void> {
        try {
            const result = await catalogService.createDump();
            if (result.errors?.length) {
                this.sendResponse(res, {
                    status: 400,
                    data: null,
                    error: 'Failed to create dump'
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
}

export const catalogController = new CatalogController();
