import { Request, Response } from 'express';
import { CatalogService } from '../../core/services/catalog.service';

export class CatalogController {
    private catalogService: CatalogService;

    constructor() {
        this.catalogService = new CatalogService();
    }

    async getFiles(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.getFiles();
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get files' });
        }
    }

    async getFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.getFile({ uuid: req.params.id });
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get file' });
        }
    }

    async addFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.addFile(req.body);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to add file' });
        }
    }

    async updateFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.updateFile(req.params.id, req.body);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update file' });
        }
    }

    async deleteFile(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.deleteFile(req.params.id);
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete file' });
        }
    }

    async deleteAllFiles(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.deleteAllFiles();
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete all files' });
        }
    }

    async createDump(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.catalogService.createDump();
            res.status(result.status).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create dump' });
        }
    }
}
